import { runDrizzleMigrations } from '@/lib/db/drizzle-migrator';
import { MIGRATIONS } from '@/lib/db/migrations';
import { runMigrations } from '@/lib/db/migrator';
import { enqueueMutation, recordOutboxOutcome } from '@/lib/db/outbox';
import type { TypedSupabaseClient } from '@/lib/supabase';
import { MAX_ATTEMPTS } from '@/lib/sync/backoff';
import {
  createInventoryMergeUndoMutation,
  createInventoryQuantityCorrectionMutation,
  createInventoryQuantityMutation,
  createInventorySplitMutation,
} from '@/lib/sync/inventory-quantity';
import { applyLocalMirrorWrite } from '@/lib/sync/mirror-write';
import { pushOutbox } from '@/lib/sync/push';
import { createTestDatabase, type TestDatabase } from '../../../test/node-sqlite-adapter';

/**
 * Generischer Dispatch-Test fuer `EntityMeta.onForeignKeyViolation` (#192):
 * belegt, dass `push.ts` bei einem Fehler ausschliesslich den registrierten
 * Resolver befragt und dessen Antwort fuer den Retry uebernimmt — ohne
 * irgendein Wissen ueber Tabellennamen oder Fehlercodes der konkreten
 * Entitaet. Nutzt `fridge_items` als real registrierte Entitaet (der einzige
 * aktuell registrierte Resolver), pruefend also gleichzeitig, dass die
 * Registrierung in `entities.ts` tatsaechlich greift.
 */
function fridgeItemsUpdateResponses(
  responses: {
    data: Record<string, unknown>[] | null;
    error: { code?: string; message: string } | null;
  }[],
) {
  const select = jest.fn();
  for (const response of responses)
    select.mockResolvedValueOnce({ ...response, status: response.error ? 409 : 200 });
  const eq = jest.fn().mockReturnValue({ select });
  return jest.fn().mockReturnValue({ eq });
}

function storageLocationsInsertOk() {
  const select = jest.fn().mockResolvedValue({ data: null, error: null, status: 201 });
  return jest.fn().mockReturnValue({ select });
}

describe('pushOutbox — generischer onForeignKeyViolation-Dispatch', () => {
  let db: TestDatabase;

  beforeEach(async () => {
    db = createTestDatabase();
    await runMigrations(db, MIGRATIONS);
    await runDrizzleMigrations(db);
    await db.runAsync(
      `insert into fridge_items
       (id, household_id, location_id, name, quantity, unit, added_by, created_at,
        opened_at, vacuum_sealed, expiry_user_set, updated_at)
       values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        'item-1',
        'hh-1',
        'loc-1',
        'Milch',
        1,
        'stk',
        'user-1',
        '2026-01-01T00:00:00Z',
        null,
        0,
        0,
        0,
      ],
    );
    await db.runAsync(
      'insert into storage_locations (id, household_id, name, kind, sort_order, created_at, updated_at) values (?, ?, ?, ?, ?, ?, ?)',
      ['loc-1', 'hh-1', 'Kühlschrank', 'fridge', 0, '2026-01-01T00:00:00Z', 0],
    );
    await enqueueMutation(db, {
      entity: 'fridge_items',
      entityId: 'item-1',
      op: 'update',
      payload: {
        id: 'item-1',
        location_id: 'loc-1',
        location_kind: 'fridge',
        location_name: 'Kühlschrank',
        quantity: 2,
      },
      now: 10,
      applyLocally: async () => {},
    });
  });

  afterEach(() => db.close());

  it('ruft den registrierten Resolver bei einem Fehler auf und uebernimmt den reparierten Payload fuer den Retry', async () => {
    const fkError = { code: '23503', message: 'violates foreign key constraint' };
    const update = fridgeItemsUpdateResponses([
      { data: null, error: fkError },
      {
        data: [
          {
            id: 'item-1',
            household_id: 'hh-1',
            location_id: 'loc-1',
            name: 'Milch',
            quantity: 2,
            unit: 'stk',
            added_by: 'user-1',
            created_at: '2026-01-01T00:00:00Z',
            opened_at: null,
            vacuum_sealed: false,
            expiry_user_set: false,
            updated_at: '2026-01-01T00:00:01Z',
            deleted_at: null,
          },
        ],
        error: null,
      },
    ]);
    const insert = storageLocationsInsertOk();
    const from = jest.fn((table: string) =>
      table === 'storage_locations' ? { insert } : { update },
    );
    const client = { from } as unknown as TypedSupabaseClient;

    const result = await pushOutbox({ db, supabase: client, now: () => 12_345 });

    expect(result.outcomes[0]).toMatchObject({ kind: 'pushed', entity: 'fridge_items' });
    // Resolver hat den lokal vorhandenen Lagerort nachgepusht, dann wurde
    // fridge_items ein zweites Mal versucht (Repair + Retry).
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ id: 'loc-1' }));
    expect(update).toHaveBeenCalledTimes(2);
    expect(update.mock.calls[0][0]).not.toHaveProperty('location_kind');
    expect(update.mock.calls[0][0]).not.toHaveProperty('location_name');
  });

  it('klassifiziert den Fehler wie gewohnt, wenn der Resolver nicht reparieren kann (kein FK-Fehler)', async () => {
    const otherError = { code: '23505', message: 'duplicate key' };
    const update = fridgeItemsUpdateResponses([{ data: null, error: otherError }]);
    const from = jest.fn().mockReturnValue({ update });
    const client = { from } as unknown as TypedSupabaseClient;

    const result = await pushOutbox({ db, supabase: client, now: () => 12_345 });

    expect(result.outcomes[0]).toMatchObject({ kind: 'failed-permanent', entity: 'fridge_items' });
    // Resolver wurde aufgerufen (jeder Fehler geht an ihn), hat aber nicht
    // reparieren koennen -> keinen zweiten Versuch ausgeloest.
    expect(update).toHaveBeenCalledTimes(1);
  });
});

describe('pushOutbox — medizinische Einheiten', () => {
  it('sendet unit "units" unveraendert an Supabase', async () => {
    const db = createTestDatabase();
    await runMigrations(db, MIGRATIONS);
    await runDrizzleMigrations(db);

    const remoteRow = {
      id: 'med-1',
      user_id: 'user-1',
      child_profile_id: null,
      medication_name: 'Insulin',
      dose: 4,
      unit: 'units',
      injection_site: null,
      administered_at: '2026-08-30T10:00:00.000Z',
      notes: null,
      created_at: '2026-08-30T10:00:00.000Z',
      updated_at: '2026-08-30T10:00:01.000Z',
      deleted_at: null,
    };
    const select = jest.fn().mockResolvedValue({ data: [remoteRow], error: null, status: 201 });
    const insert = jest.fn().mockReturnValue({ select });
    const client = {
      from: jest.fn().mockReturnValue({ insert }),
    } as unknown as TypedSupabaseClient;

    await enqueueMutation(db, {
      entity: 'medication_logs',
      entityId: 'med-1',
      op: 'insert',
      payload: remoteRow,
      now: 1,
      applyLocally: async () => {},
    });

    try {
      await pushOutbox({ db, supabase: client, now: () => 2 });

      expect(insert).toHaveBeenCalledWith(expect.objectContaining({ unit: 'units' }));
    } finally {
      db.close();
    }
  });
});

describe('pushOutbox — append-only Ledger', () => {
  it('behandelt einen wiederholten Ledger-insert idempotent ohne UPDATE-Versuch', async () => {
    const db = createTestDatabase();
    await runMigrations(db, MIGRATIONS);
    await runDrizzleMigrations(db);

    const transactionId = 'txn-duplicate';
    await db.runAsync(
      `insert into transactions
       (id, household_id, type, quantity, reason, created_at, updated_at, _dirty)
       values (?, ?, 'in', 1, null, ?, ?, 1)`,
      [transactionId, 'hh-1', '2026-09-04T10:00:00.000Z', 1],
    );

    const select = jest.fn().mockResolvedValue({
      data: null,
      error: { code: '23505', message: 'duplicate key' },
      status: 409,
    });
    const insert = jest.fn().mockReturnValue({ select });
    const update = jest.fn();
    const maybeSingle = jest.fn().mockResolvedValue({
      data: {
        id: transactionId,
        household_id: 'hh-1',
        type: 'in',
        quantity: 1,
        reason: null,
        created_at: '2026-09-04T10:00:00.000Z',
      },
      error: null,
      status: 200,
    });
    const eq = jest.fn().mockReturnValue({ maybeSingle });
    const client = {
      from: jest
        .fn()
        .mockReturnValue({ insert, update, select: jest.fn().mockReturnValue({ eq }) }),
    } as unknown as TypedSupabaseClient;

    await enqueueMutation(db, {
      entity: 'transactions',
      entityId: transactionId,
      op: 'insert',
      payload: {
        id: transactionId,
        household_id: 'hh-1',
        type: 'in',
        quantity: 1,
        reason: null,
        created_at: '2026-09-04T10:00:00.000Z',
      },
      now: 2,
      applyLocally: async () => {},
    });

    try {
      const result = await pushOutbox({ db, supabase: client, now: () => 3 });

      expect(result.outcomes[0]).toMatchObject({ kind: 'pushed', entity: 'transactions' });
      expect(update).not.toHaveBeenCalled();
      expect(
        await db.getFirstAsync('select id from outbox where entity_id = ?', [transactionId]),
      ).toBeNull();
      expect(
        await db.getFirstAsync<{ dirty: number }>(
          'select _dirty as dirty from transactions where id = ?',
          [transactionId],
        ),
      ).toEqual({ dirty: 0 });
    } finally {
      db.close();
    }
  });

  it('behandelt einen wiederholten Ledger-insert idempotent, wenn der Server created_at nur anders formatiert', async () => {
    // PostgREST liefert Zeitstempel in Postgres-Schreibweise (+00:00) zurueck,
    // waehrend der Client ISO mit Z sendet — derselbe Zeitpunkt, andere Zeichenkette.
    const db = createTestDatabase();
    await runMigrations(db, MIGRATIONS);
    await runDrizzleMigrations(db);

    const transactionId = 'txn-duplicate-format';
    await db.runAsync(
      `insert into transactions
       (id, household_id, type, quantity, reason, created_at, updated_at, _dirty)
       values (?, ?, 'in', 1, null, ?, ?, 1)`,
      [transactionId, 'hh-1', '2026-09-04T10:00:00.000Z', 1],
    );

    const select = jest.fn().mockResolvedValue({
      data: null,
      error: { code: '23505', message: 'duplicate key' },
      status: 409,
    });
    const insert = jest.fn().mockReturnValue({ select });
    const update = jest.fn();
    const maybeSingle = jest.fn().mockResolvedValue({
      data: {
        id: transactionId,
        household_id: 'hh-1',
        type: 'in',
        quantity: 1,
        reason: null,
        created_at: '2026-09-04 10:00:00+00',
      },
      error: null,
      status: 200,
    });
    const eq = jest.fn().mockReturnValue({ maybeSingle });
    const client = {
      from: jest
        .fn()
        .mockReturnValue({ insert, update, select: jest.fn().mockReturnValue({ eq }) }),
    } as unknown as TypedSupabaseClient;

    await enqueueMutation(db, {
      entity: 'transactions',
      entityId: transactionId,
      op: 'insert',
      payload: {
        id: transactionId,
        household_id: 'hh-1',
        type: 'in',
        quantity: 1,
        reason: null,
        created_at: '2026-09-04T10:00:00.000Z',
      },
      now: 2,
      applyLocally: async () => {},
    });

    try {
      const result = await pushOutbox({ db, supabase: client, now: () => 3 });

      expect(result.outcomes[0]).toMatchObject({ kind: 'pushed', entity: 'transactions' });
      expect(update).not.toHaveBeenCalled();
      expect(
        await db.getFirstAsync('select id from outbox where entity_id = ?', [transactionId]),
      ).toBeNull();
    } finally {
      db.close();
    }
  });

  it('behaelt einen 23505-Konflikt, wenn die vorhandene Ledgerzeile nicht passt', async () => {
    const db = createTestDatabase();
    await runMigrations(db, MIGRATIONS);
    await runDrizzleMigrations(db);

    const transactionId = 'txn-conflict';
    await db.runAsync(
      `insert into transactions
       (id, household_id, type, quantity, reason, created_at, updated_at, _dirty)
       values (?, ?, 'in', 1, null, ?, ?, 1)`,
      [transactionId, 'hh-1', '2026-09-04T10:00:00.000Z', 1],
    );
    await enqueueMutation(db, {
      entity: 'transactions',
      entityId: transactionId,
      op: 'insert',
      payload: {
        id: transactionId,
        household_id: 'hh-1',
        type: 'in',
        quantity: 1,
        reason: null,
        created_at: '2026-09-04T10:00:00.000Z',
      },
      now: 2,
      applyLocally: async () => {},
    });

    const insertResponse = {
      data: null,
      error: { code: '23505', message: 'duplicate key' },
      status: 409,
    };
    const insert = jest
      .fn()
      .mockReturnValue({ select: jest.fn().mockResolvedValue(insertResponse) });
    const maybeSingle = jest.fn().mockResolvedValue({
      data: {
        id: transactionId,
        household_id: 'hh-1',
        type: 'in',
        quantity: 2,
        reason: null,
        created_at: '2026-09-04T10:00:00.000Z',
      },
      error: null,
      status: 200,
    });
    const eq = jest.fn().mockReturnValue({ maybeSingle });
    const client = {
      from: jest.fn().mockReturnValue({ insert, select: jest.fn().mockReturnValue({ eq }) }),
    } as unknown as TypedSupabaseClient;

    try {
      const result = await pushOutbox({ db, supabase: client, now: () => 3 });

      expect(result.outcomes[0]).toMatchObject({ kind: 'failed-permanent' });
      expect(
        await db.getFirstAsync('select id from outbox where entity_id = ?', [transactionId]),
      ).not.toBeNull();
    } finally {
      db.close();
    }
  });
});

describe('pushOutbox — Tombstone bewahrt den letzten Bestandssnapshot', () => {
  it('sendet die letzte lokale Menge zusammen mit dem Tombstone', async () => {
    const db = createTestDatabase();
    await runMigrations(db, MIGRATIONS);
    await runDrizzleMigrations(db);

    await enqueueMutation(db, {
      entity: 'fridge_items',
      entityId: 'item-delete',
      op: 'update',
      payload: { id: 'item-delete', quantity: 3 },
      now: 1,
      applyLocally: async () => {},
    });
    await enqueueMutation(db, {
      entity: 'fridge_items',
      entityId: 'item-delete',
      op: 'delete',
      payload: { id: 'item-delete' },
      now: 2,
      applyLocally: async () => {},
    });

    const remoteRow = {
      id: 'item-delete',
      household_id: 'hh-1',
      location_id: null,
      product_id: null,
      name: 'Milch',
      quantity: 3,
      unit: 'piece',
      package_size: null,
      package_size_unit: null,
      expiry_date: null,
      added_by: null,
      created_at: '2026-09-07T10:00:00.000Z',
      opened_at: null,
      vacuum_sealed: false,
      expiry_user_set: false,
      updated_at: '2026-09-07T10:00:01.000Z',
      deleted_at: '2026-09-07T10:00:01.000Z',
    };
    const select = jest.fn().mockResolvedValue({ data: [remoteRow], error: null, status: 200 });
    const eq = jest.fn().mockReturnValue({ select });
    const update = jest.fn().mockReturnValue({ eq });
    const client = {
      from: jest.fn().mockReturnValue({ update }),
    } as unknown as TypedSupabaseClient;

    try {
      await pushOutbox({ db, supabase: client, now: () => 3 });

      expect(update).toHaveBeenCalledWith(
        expect.objectContaining({ quantity: 3, deleted_at: expect.any(String) }),
      );
    } finally {
      db.close();
    }
  });
});

describe('pushOutbox — Retry-Abhängigkeiten', () => {
  it('stoppt nach einem transienten Artikel-Insert-Fehler vor der abhängigen Ledgerbuchung', async () => {
    const db = createTestDatabase();
    await runMigrations(db, MIGRATIONS);
    await runDrizzleMigrations(db);

    await enqueueMutation(db, {
      entity: 'fridge_items',
      entityId: 'item-dependent',
      op: 'insert',
      payload: {
        id: 'item-dependent',
        household_id: 'hh-1',
        name: 'Abhängige Milch',
        quantity: 1,
        unit: 'piece',
        created_at: '2026-09-07T10:00:00.000Z',
      },
      now: 1,
      applyLocally: async () => {},
    });
    await enqueueMutation(db, {
      entity: 'transactions',
      entityId: 'transaction-dependent',
      op: 'insert',
      payload: {
        id: 'transaction-dependent',
        household_id: 'hh-1',
        fridge_item_id: 'item-dependent',
        type: 'in',
        quantity: 1,
        created_at: '2026-09-07T10:00:00.000Z',
      },
      now: 2,
      applyLocally: async () => {},
    });

    const itemInsert = jest.fn().mockReturnValue({
      select: jest.fn().mockResolvedValue({
        data: null,
        error: { code: 'PGRST000', message: 'vorübergehend nicht erreichbar' },
        status: 503,
      }),
    });
    const transactionInsert = jest.fn().mockReturnValue({
      select: jest.fn().mockResolvedValue({ data: [], error: null, status: 200 }),
    });
    const client = {
      from: jest.fn((table: string) =>
        table === 'fridge_items' ? { insert: itemInsert } : { insert: transactionInsert },
      ),
    } as unknown as TypedSupabaseClient;

    try {
      const result = await pushOutbox({ db, supabase: client, now: () => 2 });

      expect(result.stoppedEarly).toBe(true);
      expect(result.outcomes).toEqual([
        expect.objectContaining({ kind: 'failed-transient', entity: 'fridge_items' }),
      ]);
      expect(transactionInsert).not.toHaveBeenCalled();
      expect(
        await db.getAllAsync<{ entity: string }>('select entity from outbox order by id'),
      ).toEqual([{ entity: 'fridge_items' }, { entity: 'transactions' }]);
    } finally {
      db.close();
    }
  });

  it('stellt eine fällige Ledgerbuchung zurück, wenn der Artikel-Insert noch im Backoff wartet', async () => {
    const db = createTestDatabase();
    await runMigrations(db, MIGRATIONS);
    await runDrizzleMigrations(db);

    await enqueueMutation(db, {
      entity: 'fridge_items',
      entityId: 'item-backoff',
      op: 'insert',
      payload: {
        id: 'item-backoff',
        household_id: 'hh-1',
        name: 'Wartende Milch',
        quantity: 1,
        unit: 'piece',
        created_at: '2026-09-07T10:00:00.000Z',
      },
      now: 1,
      applyLocally: async () => {},
    });
    const [itemInsert] = await db.getAllAsync<{ id: number }>(
      "select id from outbox where entity = 'fridge_items'",
    );
    await recordOutboxOutcome(db, [itemInsert.id], {
      attempts: 1,
      lastError: 'timeout',
      kind: 'transient',
      nextAttemptAtMs: 1_000,
    });
    await enqueueMutation(db, {
      entity: 'transactions',
      entityId: 'transaction-backoff',
      op: 'insert',
      payload: {
        id: 'transaction-backoff',
        household_id: 'hh-1',
        fridge_item_id: 'item-backoff',
        type: 'in',
        quantity: 1,
        created_at: '2026-09-07T10:00:00.000Z',
      },
      now: 2,
      applyLocally: async () => {},
    });

    const transactionInsert = jest.fn().mockReturnValue({
      select: jest.fn().mockResolvedValue({
        data: [
          {
            id: 'transaction-backoff',
            household_id: 'hh-1',
            type: 'in',
            quantity: 1,
            undone: false,
            created_at: '2026-09-07T10:00:00.000Z',
          },
        ],
        error: null,
        status: 200,
      }),
    });
    const client = {
      from: jest.fn().mockReturnValue({ insert: transactionInsert }),
    } as unknown as TypedSupabaseClient;

    try {
      const result = await pushOutbox({ db, supabase: client, now: () => 500 });

      expect(result.outcomes).toEqual([]);
      expect(transactionInsert).not.toHaveBeenCalled();
      expect(
        await db.getFirstAsync<{ attempts: number; last_error: string; next_attempt_at: number }>(
          'select attempts, last_error, next_attempt_at from outbox where id = ?',
          [itemInsert.id],
        ),
      ).toEqual({ attempts: 1, last_error: 'timeout', next_attempt_at: 1_000 });
    } finally {
      db.close();
    }
  });

  it('stellt eine Ledgerbuchung auch bei einem wartenden Split-Ursprung zurück', async () => {
    const db = createTestDatabase();
    await runMigrations(db, MIGRATIONS);
    await runDrizzleMigrations(db);

    await enqueueMutation(db, {
      entity: 'fridge_items',
      entityId: 'item-origin-backoff',
      op: 'insert',
      payload: {
        id: 'item-origin-backoff',
        household_id: 'hh-1',
        name: 'Ursprungs-Milch',
        quantity: 2,
        unit: 'piece',
        created_at: '2026-09-07T10:00:00.000Z',
      },
      now: 1,
      applyLocally: async () => {},
    });
    const [originInsert] = await db.getAllAsync<{ id: number }>(
      "select id from outbox where entity = 'fridge_items'",
    );
    await recordOutboxOutcome(db, [originInsert.id], {
      attempts: MAX_ATTEMPTS,
      lastError: 'timeout',
      kind: 'transient',
      nextAttemptAtMs: 1_000,
    });
    await enqueueMutation(db, {
      entity: 'transactions',
      entityId: 'transaction-origin-backoff',
      op: 'insert',
      payload: {
        id: 'transaction-origin-backoff',
        household_id: 'hh-1',
        fridge_item_id: 'existing-item',
        origin_item_id: 'item-origin-backoff',
        origin_quantity: 1,
        type: 'open',
        quantity: 1,
        previous_expiry_date: '2026-09-10',
        created_at: '2026-09-07T10:00:00.000Z',
      },
      now: 2,
      applyLocally: async () => {},
    });

    const transactionInsert = jest.fn().mockReturnValue({
      select: jest.fn().mockResolvedValue({
        data: [
          {
            id: 'transaction-origin-backoff',
            household_id: 'hh-1',
            type: 'open',
            quantity: 1,
            undone: false,
            created_at: '2026-09-07T10:00:00.000Z',
          },
        ],
        error: null,
        status: 200,
      }),
    });
    const client = {
      from: jest.fn().mockReturnValue({ insert: transactionInsert }),
    } as unknown as TypedSupabaseClient;

    try {
      const result = await pushOutbox({ db, supabase: client, now: () => 500 });

      expect(result.outcomes).toEqual([]);
      expect(transactionInsert).not.toHaveBeenCalled();
      expect(
        await db.getFirstAsync<{ attempts: number; last_error: string; next_attempt_at: number }>(
          'select attempts, last_error, next_attempt_at from outbox where id = ?',
          [originInsert.id],
        ),
      ).toEqual({ attempts: MAX_ATTEMPTS, last_error: 'timeout', next_attempt_at: 1_000 });
    } finally {
      db.close();
    }
  });

  it('blockiert spaetere Mutationen derselben Zeile, laesst andere Zeilen aber weiterlaufen', async () => {
    const db = createTestDatabase();
    await runMigrations(db, MIGRATIONS);
    await runDrizzleMigrations(db);

    await enqueueMutation(db, {
      entity: 'storage_locations',
      entityId: 'loc-blocked',
      op: 'update',
      payload: { id: 'loc-blocked', name: 'Erster Versuch' },
      now: 1,
      applyLocally: async () => {},
    });
    const [failed] = await db.getAllAsync<{ id: number }>('select id from outbox order by id');
    await recordOutboxOutcome(db, [failed.id], {
      attempts: 1,
      lastError: 'timeout',
      kind: 'transient',
      nextAttemptAtMs: 1_000,
    });
    await enqueueMutation(db, {
      entity: 'storage_locations',
      entityId: 'loc-blocked',
      op: 'update',
      payload: { id: 'loc-blocked', name: 'Zweiter Versuch' },
      now: 2,
      applyLocally: async () => {},
    });
    await enqueueMutation(db, {
      entity: 'storage_locations',
      entityId: 'loc-independent',
      op: 'update',
      payload: { id: 'loc-independent', name: 'Unabhaengig' },
      now: 3,
      applyLocally: async () => {},
    });

    const remoteRow = (id: string, name: string) => ({
      id,
      household_id: 'hh-1',
      name,
      kind: 'fridge',
      sort_order: 0,
      created_at: '2026-09-07T10:00:00.000Z',
      updated_at: '2026-09-07T10:00:01.000Z',
      deleted_at: null,
    });
    const select = jest.fn().mockResolvedValueOnce({
      data: [remoteRow('loc-independent', 'Unabhaengig')],
      error: null,
      status: 200,
    });
    const eq = jest.fn().mockReturnValue({ select });
    const update = jest.fn().mockReturnValue({ eq });
    const client = {
      from: jest.fn().mockReturnValue({ update }),
    } as unknown as TypedSupabaseClient;

    try {
      const result = await pushOutbox({ db, supabase: client, now: () => 500 });

      expect(result.outcomes).toEqual([
        expect.objectContaining({ kind: 'pushed', entityId: 'loc-independent' }),
      ]);
      expect(update).toHaveBeenCalledTimes(1);
      expect(
        await db.getAllAsync<{ entity_id: string }>('select entity_id from outbox order by id'),
      ).toEqual([{ entity_id: 'loc-blocked' }, { entity_id: 'loc-blocked' }]);
    } finally {
      db.close();
    }
  });
});

describe('pushOutbox — Rebase neuer lokaler Mutationen', () => {
  it('ueberschreibt keine Mutation, die waehrend des Requests hinzukommt', async () => {
    const db = createTestDatabase();
    await runMigrations(db, MIGRATIONS);
    await runDrizzleMigrations(db);
    await db.runAsync(
      `insert into fridge_items
       (id, household_id, name, quantity, unit, created_at, updated_at)
       values (?, ?, ?, ?, ?, ?, ?)`,
      ['item-race', 'hh-1', 'Milch', 1, 'piece', '2026-09-07T10:00:00.000Z', 0],
    );

    const firstPayload = { id: 'item-race', quantity: 2 };
    await enqueueMutation(db, {
      entity: 'fridge_items',
      entityId: 'item-race',
      op: 'update',
      payload: firstPayload,
      now: 10,
      applyLocally: (txn) => applyLocalMirrorWrite(txn, 'fridge_items', 'update', firstPayload, 10),
    });

    const remoteRow = {
      id: 'item-race',
      household_id: 'hh-1',
      location_id: null,
      product_id: null,
      name: 'Milch',
      quantity: 2,
      unit: 'piece',
      package_size: null,
      package_size_unit: null,
      expiry_date: null,
      added_by: null,
      created_at: '2026-09-07T10:00:00.000Z',
      opened_at: null,
      vacuum_sealed: false,
      expiry_user_set: false,
      updated_at: '2026-09-07T10:00:01.000Z',
      deleted_at: null,
    };
    let resolveResponse: ((value: unknown) => void) | undefined;
    const response = new Promise((resolve) => {
      resolveResponse = resolve;
    });
    let requestStartedResolve: (() => void) | undefined;
    const requestStarted = new Promise<void>((resolve) => {
      requestStartedResolve = resolve;
    });
    const select = jest.fn(() => response);
    const eq = jest.fn().mockReturnValue({ select });
    const update = jest.fn().mockImplementation(() => {
      requestStartedResolve?.();
      return { eq };
    });
    const client = {
      from: jest.fn().mockReturnValue({ update }),
    } as unknown as TypedSupabaseClient;

    const pushPromise = pushOutbox({ db, supabase: client, now: () => 30 });
    await requestStarted;

    const secondPayload = { id: 'item-race', quantity: 3 };
    await enqueueMutation(db, {
      entity: 'fridge_items',
      entityId: 'item-race',
      op: 'update',
      payload: secondPayload,
      now: 20,
      applyLocally: (txn) =>
        applyLocalMirrorWrite(txn, 'fridge_items', 'update', secondPayload, 20),
    });
    resolveResponse?.({ data: [remoteRow], error: null, status: 200 });

    try {
      await pushPromise;

      expect(
        await db.getFirstAsync<{ quantity: number; dirty: number }>(
          'select quantity, _dirty as dirty from fridge_items where id = ?',
          ['item-race'],
        ),
      ).toEqual({ quantity: 3, dirty: 1 });
      expect(
        await db.getAllAsync('select id from outbox where entity_id = ?', ['item-race']),
      ).toHaveLength(1);
    } finally {
      db.close();
    }
  });
});

describe('pushOutbox — atomare Mengenänderung', () => {
  it('ruft den Delta-RPC auf und übernimmt die kanonische Bestandszeile', async () => {
    const db = createTestDatabase();
    await runMigrations(db, MIGRATIONS);
    await runDrizzleMigrations(db);
    await db.runAsync(
      `insert into fridge_items
       (id, household_id, name, quantity, unit, created_at, updated_at)
       values (?, ?, ?, ?, ?, ?, ?)`,
      ['item-quantity', 'hh-1', 'Milch', 5, 'piece', '2026-09-07T10:00:00.000Z', 0],
    );

    const payload = {
      operation_id: 'quantity-operation-1',
      transaction_id: 'quantity-transaction-1',
      item_id: 'item-quantity',
      household_id: 'hh-1',
      delta: -2,
      created_at: '2026-09-07T10:00:00.000Z',
    };
    await enqueueMutation(db, {
      ...createInventoryQuantityMutation({
        payload,
        transaction: {
          id: payload.transaction_id,
          operation_id: payload.operation_id,
          household_id: payload.household_id,
          fridge_item_id: payload.item_id,
          product_id: null,
          actor: 'user-1',
          type: 'out',
          quantity: 2,
          location_id: null,
          reason: null,
          previous_expiry_date: null,
          notes: null,
          undone: false,
          created_at: payload.created_at,
        },
        resultQuantity: 3,
        nowMs: 1,
      }),
      now: 1,
    });

    const remoteRow = {
      id: 'item-quantity',
      household_id: 'hh-1',
      location_id: null,
      product_id: null,
      name: 'Milch',
      quantity: 3,
      unit: 'piece',
      package_size: null,
      package_size_unit: null,
      expiry_date: null,
      added_by: null,
      created_at: '2026-09-07T10:00:00.000Z',
      opened_at: null,
      vacuum_sealed: false,
      expiry_user_set: false,
      updated_at: '2026-09-07T10:00:01.000Z',
      deleted_at: null,
    };
    const maybeSingle = jest.fn().mockResolvedValue({ data: remoteRow, error: null, status: 200 });
    const eq = jest.fn().mockReturnValue({ maybeSingle });
    const select = jest.fn().mockReturnValue({ eq });
    const rpc = jest.fn().mockResolvedValue({ data: 'item-quantity', error: null, status: 200 });
    const client = {
      rpc,
      from: jest.fn().mockReturnValue({ select }),
    } as unknown as TypedSupabaseClient;

    try {
      const result = await pushOutbox({ db, supabase: client, now: () => 2 });

      expect(result.outcomes[0]).toMatchObject({ kind: 'pushed', entityId: 'item-quantity' });
      expect(rpc).toHaveBeenCalledWith('adjust_fridge_item_quantity', {
        p_operation_id: 'quantity-operation-1',
        p_transaction_id: 'quantity-transaction-1',
        p_item_id: 'item-quantity',
        p_household_id: 'hh-1',
        p_delta: -2,
        p_created_at: '2026-09-07T10:00:00.000Z',
      });
      expect(
        await db.getFirstAsync('select id from outbox where entity_id = ?', ['item-quantity']),
      ).toBeNull();
      expect(
        await db.getFirstAsync<{ quantity: number; dirty: number }>(
          'select quantity, _dirty as dirty from fridge_items where id = ?',
          ['item-quantity'],
        ),
      ).toEqual({ quantity: 3, dirty: 0 });
      expect(
        await db.getFirstAsync<{ dirty: number }>(
          'select _dirty as dirty from transactions where id = ?',
          ['quantity-transaction-1'],
        ),
      ).toEqual({ dirty: 0 });
    } finally {
      db.close();
    }
  });

  it('rechnet eine bestaetigte Push-Antwort in eine noch offene Folgeoperation ein (fam-onu)', async () => {
    const db = createTestDatabase();
    await runMigrations(db, MIGRATIONS);
    await runDrizzleMigrations(db);
    await db.runAsync(
      `insert into fridge_items
       (id, household_id, name, quantity, unit, created_at, updated_at)
       values (?, ?, ?, ?, ?, ?, ?)`,
      ['item-quantity', 'hh-1', 'Milch', 5, 'piece', '2026-09-07T10:00:00.000Z', 0],
    );

    const basePayload = {
      item_id: 'item-quantity',
      household_id: 'hh-1',
      created_at: '2026-09-07T10:00:00.000Z',
    };
    // Zwei unabhaengige Verbrauchs-Operationen auf demselben Bestand; beide
    // bleiben passthrough (nie coalesced), landen also als zwei Outbox-Zeilen.
    await enqueueMutation(db, {
      ...createInventoryQuantityMutation({
        payload: { ...basePayload, operation_id: 'op-1', transaction_id: 'tx-1', delta: -2 },
        transaction: {
          id: 'tx-1',
          operation_id: 'op-1',
          household_id: 'hh-1',
          fridge_item_id: 'item-quantity',
          product_id: null,
          actor: 'user-1',
          type: 'out',
          quantity: 2,
          location_id: null,
          reason: null,
          previous_expiry_date: null,
          notes: null,
          undone: false,
          created_at: basePayload.created_at,
        },
        resultQuantity: 3,
        nowMs: 1,
      }),
      now: 1,
    });
    await enqueueMutation(db, {
      ...createInventoryQuantityMutation({
        payload: { ...basePayload, operation_id: 'op-2', transaction_id: 'tx-2', delta: -1 },
        transaction: {
          id: 'tx-2',
          operation_id: 'op-2',
          household_id: 'hh-1',
          fridge_item_id: 'item-quantity',
          product_id: null,
          actor: 'user-1',
          type: 'out',
          quantity: 1,
          location_id: null,
          reason: null,
          previous_expiry_date: null,
          notes: null,
          undone: false,
          created_at: basePayload.created_at,
        },
        resultQuantity: 2,
        nowMs: 2,
      }),
      now: 2,
    });

    const remoteRowAfterFirstOp = {
      id: 'item-quantity',
      household_id: 'hh-1',
      location_id: null,
      product_id: null,
      name: 'Milch',
      // Ein weiteres Geraet hatte den Bestand vor unserem Push bereits auf 4
      // reduziert; op-1 (delta -2) wendet der Server atomar auf diese echte
      // Basis an, nicht auf die 5, von der unser Client noch ausging.
      quantity: 2,
      unit: 'piece',
      package_size: null,
      package_size_unit: null,
      expiry_date: null,
      added_by: null,
      created_at: basePayload.created_at,
      opened_at: null,
      vacuum_sealed: false,
      expiry_user_set: false,
      updated_at: '2026-09-07T10:00:01.000Z',
      deleted_at: null,
    };
    const maybeSingle = jest
      .fn()
      .mockResolvedValueOnce({ data: remoteRowAfterFirstOp, error: null, status: 200 });
    const eq = jest.fn().mockReturnValue({ maybeSingle });
    const select = jest.fn().mockReturnValue({ eq });
    // Erste Operation wird bestaetigt, die zweite scheitert transient (z. B.
    // Verbindungsabbruch) und bleibt in der Outbox offen.
    const rpc = jest
      .fn()
      .mockResolvedValueOnce({ data: 'item-quantity', error: null, status: 200 })
      .mockResolvedValueOnce({ data: null, error: { message: 'Netzwerkfehler' }, status: 0 });
    const client = {
      rpc,
      from: jest.fn().mockReturnValue({ select }),
    } as unknown as TypedSupabaseClient;

    try {
      const result = await pushOutbox({ db, supabase: client, now: () => 3 });

      expect(result.outcomes).toMatchObject([
        { kind: 'pushed', entityId: 'item-quantity' },
        { kind: 'failed-transient', entityId: 'item-quantity' },
      ]);
      expect(
        await db.getFirstAsync('select id from outbox where entity_id = ?', ['item-quantity']),
      ).not.toBeNull();

      // Bestaetigte Basis (2) plus offenes Delta der zweiten Operation (-1) = 1,
      // nicht der stehen gebliebene lokale Optimistic-Wert (2), der noch von
      // der ueberholten Annahme "Basis war 5" ausging.
      const row = await db.getFirstAsync<{ quantity: number; dirty: number }>(
        'select quantity, _dirty as dirty from fridge_items where id = ?',
        ['item-quantity'],
      );
      expect(row).toEqual({ quantity: 1, dirty: 1 });
    } finally {
      db.close();
    }
  });

  it('haelt Folgeoperationen desselben Artikels zurueck, wenn eine vorherige im selben Batch dauerhaft scheitert', async () => {
    const db = createTestDatabase();
    await runMigrations(db, MIGRATIONS);
    await runDrizzleMigrations(db);
    await db.runAsync(
      `insert into fridge_items
       (id, household_id, name, quantity, unit, created_at, updated_at)
       values (?, ?, ?, ?, ?, ?, ?)`,
      ['item-quantity', 'hh-1', 'Milch', 5, 'piece', '2026-09-07T10:00:00.000Z', 0],
    );

    const basePayload = {
      item_id: 'item-quantity',
      household_id: 'hh-1',
      created_at: '2026-09-07T10:00:00.000Z',
    };
    // Zwei Operationen auf demselben Artikel im selben Batch: die erste
    // (eine Korrektur) scheitert dauerhaft (409 compare-and-set-Konflikt).
    // Die zweite darf nicht ausgefuehrt werden — sie beruht moeglicherweise
    // auf der gerade abgelehnten Korrektur.
    await enqueueMutation(db, {
      ...createInventoryQuantityCorrectionMutation({
        payload: {
          ...basePayload,
          operation_id: 'op-correct',
          transaction_id: 'tx-correct',
          expected_quantity: 5,
          new_quantity: 3,
        },
        transaction: {
          id: 'tx-correct',
          operation_id: 'op-correct',
          household_id: 'hh-1',
          fridge_item_id: 'item-quantity',
          product_id: null,
          actor: 'user-1',
          type: 'out',
          quantity: 2,
          location_id: null,
          reason: null,
          previous_expiry_date: null,
          notes: '[Manual correction]',
          undone: false,
          created_at: basePayload.created_at,
        },
        nowMs: 1,
      }),
      now: 1,
    });
    await enqueueMutation(db, {
      ...createInventoryQuantityMutation({
        payload: {
          ...basePayload,
          operation_id: 'op-adjust',
          transaction_id: 'tx-adjust',
          delta: -1,
        },
        transaction: {
          id: 'tx-adjust',
          operation_id: 'op-adjust',
          household_id: 'hh-1',
          fridge_item_id: 'item-quantity',
          product_id: null,
          actor: 'user-1',
          type: 'out',
          quantity: 1,
          location_id: null,
          reason: null,
          previous_expiry_date: null,
          notes: null,
          undone: false,
          created_at: basePayload.created_at,
        },
        resultQuantity: 2,
        nowMs: 2,
      }),
      now: 2,
    });

    const rpc = jest
      .fn()
      .mockResolvedValue({ data: null, error: { message: 'Bestand veraendert' }, status: 409 });
    const client = { rpc } as unknown as TypedSupabaseClient;

    try {
      const result = await pushOutbox({ db, supabase: client, now: () => 3 });

      expect(result.outcomes).toMatchObject([
        { kind: 'failed-permanent', entityId: 'item-quantity' },
      ]);
      // Nur die erste (die dauerhaft scheiternde) Operation ruft die RPC auf —
      // die zweite wird zurueckgehalten, nicht etwa uebersprungen und verworfen.
      expect(rpc).toHaveBeenCalledTimes(1);
      expect(
        await db.getAllAsync<{ attempts: number }>('select attempts from outbox order by id'),
      ).toEqual([{ attempts: MAX_ATTEMPTS }, { attempts: 0 }]);
    } finally {
      db.close();
    }
  });

  it('ruft für eine manuelle Korrektur den Compare-and-set-RPC auf', async () => {
    const db = createTestDatabase();
    await runMigrations(db, MIGRATIONS);
    await runDrizzleMigrations(db);
    await db.runAsync(
      `insert into fridge_items
       (id, household_id, name, quantity, unit, created_at, updated_at)
       values (?, ?, ?, ?, ?, ?, ?)`,
      ['item-correction', 'hh-1', 'Milch', 5, 'piece', '2026-09-07T10:00:00.000Z', 0],
    );

    const payload = {
      operation_id: 'correction-operation-1',
      transaction_id: 'correction-transaction-1',
      item_id: 'item-correction',
      household_id: 'hh-1',
      expected_quantity: 5,
      new_quantity: 3,
      created_at: '2026-09-07T10:00:00.000Z',
    };
    await enqueueMutation(db, {
      ...createInventoryQuantityCorrectionMutation({
        payload,
        transaction: {
          id: payload.transaction_id,
          operation_id: payload.operation_id,
          household_id: payload.household_id,
          fridge_item_id: payload.item_id,
          product_id: null,
          actor: 'user-1',
          type: 'out',
          quantity: 2,
          location_id: null,
          reason: null,
          previous_expiry_date: null,
          notes: '[Manual correction]',
          undone: false,
          created_at: payload.created_at,
        },
        nowMs: 1,
      }),
      now: 1,
    });

    const remoteRow = {
      id: 'item-correction',
      household_id: 'hh-1',
      location_id: null,
      product_id: null,
      name: 'Milch',
      quantity: 3,
      unit: 'piece',
      package_size: null,
      package_size_unit: null,
      expiry_date: null,
      added_by: null,
      created_at: '2026-09-07T10:00:00.000Z',
      opened_at: null,
      vacuum_sealed: false,
      expiry_user_set: false,
      updated_at: '2026-09-07T10:00:01.000Z',
      deleted_at: null,
    };
    const maybeSingle = jest.fn().mockResolvedValue({ data: remoteRow, error: null, status: 200 });
    const eq = jest.fn().mockReturnValue({ maybeSingle });
    const rpc = jest.fn().mockResolvedValue({ data: 'item-correction', error: null, status: 200 });
    const client = {
      rpc,
      from: jest.fn().mockReturnValue({ select: jest.fn().mockReturnValue({ eq }) }),
    } as unknown as TypedSupabaseClient;

    try {
      const result = await pushOutbox({ db, supabase: client, now: () => 2 });

      expect(result.outcomes[0]).toMatchObject({ kind: 'pushed', entityId: 'item-correction' });
      expect(rpc).toHaveBeenCalledWith('correct_fridge_item_quantity', {
        p_operation_id: 'correction-operation-1',
        p_transaction_id: 'correction-transaction-1',
        p_item_id: 'item-correction',
        p_household_id: 'hh-1',
        p_expected_quantity: 5,
        p_new_quantity: 3,
        p_created_at: '2026-09-07T10:00:00.000Z',
      });
      expect(
        await db.getFirstAsync<{ quantity: number; dirty: number }>(
          'select quantity, _dirty as dirty from fridge_items where id = ?',
          ['item-correction'],
        ),
      ).toEqual({ quantity: 3, dirty: 0 });
    } finally {
      db.close();
    }
  });
});

describe('pushOutbox — atomarer Split', () => {
  it('ruft die Split-RPC auf und uebernimmt beide kanonischen Bestandszeilen', async () => {
    const db = createTestDatabase();
    await runMigrations(db, MIGRATIONS);
    await runDrizzleMigrations(db);
    await db.runAsync(
      `insert into fridge_items
       (id, household_id, name, quantity, unit, created_at, updated_at)
       values (?, ?, ?, ?, ?, ?, ?)`,
      ['item-source', 'hh-1', 'Milch', 5, 'piece', '2026-09-07T10:00:00.000Z', 0],
    );

    const payload = {
      transaction_id: 'split-transaction-1',
      source_item_id: 'item-source',
      opened_item_id: 'item-opened',
      household_id: 'hh-1',
      expected_source_quantity: 5,
      open_quantity: 1,
      opened_at: '2026-09-07T10:00:00.000Z',
      new_expiry_date: '2026-09-10',
      expiry_user_set: true,
      created_at: '2026-09-07T10:00:00.000Z',
    };
    await enqueueMutation(db, {
      ...createInventorySplitMutation({
        payload,
        openedItem: {
          id: 'item-opened',
          household_id: 'hh-1',
          location_id: null,
          product_id: null,
          name: 'Milch',
          quantity: 1,
          unit: 'piece',
          package_size: null,
          package_size_unit: null,
          expiry_date: '2026-09-10',
          added_by: null,
          opened_at: payload.opened_at,
          vacuum_sealed: false,
          expiry_user_set: true,
        },
        transaction: {
          id: payload.transaction_id,
          household_id: 'hh-1',
          fridge_item_id: 'item-opened',
          product_id: null,
          actor: 'user-1',
          type: 'open',
          quantity: 1,
          location_id: null,
          previous_expiry_date: null,
          origin_item_id: 'item-source',
          origin_quantity: 5,
          notes: '[Split] origin=item-source',
          undone: false,
          created_at: payload.created_at,
        },
        nowMs: 1,
      }),
      now: 1,
    });

    const sourceRow = {
      id: 'item-source',
      household_id: 'hh-1',
      location_id: null,
      product_id: null,
      name: 'Milch',
      quantity: 4,
      unit: 'piece',
      package_size: null,
      package_size_unit: null,
      expiry_date: null,
      added_by: null,
      created_at: '2026-09-07T10:00:00.000Z',
      opened_at: null,
      vacuum_sealed: false,
      expiry_user_set: false,
      updated_at: '2026-09-07T10:00:01.000Z',
      deleted_at: null,
    };
    const openedRow = {
      id: 'item-opened',
      household_id: 'hh-1',
      location_id: null,
      product_id: null,
      name: 'Milch',
      quantity: 1,
      unit: 'piece',
      package_size: null,
      package_size_unit: null,
      expiry_date: '2026-09-10',
      added_by: null,
      created_at: '2026-09-07T10:00:00.000Z',
      opened_at: '2026-09-07T10:00:00.000Z',
      vacuum_sealed: false,
      expiry_user_set: true,
      updated_at: '2026-09-07T10:00:01.000Z',
      deleted_at: null,
    };
    const inQuery = jest
      .fn()
      .mockResolvedValue({ data: [sourceRow, openedRow], error: null, status: 200 });
    const select = jest.fn().mockReturnValue({ in: inQuery });
    const rpc = jest.fn().mockResolvedValue({ data: 'item-opened', error: null, status: 200 });
    const client = {
      rpc,
      from: jest.fn().mockReturnValue({ select }),
    } as unknown as TypedSupabaseClient;

    try {
      const result = await pushOutbox({ db, supabase: client, now: () => 2 });

      expect(result.outcomes[0]).toMatchObject({ kind: 'pushed', entityId: 'item-source' });
      expect(rpc).toHaveBeenCalledWith('split_fridge_item_open', {
        p_transaction_id: 'split-transaction-1',
        p_source_item_id: 'item-source',
        p_opened_item_id: 'item-opened',
        p_household_id: 'hh-1',
        p_expected_source_quantity: 5,
        p_open_quantity: 1,
        p_opened_at: '2026-09-07T10:00:00.000Z',
        p_new_expiry_date: '2026-09-10',
        p_expiry_user_set: true,
        p_created_at: '2026-09-07T10:00:00.000Z',
      });
      expect(inQuery).toHaveBeenCalledWith('id', ['item-source', 'item-opened']);
      expect(
        await db.getFirstAsync('select id from outbox where entity_id = ?', ['item-source']),
      ).toBeNull();
      expect(
        await db.getFirstAsync<{ quantity: number; dirty: number }>(
          'select quantity, _dirty as dirty from fridge_items where id = ?',
          ['item-source'],
        ),
      ).toEqual({ quantity: 4, dirty: 0 });
      expect(
        await db.getFirstAsync<{ quantity: number; dirty: number; opened_at: string }>(
          'select quantity, _dirty as dirty, opened_at from fridge_items where id = ?',
          ['item-opened'],
        ),
      ).toEqual({ quantity: 1, dirty: 0, opened_at: '2026-09-07T10:00:00.000Z' });
      expect(
        await db.getFirstAsync<{ dirty: number }>(
          'select _dirty as dirty from transactions where id = ?',
          ['split-transaction-1'],
        ),
      ).toEqual({ dirty: 0 });
    } finally {
      db.close();
    }
  });
});

describe('pushOutbox — atomares Split-Undo (Merge)', () => {
  it('ruft die Merge-Undo-RPC auf und uebernimmt beide kanonischen Bestandszeilen', async () => {
    const db = createTestDatabase();
    await runMigrations(db, MIGRATIONS);
    await runDrizzleMigrations(db);
    await db.runAsync(
      `insert into fridge_items
       (id, household_id, name, quantity, unit, created_at, updated_at, opened_at)
       values (?, ?, ?, ?, ?, ?, ?, ?)`,
      ['item-sealed', 'hh-1', 'Milch', 4, 'piece', '2026-09-07T10:00:00.000Z', 0, null],
    );
    await db.runAsync(
      `insert into fridge_items
       (id, household_id, name, quantity, unit, created_at, updated_at, opened_at)
       values (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        'item-opened',
        'hh-1',
        'Milch',
        1,
        'piece',
        '2026-09-07T10:00:00.000Z',
        0,
        '2026-09-07T10:00:00.000Z',
      ],
    );

    const payload = {
      reversal_transaction_id: 'merge-undo-transaction-1',
      reversal_of: 'split-transaction-1',
      household_id: 'hh-1',
      created_at: '2026-09-07T10:05:00.000Z',
      notes: '[Undone] Öffnung rückgängig gemacht',
      opened_item_id: 'item-opened',
    };
    await enqueueMutation(db, {
      ...createInventoryMergeUndoMutation({
        payload,
        sealedItemId: 'item-sealed',
        sealedQuantityAfterMerge: 5,
        openedItemId: 'item-opened',
        transaction: {
          id: payload.reversal_transaction_id,
          household_id: 'hh-1',
          fridge_item_id: 'item-sealed',
          product_id: null,
          actor: 'user-1',
          type: 'open',
          quantity: 1,
          location_id: null,
          previous_expiry_date: null,
          notes: payload.notes,
          undone: false,
          reversal_of: payload.reversal_of,
          created_at: payload.created_at,
        },
        nowMs: 1,
      }),
      now: 1,
    });

    const sealedRow = {
      id: 'item-sealed',
      household_id: 'hh-1',
      location_id: null,
      product_id: null,
      name: 'Milch',
      quantity: 5,
      unit: 'piece',
      package_size: null,
      package_size_unit: null,
      expiry_date: null,
      added_by: null,
      created_at: '2026-09-07T10:00:00.000Z',
      opened_at: null,
      vacuum_sealed: false,
      expiry_user_set: false,
      updated_at: '2026-09-07T10:05:01.000Z',
      deleted_at: null,
    };
    const openedRowAfterMerge = {
      id: 'item-opened',
      household_id: 'hh-1',
      location_id: null,
      product_id: null,
      name: 'Milch',
      quantity: 1,
      unit: 'piece',
      package_size: null,
      package_size_unit: null,
      expiry_date: null,
      added_by: null,
      created_at: '2026-09-07T10:00:00.000Z',
      opened_at: '2026-09-07T10:00:00.000Z',
      vacuum_sealed: false,
      expiry_user_set: false,
      updated_at: '2026-09-07T10:05:01.000Z',
      deleted_at: '2026-09-07T10:05:01.000Z',
    };
    const ledgerMaybeSingle = jest
      .fn()
      .mockResolvedValue({ data: { fridge_item_id: 'item-opened' }, error: null, status: 200 });
    const ledgerEq = jest.fn().mockReturnValue({ maybeSingle: ledgerMaybeSingle });
    const ledgerSelect = jest.fn().mockReturnValue({ eq: ledgerEq });
    const inQuery = jest
      .fn()
      .mockResolvedValue({ data: [sealedRow, openedRowAfterMerge], error: null, status: 200 });
    const itemsSelect = jest.fn().mockReturnValue({ in: inQuery });
    const rpc = jest.fn().mockResolvedValue({ data: 'item-sealed', error: null, status: 200 });
    const from = jest.fn((table: string) =>
      table === 'transactions' ? { select: ledgerSelect } : { select: itemsSelect },
    );
    const client = { rpc, from } as unknown as TypedSupabaseClient;

    try {
      const result = await pushOutbox({ db, supabase: client, now: () => 2 });

      expect(result.outcomes[0]).toMatchObject({ kind: 'pushed', entityId: 'item-sealed' });
      expect(rpc).toHaveBeenCalledWith('merge_undo_fridge_item_open', {
        p_reversal_transaction_id: 'merge-undo-transaction-1',
        p_reversal_of: 'split-transaction-1',
        p_household_id: 'hh-1',
        p_created_at: '2026-09-07T10:05:00.000Z',
        p_notes: '[Undone] Öffnung rückgängig gemacht',
      });
      expect(inQuery).toHaveBeenCalledWith('id', ['item-sealed', 'item-opened']);
      expect(
        await db.getFirstAsync('select id from outbox where entity_id = ?', ['item-sealed']),
      ).toBeNull();
      expect(
        await db.getFirstAsync<{ quantity: number; dirty: number }>(
          'select quantity, _dirty as dirty from fridge_items where id = ?',
          ['item-sealed'],
        ),
      ).toEqual({ quantity: 5, dirty: 0 });
      expect(
        await db.getFirstAsync<{ deletedAt: number | null; dirty: number }>(
          'select deleted_at as deletedAt, _dirty as dirty from fridge_items where id = ?',
          ['item-opened'],
        ),
      ).toEqual({ deletedAt: expect.any(Number), dirty: 0 });
      expect(
        await db.getFirstAsync<{ dirty: number }>(
          'select _dirty as dirty from transactions where id = ?',
          ['merge-undo-transaction-1'],
        ),
      ).toEqual({ dirty: 0 });
    } finally {
      db.close();
    }
  });

  it('haelt eine Folgeoperation auf dem geoeffneten Los zurueck, wenn der Merge-Undo im selben Batch dauerhaft scheitert (fam-lem.20)', async () => {
    const db = createTestDatabase();
    await runMigrations(db, MIGRATIONS);
    await runDrizzleMigrations(db);
    await db.runAsync(
      `insert into fridge_items
       (id, household_id, name, quantity, unit, created_at, updated_at, opened_at)
       values (?, ?, ?, ?, ?, ?, ?, ?)`,
      ['item-sealed', 'hh-1', 'Milch', 4, 'piece', '2026-09-07T10:00:00.000Z', 0, null],
    );
    await db.runAsync(
      `insert into fridge_items
       (id, household_id, name, quantity, unit, created_at, updated_at, opened_at)
       values (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        'item-opened',
        'hh-1',
        'Milch',
        1,
        'piece',
        '2026-09-07T10:00:00.000Z',
        0,
        '2026-09-07T10:00:00.000Z',
      ],
    );

    const payload = {
      reversal_transaction_id: 'merge-undo-transaction-1',
      reversal_of: 'split-transaction-1',
      household_id: 'hh-1',
      created_at: '2026-09-07T10:05:00.000Z',
      notes: '[Undone] Öffnung rückgängig gemacht',
      opened_item_id: 'item-opened',
    };
    // Der Merge-Undo (entity_id = item-sealed) betrifft auch item-opened — es
    // wird tombstoned. Eine unabhaengig aussehende Folgeoperation auf genau
    // diesem Los darf nicht laufen, solange der Merge-Undo im selben Batch
    // dauerhaft scheitert: sie beruht moeglicherweise auf dessen Ergebnis.
    await enqueueMutation(db, {
      ...createInventoryMergeUndoMutation({
        payload,
        sealedItemId: 'item-sealed',
        sealedQuantityAfterMerge: 5,
        openedItemId: 'item-opened',
        transaction: {
          id: payload.reversal_transaction_id,
          household_id: 'hh-1',
          fridge_item_id: 'item-sealed',
          product_id: null,
          actor: 'user-1',
          type: 'open',
          quantity: 1,
          location_id: null,
          previous_expiry_date: null,
          notes: payload.notes,
          undone: false,
          reversal_of: payload.reversal_of,
          created_at: payload.created_at,
        },
        nowMs: 1,
      }),
      now: 1,
    });
    await enqueueMutation(db, {
      ...createInventoryQuantityCorrectionMutation({
        payload: {
          operation_id: 'op-correct-opened',
          transaction_id: 'tx-correct-opened',
          item_id: 'item-opened',
          household_id: 'hh-1',
          expected_quantity: 1,
          new_quantity: 0,
          created_at: '2026-09-07T10:06:00.000Z',
        },
        transaction: {
          id: 'tx-correct-opened',
          operation_id: 'op-correct-opened',
          household_id: 'hh-1',
          fridge_item_id: 'item-opened',
          product_id: null,
          actor: 'user-1',
          type: 'out',
          quantity: 1,
          location_id: null,
          reason: null,
          previous_expiry_date: null,
          notes: '[Manual correction]',
          undone: false,
          created_at: '2026-09-07T10:06:00.000Z',
        },
        nowMs: 2,
      }),
      now: 2,
    });

    const rpc = jest
      .fn()
      .mockResolvedValue({ data: null, error: { message: 'Split-Loese veraendert' }, status: 409 });
    const client = { rpc } as unknown as TypedSupabaseClient;

    try {
      const result = await pushOutbox({ db, supabase: client, now: () => 3 });

      expect(result.outcomes).toMatchObject([
        { kind: 'failed-permanent', entityId: 'item-sealed' },
      ]);
      // Nur die Merge-Undo-RPC laeuft; die Korrektur auf item-opened wird
      // zurueckgehalten, nicht separat versucht.
      expect(rpc).toHaveBeenCalledTimes(1);
      expect(
        await db.getAllAsync<{ entity_id: string; attempts: number }>(
          'select entity_id, attempts from outbox order by id',
        ),
      ).toEqual([
        { entity_id: 'item-sealed', attempts: MAX_ATTEMPTS },
        { entity_id: 'item-opened', attempts: 0 },
      ]);
    } finally {
      db.close();
    }
  });
});

describe('pushOutbox — Inventory-Move-Reversal', () => {
  it('erkennt die Provenienz aus der Outbox und ruft die Reversal-RPC auf', async () => {
    const db = createTestDatabase();
    await runMigrations(db, MIGRATIONS);
    await runDrizzleMigrations(db);

    const payload = {
      operation_id: 'move-reversal-1',
      item_id: 'item-1',
      household_id: 'hh-1',
      expected_location_id: 'loc-2',
      new_location_id: 'loc-1',
      expected_quantity: 2,
      out_transaction_id: 'txn-out-reversal-1',
      in_transaction_id: 'txn-in-reversal-1',
      created_at: '2026-09-07T10:00:00.000Z',
      reversal_of: 'move-original-1',
      notes: '[Undone] Gegenbuchung',
    };

    await enqueueMutation(db, {
      entity: 'fridge_items',
      entityId: 'item-1',
      op: 'move',
      payload,
      now: 1,
      applyLocally: async () => {},
    });

    const remoteRow = {
      id: 'item-1',
      household_id: 'hh-1',
      location_id: 'loc-1',
      product_id: null,
      name: 'Milch',
      quantity: 2,
      unit: 'piece',
      package_size: null,
      package_size_unit: null,
      expiry_date: null,
      added_by: 'user-1',
      created_at: '2026-09-07T09:00:00.000Z',
      opened_at: null,
      vacuum_sealed: false,
      expiry_user_set: false,
      updated_at: '2026-09-07T10:00:01.000Z',
      deleted_at: null,
    };
    const maybeSingle = jest.fn().mockResolvedValue({ data: remoteRow, error: null, status: 200 });
    const eq = jest.fn().mockReturnValue({ maybeSingle });
    const rpc = jest.fn().mockResolvedValue({ data: 'item-1', error: null, status: 200 });
    const client = {
      rpc,
      from: jest.fn().mockReturnValue({ select: jest.fn().mockReturnValue({ eq }) }),
    } as unknown as TypedSupabaseClient;

    try {
      const result = await pushOutbox({ db, supabase: client, now: () => 2 });

      expect(result.outcomes[0]).toMatchObject({ kind: 'pushed', entity: 'fridge_items' });
      expect(rpc).toHaveBeenCalledWith(
        'reverse_move_fridge_item',
        expect.objectContaining({
          p_reversal_of: 'move-original-1',
          p_notes: '[Undone] Gegenbuchung',
        }),
      );
      expect(
        await db.getFirstAsync('select id from outbox where entity_id = ?', ['item-1']),
      ).toBeNull();
    } finally {
      db.close();
    }
  });
});
