import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import { preferenceId } from '@/features/shopping-list/preferences/preference-identity.node';
import type { Database } from '@/lib/database.types';
import { runDrizzleMigrations } from '@/lib/db/drizzle-migrator';
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
  return `push-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
}

async function signUpAndCreateHousehold(client: SupabaseClient<Database>) {
  const email = uniqueEmail();
  const password = 'langgenug1';

  // Admin-Erstellung mit email_confirm:true statt client.auth.signUp():
  // seit enable_confirmations=true (config.toml) liefert signUp() erst nach
  // Klick auf den Bestaetigungslink eine Session. Diese Suite testet Push,
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
    await runDrizzleMigrations(db);
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

  it('pusht ein restore, das deleted_at serverseitig und lokal wieder auf null setzt (#69)', async () => {
    const { data: created } = await client
      .from('fridge_items')
      .insert({
        household_id: householdId,
        name: 'Wird wiederhergestellt',
        quantity: 1,
        unit: 'piece',
      })
      .select()
      .single();
    const remoteId = created?.id as string;

    await client
      .from('fridge_items')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', remoteId);

    await insertOutboxRow(db, {
      entity: 'fridge_items',
      entityId: remoteId,
      op: 'restore',
      payload: { id: remoteId, household_id: householdId, deleted_at: null },
    });

    const result = await pushOutbox({ db, supabase: client });
    expect(result.outcomes[0]).toMatchObject({ kind: 'pushed' });

    const remote = await client
      .from('fridge_items')
      .select('deleted_at')
      .eq('id', remoteId)
      .single();
    expect(remote.data?.deleted_at).toBeNull();
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

  it('pusht einen Move als RPC atomar, ist retry-idempotent und laesst keinen halben Move zu', async () => {
    const locations = await client
      .from('storage_locations')
      .select('id, kind')
      .eq('household_id', householdId)
      .in('kind', ['fridge', 'pantry']);
    expect(locations.error).toBeNull();
    const oldLocationId = locations.data?.find((location) => location.kind === 'fridge')?.id;
    const newLocationId = locations.data?.find((location) => location.kind === 'pantry')?.id;
    expect(oldLocationId).toBeDefined();
    expect(newLocationId).toBeDefined();

    const itemId = crypto.randomUUID();
    const { error: itemError } = await client.from('fridge_items').insert({
      id: itemId,
      household_id: householdId,
      location_id: oldLocationId,
      name: 'Move-Milch',
      quantity: 2,
      unit: 'piece',
    });
    expect(itemError).toBeNull();

    await db.runAsync(
      `insert into fridge_items
         (id, household_id, location_id, name, quantity, unit, created_at,
          opened_at, vacuum_sealed, expiry_user_set, updated_at, _dirty)
       values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [itemId, householdId, oldLocationId ?? null, 'Move-Milch', 2, 'piece', 1, null, 0, 0, 1, 1],
    );

    const operationId = crypto.randomUUID();
    const outTransactionId = crypto.randomUUID();
    const inTransactionId = crypto.randomUUID();
    const createdAt = new Date().toISOString();
    const payload = {
      operation_id: operationId,
      item_id: itemId,
      household_id: householdId,
      expected_location_id: oldLocationId ?? null,
      new_location_id: newLocationId ?? null,
      expected_quantity: 2,
      out_transaction_id: outTransactionId,
      in_transaction_id: inTransactionId,
      created_at: createdAt,
    };

    for (const [id, type, locationId] of [
      [outTransactionId, 'out', oldLocationId],
      [inTransactionId, 'in', newLocationId],
    ] as const) {
      await db.runAsync(
        `insert into transactions
           (id, operation_id, household_id, fridge_item_id, type, quantity,
            location_id, undone, created_at, updated_at, _dirty)
         values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, operationId, householdId, itemId, type, 2, locationId ?? null, 0, createdAt, 1, 1],
      );
    }

    await insertOutboxRow(db, {
      entity: 'fridge_items',
      entityId: itemId,
      op: 'move',
      payload,
    });

    const firstResult = await pushOutbox({ db, supabase: client });
    expect(firstResult.outcomes[0]).toMatchObject({
      kind: 'pushed',
      entity: 'fridge_items',
      entityId: itemId,
    });

    const remoteItem = await client
      .from('fridge_items')
      .select('location_id')
      .eq('id', itemId)
      .single();
    expect(remoteItem.data?.location_id).toBe(newLocationId);
    const remoteLedger = await client
      .from('transactions')
      .select('id, type, operation_id')
      .eq('operation_id', operationId)
      .order('type');
    expect(remoteLedger.data).toHaveLength(2);
    expect(remoteLedger.data?.map((row) => row.type)).toEqual(['in', 'out']);

    const localLedger = await db.getAllAsync<{ id: string; _dirty: number }>(
      'select id, _dirty from transactions where operation_id = ? order by id',
      [operationId],
    );
    expect(localLedger).toEqual(
      [
        { id: inTransactionId, _dirty: 0 },
        { id: outTransactionId, _dirty: 0 },
      ].sort((left, right) => left.id.localeCompare(right.id)),
    );
    expect(await db.getAllAsync('select * from outbox')).toEqual([]);

    // Ein verlorener HTTP-Response wird durch denselben operation_id-Schlüssel
    // sicher erneut abgeschlossen, ohne weitere Ledgerzeilen anzulegen.
    await insertOutboxRow(db, {
      entity: 'fridge_items',
      entityId: itemId,
      op: 'move',
      payload,
      createdAt: 2,
    });
    const retryResult = await pushOutbox({ db, supabase: client });
    expect(retryResult.outcomes[0]).toMatchObject({ kind: 'pushed' });
    const retryLedger = await client
      .from('transactions')
      .select('id')
      .eq('operation_id', operationId);
    expect(retryLedger.data).toHaveLength(2);

    // Der erste INSERT kollidiert absichtlich mit der bereits verwendeten
    // Ledger-ID. Der RPC hat zu diesem Zeitpunkt den Bestand schon angefasst;
    // die Remote-Assertion beweist den Rollback der gesamten Funktion.
    const failedOperationId = crypto.randomUUID();
    await insertOutboxRow(db, {
      entity: 'fridge_items',
      entityId: itemId,
      op: 'move',
      payload: {
        ...payload,
        operation_id: failedOperationId,
        expected_location_id: newLocationId,
        new_location_id: null,
        out_transaction_id: outTransactionId,
        in_transaction_id: crypto.randomUUID(),
      },
      createdAt: 3,
    });
    const failedResult = await pushOutbox({ db, supabase: client });
    expect(failedResult.outcomes[0]).toMatchObject({ kind: 'failed-permanent' });

    const unchangedItem = await client
      .from('fridge_items')
      .select('location_id')
      .eq('id', itemId)
      .single();
    expect(unchangedItem.data?.location_id).toBe(newLocationId);
    const failedLedger = await client
      .from('transactions')
      .select('id')
      .eq('operation_id', failedOperationId);
    expect(failedLedger.data).toEqual([]);
  }, 30_000);

  it('pusht eine Mengenänderung als Delta mit Ledgerbuchung und wiederholt sie idempotent', async () => {
    const itemId = crypto.randomUUID();
    const { error: itemError } = await client.from('fridge_items').insert({
      id: itemId,
      household_id: householdId,
      name: 'Delta-Milch',
      quantity: 5,
      unit: 'piece',
    });
    expect(itemError).toBeNull();

    await db.runAsync(
      `insert into fridge_items
         (id, household_id, name, quantity, unit, created_at, updated_at, _dirty)
       values (?, ?, ?, ?, ?, ?, ?, ?)`,
      [itemId, householdId, 'Delta-Milch', 3, 'piece', 1, 1, 1],
    );

    const operationId = crypto.randomUUID();
    const transactionId = crypto.randomUUID();
    const createdAt = new Date().toISOString();
    const payload = {
      operation_id: operationId,
      transaction_id: transactionId,
      item_id: itemId,
      household_id: householdId,
      delta: -2,
      created_at: createdAt,
    };

    await db.runAsync(
      `insert into transactions
         (id, operation_id, household_id, fridge_item_id, type, quantity,
          location_id, undone, created_at, updated_at, _dirty)
       values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [transactionId, operationId, householdId, itemId, 'out', 2, null, 0, createdAt, 1, 1],
    );
    await insertOutboxRow(db, {
      entity: 'fridge_items',
      entityId: itemId,
      op: 'adjust_quantity',
      payload,
    });

    const firstResult = await pushOutbox({ db, supabase: client });
    expect(firstResult.outcomes[0]).toMatchObject({
      kind: 'pushed',
      entity: 'fridge_items',
      entityId: itemId,
    });
    const remoteItem = await client
      .from('fridge_items')
      .select('quantity')
      .eq('id', itemId)
      .single();
    expect(remoteItem.data?.quantity).toBe(3);
    const remoteLedger = await client
      .from('transactions')
      .select('id, type, quantity')
      .eq('id', transactionId)
      .single();
    expect(remoteLedger.data).toMatchObject({ id: transactionId, type: 'out', quantity: 2 });
    expect(
      await db.getFirstAsync<{ quantity: number; dirty: number }>(
        'select quantity, _dirty as dirty from fridge_items where id = ?',
        [itemId],
      ),
    ).toEqual({ quantity: 3, dirty: 0 });

    await insertOutboxRow(db, {
      entity: 'fridge_items',
      entityId: itemId,
      op: 'adjust_quantity',
      payload,
      createdAt: 2,
    });
    const retryResult = await pushOutbox({ db, supabase: client });
    expect(retryResult.outcomes[0]).toMatchObject({ kind: 'pushed' });
    expect(
      (await client.from('transactions').select('id').eq('id', transactionId)).data,
    ).toHaveLength(1);
  }, 30_000);

  it('ein leerer Outbox-Lauf ist ein No-Op', async () => {
    const result = await pushOutbox({ db, supabase: client });
    expect(result).toEqual({ outcomes: [], stoppedEarly: false });
  }, 30_000);

  describe('shopping_category_preferences (#223 Paket 3)', () => {
    it('durchlaeuft insert, update und delete wie jede andere Spiegeltabelle', async () => {
      const id = preferenceId({ householdId, keyType: 'name', normalizedKeyValue: 'hafermilch' });

      await insertOutboxRow(db, {
        entity: 'shopping_category_preferences',
        entityId: id,
        op: 'insert',
        payload: {
          id,
          household_id: householdId,
          key_type: 'name',
          normalized_key_value: 'hafermilch',
          category_id: 'dairy',
          created_by: null,
        },
      });
      expect((await pushOutbox({ db, supabase: client })).outcomes[0]).toMatchObject({
        kind: 'pushed',
      });

      let remote = await client
        .from('shopping_category_preferences')
        .select('category_id, deleted_at')
        .eq('id', id)
        .single();
      expect(remote.data).toMatchObject({ category_id: 'dairy', deleted_at: null });

      await insertOutboxRow(db, {
        entity: 'shopping_category_preferences',
        entityId: id,
        op: 'update',
        payload: { id, category_id: 'beverages' },
        createdAt: 2,
      });
      expect((await pushOutbox({ db, supabase: client })).outcomes[0]).toMatchObject({
        kind: 'pushed',
      });

      remote = await client
        .from('shopping_category_preferences')
        .select('category_id, deleted_at')
        .eq('id', id)
        .single();
      expect(remote.data?.category_id).toBe('beverages');

      await insertOutboxRow(db, {
        entity: 'shopping_category_preferences',
        entityId: id,
        op: 'delete',
        payload: { id, household_id: householdId },
        createdAt: 3,
      });
      expect((await pushOutbox({ db, supabase: client })).outcomes[0]).toMatchObject({
        kind: 'pushed',
      });

      remote = await client
        .from('shopping_category_preferences')
        .select('category_id, deleted_at')
        .eq('id', id)
        .single();
      expect(remote.data?.deleted_at).not.toBeNull();
    }, 30_000);

    it('reaktiviert eine soft-deletete Praeferenz UND setzt in einem Push die neue category_id (restore mergt Payload, #223)', async () => {
      const id = preferenceId({ householdId, keyType: 'name', normalizedKeyValue: 'apfelsaft' });

      const { error: seedError } = await client.from('shopping_category_preferences').insert({
        id,
        household_id: householdId,
        key_type: 'name',
        normalized_key_value: 'apfelsaft',
        category_id: 'produce',
        deleted_at: new Date().toISOString(),
      });
      expect(seedError).toBeNull();

      // So sieht der Payload aus, wenn `api.ts`s restore- und update-Eintrag
      // vor dem naechsten Push zu einer coalesce()-Gruppe verschmelzen:
      // group.op bleibt 'restore', aber category_id ist bereits eingemischt.
      await insertOutboxRow(db, {
        entity: 'shopping_category_preferences',
        entityId: id,
        op: 'restore',
        payload: { id, household_id: householdId, category_id: 'beverages', deleted_at: null },
      });

      const result = await pushOutbox({ db, supabase: client });
      expect(result.outcomes[0]).toMatchObject({ kind: 'pushed' });

      const remote = await client
        .from('shopping_category_preferences')
        .select('category_id, deleted_at')
        .eq('id', id)
        .single();
      expect(remote.data).toMatchObject({ category_id: 'beverages', deleted_at: null });
    }, 30_000);

    it('parallele Offline-Anlage derselben natuerlichen Praeferenz erzeugt kein fatales 23505, sondern gewinnt per Fallback-Update', async () => {
      const id = preferenceId({ householdId, keyType: 'name', normalizedKeyValue: 'vollmilch' });

      // Simuliert ein zweites Geraet, das denselben natuerlichen Schluessel
      // offline bereits gepusht hat, bevor dieses Geraet online geht — dank
      // deterministischer UUIDv5 identische id, siehe preference-identity.ts.
      const { error: otherDeviceError } = await client
        .from('shopping_category_preferences')
        .insert({
          id,
          household_id: householdId,
          key_type: 'name',
          normalized_key_value: 'vollmilch',
          category_id: 'dairy',
        });
      expect(otherDeviceError).toBeNull();

      await insertOutboxRow(db, {
        entity: 'shopping_category_preferences',
        entityId: id,
        op: 'insert',
        payload: {
          id,
          household_id: householdId,
          key_type: 'name',
          normalized_key_value: 'vollmilch',
          category_id: 'breakfast',
          created_by: null,
        },
      });

      const result = await pushOutbox({ db, supabase: client });
      expect(result.outcomes[0]).toMatchObject({ kind: 'pushed' });

      const remote = await client
        .from('shopping_category_preferences')
        .select('category_id')
        .eq('id', id)
        .single();
      expect(remote.data?.category_id).toBe('breakfast');

      const raw = await db.getFirstAsync<{ attempts: number }>(
        'select attempts from outbox where entity_id = ?',
        [id],
      );
      expect(raw).toBeNull();
    }, 30_000);
  });
});
