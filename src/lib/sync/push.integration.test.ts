import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '@/lib/database.types';
import { MIGRATIONS } from '@/lib/db/migrations';
import { runMigrations } from '@/lib/db/migrator';
import type { Entity, OutboxOp } from '@/lib/db/types';
import { MAX_ATTEMPTS } from '@/lib/sync/backoff';
import { pushOutbox } from '@/lib/sync/push';
import { createTestDatabase, type TestDatabase } from '../../../test/node-sqlite-adapter';

/**
 * Push-Haelfte der Sync-Engine (#47) gegen die echte lokale Supabase-Instanz —
 * kein Mock, kein Fake-Server. Braucht `supabase start`.
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
  return `push-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
}

async function signUpAndCreateHousehold(client: SupabaseClient<Database>) {
  const email = uniqueEmail();
  const { error: signUpError } = await client.auth.signUp({ email, password: 'langgenug1' });
  if (signUpError) throw signUpError;

  const { data: householdId, error: hhError } = await client.rpc('create_household', {
    household_name: `Push-Test ${email}`,
  });
  if (hhError) throw hhError;
  if (!householdId) throw new Error('create_household lieferte keine id');

  return householdId;
}

async function insertOutboxRow(
  db: TestDatabase,
  row: {
    entity: Entity;
    entityId: string;
    op: OutboxOp;
    payload: Record<string, unknown>;
    createdAt?: number;
    attempts?: number;
    nextAttemptAt?: number;
  },
) {
  const result = await db.runAsync(
    'insert into outbox (entity, entity_id, op, payload, created_at, attempts, next_attempt_at) values (?, ?, ?, ?, ?, ?, ?)',
    [
      row.entity,
      row.entityId,
      row.op,
      JSON.stringify(row.payload),
      row.createdAt ?? 1,
      row.attempts ?? 0,
      row.nextAttemptAt ?? 0,
    ],
  );
  return result.lastInsertRowId;
}

describe('pushOutbox gegen die lokale Supabase-Instanz', () => {
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

  it('pusht ein insert, ignoriert client-gesendetes updated_at, upserted die Server-Zeile lokal', async () => {
    const localId = crypto.randomUUID();
    await insertOutboxRow(db, {
      entity: 'storage_locations',
      entityId: localId,
      op: 'insert',
      payload: {
        id: localId,
        household_id: householdId,
        name: 'Camping-Kühlbox',
        kind: 'fridge',
        sort_order: 99,
        // Absichtlich eine offensichtlich falsche Zeitangabe — buildInsertPayload
        // muss sie herausfiltern, sonst wuerde die Zeile mit diesem Wert
        // angelegt (kein BEFORE INSERT-Trigger faengt das serverseitig ab).
        updated_at: 999_999,
        deleted_at: null,
        _dirty: 1,
      },
    });

    const result = await pushOutbox({ db, supabase: client });

    expect(result.stoppedEarly).toBe(false);
    expect(result.outcomes).toEqual([
      {
        kind: 'pushed',
        entity: 'storage_locations',
        entityId: localId,
        sourceIds: [expect.any(Number)],
      },
    ]);

    const remote = await client
      .from('storage_locations')
      .select('id, name, updated_at')
      .eq('id', localId)
      .single();
    expect(remote.error).toBeNull();
    expect(remote.data?.name).toBe('Camping-Kühlbox');
    // Server-Zeitstempel liegt nahe "jetzt", nicht bei der gesendeten Fantasiezahl.
    const serverUpdatedAtMs = new Date(remote.data?.updated_at ?? 0).getTime();
    expect(Math.abs(Date.now() - serverUpdatedAtMs)).toBeLessThan(60_000);

    const localRow = await db.getFirstAsync<{ name: string; _dirty: number }>(
      'select name, _dirty from storage_locations where id = ?',
      [localId],
    );
    expect(localRow?.name).toBe('Camping-Kühlbox');
    expect(localRow?._dirty).toBe(0);

    const remainingOutbox = await db.getAllAsync('select * from outbox');
    expect(remainingOutbox).toEqual([]);
  }, 30_000);

  it('pusht ein update mit nur den geaenderten Feldern', async () => {
    const { data: created } = await client
      .from('storage_locations')
      .insert({ household_id: householdId, name: 'Alter Name', kind: 'pantry' })
      .select()
      .single();
    const remoteId = created?.id as string;

    await insertOutboxRow(db, {
      entity: 'storage_locations',
      entityId: remoteId,
      op: 'update',
      payload: { id: remoteId, name: 'Neuer Name' },
    });

    const result = await pushOutbox({ db, supabase: client });
    expect(result.outcomes[0]).toMatchObject({ kind: 'pushed' });

    const remote = await client
      .from('storage_locations')
      .select('name, kind')
      .eq('id', remoteId)
      .single();
    expect(remote.data?.name).toBe('Neuer Name');
    // Nicht mitgeschickte Felder bleiben unveraendert.
    expect(remote.data?.kind).toBe('pantry');
  }, 30_000);

  it('pusht ein delete als Soft-Delete-Update', async () => {
    const { data: created } = await client
      .from('storage_locations')
      .insert({ household_id: householdId, name: 'Wird geloescht', kind: 'freezer' })
      .select()
      .single();
    const remoteId = created?.id as string;

    await insertOutboxRow(db, {
      entity: 'storage_locations',
      entityId: remoteId,
      op: 'delete',
      payload: { id: remoteId },
    });

    const result = await pushOutbox({ db, supabase: client });
    expect(result.outcomes[0]).toMatchObject({ kind: 'pushed' });

    const remote = await client
      .from('storage_locations')
      .select('deleted_at')
      .eq('id', remoteId)
      .single();
    expect(remote.data?.deleted_at).not.toBeNull();

    const localRow = await db.getFirstAsync<{ deleted_at: number | null }>(
      'select deleted_at from storage_locations where id = ?',
      [remoteId],
    );
    expect(localRow?.deleted_at).not.toBeNull();
  }, 30_000);

  it('products lehnt delete sofort ab, ohne Netzwerkaufruf — kein Server-Tombstone', async () => {
    const productId = crypto.randomUUID();
    await insertOutboxRow(db, {
      entity: 'products',
      entityId: productId,
      op: 'delete',
      payload: { id: productId },
    });

    const result = await pushOutbox({ db, supabase: client });

    expect(result.outcomes[0]).toMatchObject({ kind: 'failed-permanent', entity: 'products' });
    expect(result.stoppedEarly).toBe(false);

    const raw = await db.getFirstAsync<{ attempts: number }>(
      'select attempts from outbox where entity_id = ?',
      [productId],
    );
    expect(raw?.attempts).toBe(MAX_ATTEMPTS);
  }, 30_000);

  it('ein insert-Konflikt (23505) faellt auf ein update zurueck und gilt als Erfolg', async () => {
    // Simuliert: Netzwerkaufruf war beim ersten Versuch erfolgreich, der
    // lokale Commit kam vorher nicht mehr zustande. Zeile existiert also
    // schon serverseitig unter derselben id.
    const remoteId = crypto.randomUUID();
    const { error: preInsertError } = await client.from('storage_locations').insert({
      id: remoteId,
      household_id: householdId,
      name: 'Bereits angekommen',
      kind: 'fridge',
    });
    expect(preInsertError).toBeNull();

    await insertOutboxRow(db, {
      entity: 'storage_locations',
      entityId: remoteId,
      op: 'insert',
      payload: {
        id: remoteId,
        household_id: householdId,
        name: 'Bereits angekommen, erneut versucht',
        kind: 'fridge',
      },
    });

    const result = await pushOutbox({ db, supabase: client });
    expect(result.outcomes[0]).toMatchObject({ kind: 'pushed' });

    const remote = await client
      .from('storage_locations')
      .select('name')
      .eq('id', remoteId)
      .single();
    expect(remote.data?.name).toBe('Bereits angekommen, erneut versucht');
  }, 30_000);

  it('eine RLS-Verletzung (insert in fremden Haushalt) ist permanent, terminal nach einem Versuch', async () => {
    const otherClient = makeClient();
    const otherHouseholdId = await signUpAndCreateHousehold(otherClient);

    const localId = crypto.randomUUID();
    await insertOutboxRow(db, {
      entity: 'fridge_items',
      entityId: localId,
      op: 'insert',
      payload: {
        id: localId,
        // client ist nicht Mitglied von otherHouseholdId -> RLS with check schlaegt fehl.
        household_id: otherHouseholdId,
        name: 'Fremder Haushalt',
        quantity: 1,
        unit: 'piece',
      },
    });

    const result = await pushOutbox({ db, supabase: client });

    expect(result.stoppedEarly).toBe(false);
    expect(result.outcomes[0]).toMatchObject({ kind: 'failed-permanent', entity: 'fridge_items' });

    const raw = await db.getFirstAsync<{ attempts: number; next_attempt_at: number }>(
      'select attempts, next_attempt_at from outbox where entity_id = ?',
      [localId],
    );
    expect(raw?.attempts).toBe(MAX_ATTEMPTS);
    expect(raw?.next_attempt_at).toBe(Number.MAX_SAFE_INTEGER);
  }, 30_000);

  it('ein update gegen eine fuer den Client unsichtbare Zeile ist permanent (RLS filtert still, kein Fehler)', async () => {
    const otherClient = makeClient();
    const otherHouseholdId = await signUpAndCreateHousehold(otherClient);
    const { data: foreignRow } = await otherClient
      .from('storage_locations')
      .insert({ household_id: otherHouseholdId, name: 'Fremd', kind: 'fridge' })
      .select()
      .single();
    const foreignId = foreignRow?.id as string;

    await insertOutboxRow(db, {
      entity: 'storage_locations',
      entityId: foreignId,
      op: 'update',
      payload: { id: foreignId, name: 'Uebernahmeversuch' },
    });

    const result = await pushOutbox({ db, supabase: client });

    expect(result.outcomes[0]).toMatchObject({ kind: 'failed-permanent' });
    expect(result.stoppedEarly).toBe(false);
  }, 30_000);

  it('ein transienter Netzwerkfehler stoppt den Lauf und wird nach MAX_ATTEMPTS terminal', async () => {
    // Unerreichbare URL simuliert Flugmodus/DNS-Fehler -> postgrest-js liefert
    // status: 0. classifyError(null) muss das als transient einordnen.
    const unreachableClient = createClient<Database>('http://127.0.0.1:1', SUPABASE_KEY, {
      auth: { storage: inMemoryStorage(), autoRefreshToken: false, persistSession: false },
    });

    const localId = crypto.randomUUID();
    await insertOutboxRow(db, {
      entity: 'storage_locations',
      entityId: localId,
      op: 'insert',
      payload: { id: localId, household_id: householdId, name: 'Offline erstellt', kind: 'fridge' },
    });

    let clock = 1_000;
    let lastResult: Awaited<ReturnType<typeof pushOutbox>> | null = null;

    for (let i = 0; i < MAX_ATTEMPTS; i++) {
      lastResult = await pushOutbox({
        db,
        supabase: unreachableClient,
        now: () => clock,
      });
      expect(lastResult.stoppedEarly).toBe(true);
      expect(lastResult.outcomes[0]).toMatchObject({ kind: 'failed-transient' });
      // Weiter als der maximale Backoff (5 min), damit der naechste Aufruf
      // den Eintrag garantiert wieder als faellig sieht.
      clock += 301_000;
    }

    const raw = await db.getFirstAsync<{ attempts: number; next_attempt_at: number }>(
      'select attempts, next_attempt_at from outbox where entity_id = ?',
      [localId],
    );
    expect(raw?.attempts).toBe(MAX_ATTEMPTS);
    expect(raw?.next_attempt_at).toBe(Number.MAX_SAFE_INTEGER);

    // Terminal: taucht in keinem weiteren Lauf mehr auf, selbst mit riesigem now.
    const finalResult = await pushOutbox({ db, supabase: unreachableClient, now: () => clock });
    expect(finalResult.outcomes).toEqual([]);
  }, 60_000);

  it('ein leerer Outbox-Lauf ist ein No-Op', async () => {
    const result = await pushOutbox({ db, supabase: client });
    expect(result).toEqual({ outcomes: [], stoppedEarly: false });
  }, 30_000);
});
