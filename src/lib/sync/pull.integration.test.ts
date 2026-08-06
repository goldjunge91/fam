import { createClient, type SupabaseClient } from '@supabase/supabase-js';

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
  const { error: signUpError } = await client.auth.signUp({ email, password: 'langgenug1' });
  if (signUpError) throw signUpError;

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
});
