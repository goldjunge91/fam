import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import { preferenceId } from '@/features/shopping-list/preferences/preference-identity.node';
import type { Database } from '@/lib/database.types';
import { MIGRATIONS } from '@/lib/db/migrations';
import { runMigrations } from '@/lib/db/migrator';
import { toEpochMs } from '@/lib/sync/cursor';
import { pullHousehold } from '@/lib/sync/pull';
import {
  countingDatabase,
  createTestDatabase,
  type TestDatabase,
} from '../../../test/node-sqlite-adapter';

/**
 * Pull-Haelfte der Sync-Engine (#47) gegen die echte lokale Supabase-Instanz —
 * kein Mock. Braucht `supabase start`.
 */

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const SUPABASE_KEY = process.env.EXPO_PUBLIC_SUPABASE_KEY ?? '';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

let _admin: SupabaseClient<Database> | null = null;
function adminClient(): SupabaseClient<Database> {
  if (_admin) return _admin;
  if (!SERVICE_ROLE_KEY) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY fehlt.');
  }
  _admin = createClient<Database>(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return _admin;
}

function inMemoryStorage() {
  const data = new Map<string, string>();
  return {
    getItem: async (key: string) => data.get(key) ?? null,
    setItem: async (key: string, value: string) => {
      data.set(key, value);
    },
    removeItem: async (key: string) => {
      data.delete(key);
    },
  };
}

function makeClient(): SupabaseClient<Database> {
  return createClient<Database>(SUPABASE_URL, SUPABASE_KEY, {
    auth: { storage: inMemoryStorage(), autoRefreshToken: false, persistSession: true },
  });
}

function uniqueEmail() {
  return `pull-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
}

async function signUpAndCreateHousehold(client: SupabaseClient<Database>) {
  const email = uniqueEmail();
  const password = 'langgenug1';

  // Admin-Erstellung mit email_confirm:true statt client.auth.signUp():
  // seit enable_confirmations=true (config.toml) liefert signUp() erst nach
  // Klick auf den Bestaetigungslink eine Session. Diese Suite testet Pull,
  // nicht den Bestaetigungs-Flow.
  const { error: createError } = await adminClient().auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (createError) throw createError;

  const { error: signInError } = await client.auth.signInWithPassword({ email, password });
  if (signInError) throw signInError;

  const { data: householdId, error: hhError } = await client.rpc('create_household', {
    household_name: `Pull-Test ${email}`,
  });
  if (hhError) throw hhError;
  if (!householdId) throw new Error('create_household lieferte keine id');

  return householdId;
}

async function seedFridgeItems(
  client: SupabaseClient<Database>,
  householdId: string,
  count: number,
) {
  const CHUNK = 100;
  for (let start = 0; start < count; start += CHUNK) {
    const size = Math.min(CHUNK, count - start);
    const rows = Array.from({ length: size }, (_, i) => ({
      household_id: householdId,
      name: `Artikel ${start + i}`,
    }));
    const { error } = await client.from('fridge_items').insert(rows);
    if (error) throw error;
  }
}

describe('pullHousehold gegen die lokale Supabase-Instanz', () => {
  let db: TestDatabase;
  let client: SupabaseClient<Database>;
  let householdId: string;

  beforeAll(() => {
    if (!/^https?:\/\/(127\.0\.0\.1|localhost)(:|\/|$)/.test(SUPABASE_URL)) {
      throw new Error(`Nur gegen localhost erlaubt. Erhalten: ${SUPABASE_URL || '(leer)'}`);
    }
    if (!SUPABASE_KEY) {
      throw new Error('Kein ANON_KEY. Laeuft `supabase start`?');
    }
  });

  beforeEach(async () => {
    db = createTestDatabase();
    await runMigrations(db, MIGRATIONS);
    client = makeClient();
    householdId = await signUpAndCreateHousehold(client);
  }, 30_000);

  afterEach(() => {
    db.close();
  });

  it('paginiert ueber PAGE_SIZE hinaus und schreibt jede Zeile genau einmal', async () => {
    // 3 Lagerorte kommen schon aus create_household() (#39) — plus 520 hier.
    await seedFridgeItems(client, householdId, 520);

    const outcomes = await pullHousehold({
      db,
      supabase: client,
      householdIds: [householdId],
      clockCeilingMs: Date.now(),
      entities: ['fridge_items'],
    });

    const fridgeOutcome = outcomes.find((o) => o.entity === 'fridge_items');
    expect(fridgeOutcome?.pagesFetched).toBeGreaterThan(1);
    expect(fridgeOutcome?.rowsWritten).toBe(520);
    expect(fridgeOutcome?.rowsSkippedAsLocalWins).toBe(0);

    const row = await db.getFirstAsync<{ c: number }>(
      'select count(*) as c from fridge_items where household_id = ?',
      [householdId],
    );
    expect(row?.c).toBe(520);

    const distinctIds = await db.getFirstAsync<{ c: number }>(
      'select count(distinct id) as c from fridge_items where household_id = ?',
      [householdId],
    );
    expect(distinctIds?.c).toBe(520);
  }, 60_000);

  it('pullt Tombstones — ein remote geloeschter Artikel wird lokal als geloescht markiert', async () => {
    const { data: created } = await client
      .from('fridge_items')
      .insert({ household_id: householdId, name: 'Wird remote geloescht' })
      .select()
      .single();
    const id = created?.id as string;

    await pullHousehold({
      db,
      supabase: client,
      householdIds: [householdId],
      clockCeilingMs: Date.now(),
      entities: ['fridge_items'],
    });
    const beforeDelete = await db.getFirstAsync<{ deleted_at: number | null }>(
      'select deleted_at from fridge_items where id = ?',
      [id],
    );
    expect(beforeDelete?.deleted_at).toBeNull();

    await client.from('fridge_items').update({ deleted_at: new Date().toISOString() }).eq('id', id);

    await pullHousehold({
      db,
      supabase: client,
      householdIds: [householdId],
      clockCeilingMs: Date.now(),
      entities: ['fridge_items'],
    });

    const afterDelete = await db.getFirstAsync<{ deleted_at: number | null }>(
      'select deleted_at from fridge_items where id = ?',
      [id],
    );
    expect(afterDelete?.deleted_at).not.toBeNull();
  }, 30_000);

  it('dirty lokal + neueres remote -> resolve waehlt remote, _dirty wird zurueckgesetzt', async () => {
    const { data: created } = await client
      .from('fridge_items')
      .insert({ household_id: householdId, name: 'Original' })
      .select()
      .single();
    const id = created?.id as string;

    await pullHousehold({
      db,
      supabase: client,
      householdIds: [householdId],
      clockCeilingMs: Date.now(),
      entities: ['fridge_items'],
    });

    // Simuliert eine lokale, noch nicht gepushte Aenderung.
    await db.runAsync(
      "update fridge_items set _dirty = 1, name = 'Lokal (ausstehend)' where id = ?",
      [id],
    );

    // Remote-Update erzeugt ueber den Trigger einen neuen, garantiert
    // spaeteren Server-Zeitstempel als der lokal gespeicherte.
    await client.from('fridge_items').update({ name: 'Remote (neuer)' }).eq('id', id);

    await pullHousehold({
      db,
      supabase: client,
      householdIds: [householdId],
      // Weit in der Zukunft, damit die Klemmung den Vergleich nicht verfaelscht.
      clockCeilingMs: Date.now() + 10_000_000,
      entities: ['fridge_items'],
    });

    const row = await db.getFirstAsync<{ name: string; _dirty: number }>(
      'select name, _dirty from fridge_items where id = ?',
      [id],
    );
    expect(row?.name).toBe('Remote (neuer)');
    expect(row?._dirty).toBe(0);
  }, 30_000);

  it('dirty lokal + aelteres remote -> lokaler Wert bleibt erhalten', async () => {
    const { data: created } = await client
      .from('fridge_items')
      .insert({ household_id: householdId, name: 'Original' })
      .select()
      .single();
    const id = created?.id as string;
    const remoteUpdatedAtMs = toEpochMs(created?.updated_at ?? '');

    // Lokale Zeile existiert bereits, BEVOR je gepullt wurde — simuliert
    // einen Absturz nach `enqueueMutation`, aber vor dem ersten Sync. Der
    // Cursor steht noch am Anfang, die Zeile taucht also im ersten Pull auf
    // und trifft dort auf einen echten Konflikt.
    const localUpdatedAtMs = remoteUpdatedAtMs + 999_999_999;
    await db.runAsync(
      'insert into fridge_items (id, household_id, name, updated_at, _dirty) values (?, ?, ?, ?, 1)',
      [id, householdId, 'Nur lokal', localUpdatedAtMs],
    );

    const outcomes = await pullHousehold({
      db,
      supabase: client,
      householdIds: [householdId],
      // Klemmung liegt oberhalb des lokalen Zeitstempels, sonst wuerde sie
      // ihn kappen und den Test verfaelschen.
      clockCeilingMs: localUpdatedAtMs + 10_000_000,
      entities: ['fridge_items'],
    });

    const row = await db.getFirstAsync<{ name: string; _dirty: number }>(
      'select name, _dirty from fridge_items where id = ?',
      [id],
    );
    expect(row?.name).toBe('Nur lokal');
    expect(row?._dirty).toBe(1);

    const fridgeOutcome = outcomes.find((o) => o.entity === 'fridge_items');
    expect(fridgeOutcome?.rowsSkippedAsLocalWins).toBeGreaterThanOrEqual(1);
  }, 30_000);

  it('ein zweiter Pull ohne Aenderungen ist ein echtes No-Op (keine zusaetzlichen Schreibzugriffe)', async () => {
    await client.from('fridge_items').insert({ household_id: householdId, name: 'Einmalig' });

    await pullHousehold({
      db,
      supabase: client,
      householdIds: [householdId],
      clockCeilingMs: Date.now(),
      entities: ['fridge_items'],
    });

    const counted = countingDatabase(db);
    await pullHousehold({
      db: counted,
      supabase: client,
      householdIds: [householdId],
      clockCeilingMs: Date.now(),
      entities: ['fridge_items'],
    });

    expect(counted.executed).toEqual([]);
  }, 30_000);

  it('pullt households: der Nutzer sieht genau seinen eigenen Haushalt', async () => {
    const outcomes = await pullHousehold({
      db,
      supabase: client,
      householdIds: [],
      clockCeilingMs: Date.now(),
      entities: ['households'],
    });

    const outcome = outcomes.find((o) => o.entity === 'households');
    expect(outcome?.rowsWritten).toBe(1);

    const rows = await db.getAllAsync<{ id: string }>('select id from households');
    expect(rows.map((r) => r.id)).toEqual([householdId]);
  }, 30_000);

  it('pullt households: der Haushalt eines anderen Nutzers taucht nie lokal auf (RLS-Scoping)', async () => {
    const otherClient = makeClient();
    await signUpAndCreateHousehold(otherClient); // Haushalt B — der primaere Nutzer ist dort kein Mitglied

    await pullHousehold({
      db,
      supabase: client,
      householdIds: [],
      clockCeilingMs: Date.now(),
      entities: ['households'],
    });

    const rows = await db.getAllAsync<{ id: string }>('select id from households');
    expect(rows).toEqual([{ id: householdId }]);
  }, 30_000);

  it('reconcileOrphans entfernt households lokal, nachdem die Mitgliedschaft entzogen wurde', async () => {
    await pullHousehold({
      db,
      supabase: client,
      householdIds: [],
      clockCeilingMs: Date.now(),
      entities: ['households'],
    });
    expect(await db.getAllAsync('select id from households')).toHaveLength(1);

    const { data: userData, error: userErr } = await client.auth.getUser();
    if (userErr || !userData.user) throw userErr ?? new Error('kein user');

    // `guard_last_admin()` (03_households.sql) blockiert das Entfernen des
    // letzten Admins — realistisch, deshalb erst einen zweiten Admin
    // anlegen, bevor der primaere Nutzer seine eigene Mitgliedschaft verliert.
    const { data: secondUser, error: secondUserErr } = await adminClient().auth.admin.createUser({
      email: uniqueEmail(),
      password: 'langgenug1',
      email_confirm: true,
    });
    if (secondUserErr || !secondUser.user) throw secondUserErr ?? new Error('kein zweiter Nutzer');

    const { error: addAdminErr } = await adminClient()
      .from('household_members')
      .insert({ household_id: householdId, user_id: secondUser.user.id, role: 'admin' });
    if (addAdminErr) throw addAdminErr;

    const { error: removeErr } = await adminClient()
      .from('household_members')
      .delete()
      .eq('household_id', householdId)
      .eq('user_id', userData.user.id);
    if (removeErr) throw removeErr;

    await pullHousehold({
      db,
      supabase: client,
      householdIds: [],
      clockCeilingMs: Date.now(),
      entities: ['households'],
    });

    expect(await db.getAllAsync('select id from households')).toHaveLength(0);
  }, 30_000);

  it('reconcileOrphans entfernt eine lokale households-Zeile, die remote nicht (mehr) existiert', async () => {
    // Deckt denselben Reconciliation-Pfad ab wie ein hart geloeschter
    // Haushalt, ohne gegen `guard_last_admin()` zu laufen (der jede
    // Haushalts-Loeschung blockiert, sobald households_members kaskadiert —
    // ein vorbestehendes, von dieser Aenderung unabhaengiges Verhalten).
    await pullHousehold({
      db,
      supabase: client,
      householdIds: [],
      clockCeilingMs: Date.now(),
      entities: ['households'],
    });
    await db.runAsync(
      "insert into households (id, name, updated_at, _dirty) values ('00000000-0000-0000-0000-00000000dead', 'Nie remote existent', ?, 0)",
      [Date.now()],
    );
    expect(await db.getAllAsync('select id from households')).toHaveLength(2);

    await pullHousehold({
      db,
      supabase: client,
      householdIds: [],
      clockCeilingMs: Date.now(),
      entities: ['households'],
    });

    const rows = await db.getAllAsync<{ id: string }>('select id from households');
    expect(rows).toEqual([{ id: householdId }]);
  }, 30_000);

  it('Bootstrap auf zweitem Geraet: eine bereits gepushte Praeferenz erscheint auf einem frischen lokalen Spiegel (#223 Paket 3)', async () => {
    const id = preferenceId({ householdId, keyType: 'name', normalizedKeyValue: 'hafermilch' });
    const { data: created, error: seedError } = await client
      .from('shopping_category_preferences')
      .insert({
        id,
        household_id: householdId,
        key_type: 'name',
        normalized_key_value: 'hafermilch',
        category_id: 'dairy',
      })
      .select()
      .single();
    expect(seedError).toBeNull();

    // "Zweites Geraet": ein komplett frischer lokaler Spiegel fuer denselben Haushalt.
    const secondDeviceDb = createTestDatabase();
    await runMigrations(secondDeviceDb, MIGRATIONS);

    const outcomes = await pullHousehold({
      db: secondDeviceDb,
      supabase: client,
      householdIds: [householdId],
      clockCeilingMs: Date.now(),
      entities: ['shopping_category_preferences'],
    });

    const outcome = outcomes.find((o) => o.entity === 'shopping_category_preferences');
    expect(outcome?.rowsWritten).toBe(1);

    expect(created?.id).toBe(id);
    const row = await secondDeviceDb.getFirstAsync<{
      category_id: string | null;
      deleted_at: number | null;
    }>('select category_id, deleted_at from shopping_category_preferences where id = ?', [id]);
    expect(row).toEqual({ category_id: 'dairy', deleted_at: null });

    secondDeviceDb.close();
  }, 30_000);
});
