import { runDrizzleMigrations } from '@/lib/db/drizzle-migrator';
import { MIGRATIONS } from '@/lib/db/migrations';
import { runMigrations } from '@/lib/db/migrator';
import { enqueueMutation, recordOutboxOutcome } from '@/lib/db/outbox';
import type { TypedSupabaseClient } from '@/lib/supabase';
import { createInventoryQuantityMutation } from '@/lib/sync/inventory-quantity';
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
    const client = {
      from: jest.fn().mockReturnValue({ insert, update }),
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
