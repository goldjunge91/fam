import { runDrizzleMigrations } from '@/lib/db/drizzle-migrator';
import { MIGRATIONS } from '@/lib/db/migrations';
import { runMigrations } from '@/lib/db/migrator';
import {
  createInventoryMergeUndoMutation,
  createInventoryQuantityCorrectionMutation,
  createInventoryQuantityMutation,
  createInventoryQuantityReversalMutation,
  createInventorySplitMutation,
  parseInventoryMergeUndoPayload,
  parseInventoryQuantityCorrectionPayload,
  parseInventoryQuantityPayload,
  parseInventoryQuantityReversalPayload,
  parseInventorySplitPayload,
} from '@/lib/sync/inventory-quantity';

import { createTestDatabase } from '../../../test/node-sqlite-adapter';

describe('createInventoryQuantityMutation', () => {
  it('schreibt bei vollständigem Verbrauch lokal Menge null in den Tombstone', async () => {
    const db = createTestDatabase();
    await runMigrations(db, MIGRATIONS);
    await runDrizzleMigrations(db);
    await db.runAsync(
      `insert into fridge_items
       (id, household_id, name, quantity, unit, created_at, updated_at)
       values (?, ?, ?, ?, ?, ?, ?)`,
      ['item-quantity', 'hh-1', 'Milch', 3, 'piece', '2026-09-07T10:00:00.000Z', 0],
    );

    const mutation = createInventoryQuantityMutation({
      payload: {
        operation_id: 'quantity-operation-1',
        transaction_id: 'quantity-transaction-1',
        item_id: 'item-quantity',
        household_id: 'hh-1',
        delta: -3,
        created_at: '2026-09-07T10:00:00.000Z',
      },
      transaction: {
        id: 'quantity-transaction-1',
        operation_id: 'quantity-operation-1',
        household_id: 'hh-1',
        fridge_item_id: 'item-quantity',
        type: 'out',
        quantity: 3,
        undone: false,
        created_at: '2026-09-07T10:00:00.000Z',
      },
      resultQuantity: 0,
      nowMs: 1,
    });

    try {
      await mutation.applyLocally(db);

      await expect(
        db.getFirstAsync<{ quantity: number; deleted_at: number | null }>(
          'select quantity, deleted_at from fridge_items where id = ?',
          ['item-quantity'],
        ),
      ).resolves.toEqual({ quantity: 0, deleted_at: 1 });
    } finally {
      db.close();
    }
  });
});

describe('parseInventoryQuantityPayload', () => {
  it('weist Deltas mit mehr als drei Nachkommastellen vor dem RPC zurück', () => {
    expect(() =>
      parseInventoryQuantityPayload({
        operation_id: 'quantity-operation-1',
        transaction_id: 'quantity-transaction-1',
        item_id: 'item-quantity',
        household_id: 'hh-1',
        delta: -0.1001,
        created_at: '2026-09-07T10:00:00.000Z',
      }),
    ).toThrow('drei Nachkommastellen');
  });
});

describe('parseInventoryQuantityCorrectionPayload', () => {
  const payload = {
    operation_id: 'operation-1',
    transaction_id: 'transaction-1',
    item_id: 'item-1',
    household_id: 'household-1',
    expected_quantity: 1100,
    new_quantity: 100,
    created_at: '2026-09-07T10:00:00.000Z',
  };

  it('validiert erwartete und neue Menge als Integer-Tausendstel', () => {
    expect(parseInventoryQuantityCorrectionPayload(payload)).toEqual(payload);
  });

  it('weist eine nicht-ganzzahlige Menge zurueck (contract.md Abschnitt 3: Integer-Tausendstel)', () => {
    expect(() =>
      parseInventoryQuantityCorrectionPayload({ ...payload, new_quantity: 100.5 }),
    ).toThrow('Mengenkorrektur-Payload');
  });

  it('weist identische erwartete und neue Menge zurueck', () => {
    expect(() =>
      parseInventoryQuantityCorrectionPayload({
        ...payload,
        new_quantity: payload.expected_quantity,
      }),
    ).toThrow('unterschiedliche');
  });

  it('schreibt Bestand und Ledger lokal in einer Outbox-Operation', async () => {
    const runAsync = jest.fn().mockResolvedValue({ changes: 1, lastInsertRowId: 1 });
    const mutation = createInventoryQuantityCorrectionMutation({
      payload,
      transaction: {
        id: 'transaction-1',
        household_id: 'household-1',
        fridge_item_id: 'item-1',
        type: 'out',
        quantity: 1000,
      },
      nowMs: 1,
    });

    await mutation.applyLocally({ runAsync } as never);

    expect(mutation).toMatchObject({
      entity: 'fridge_items',
      entityId: 'item-1',
      op: 'correct_quantity',
      payload,
    });
    expect(runAsync).toHaveBeenCalledTimes(2);
  });
});

describe('parseInventoryQuantityReversalPayload', () => {
  const payload = {
    reversal_transaction_id: 'reversal-1',
    reversal_of: 'source-1',
    item_id: 'item-1',
    household_id: 'household-1',
    created_at: '2026-09-07T10:00:00.000Z',
    notes: '[Undone] Gegenbuchung',
  };

  it('fordert eine stabile Reversal-ID und Provenienz', () => {
    expect(parseInventoryQuantityReversalPayload(payload)).toEqual(payload);
    expect(() => parseInventoryQuantityReversalPayload({ ...payload, reversal_of: '' })).toThrow(
      'reversal_of',
    );
  });

  it('schreibt Bestandsänderung und Gegenbuchung lokal in einer Operation', async () => {
    const runAsync = jest.fn().mockResolvedValue({ changes: 1, lastInsertRowId: 1 });
    const mutation = createInventoryQuantityReversalMutation({
      payload,
      transaction: {
        id: 'reversal-1',
        household_id: 'household-1',
        fridge_item_id: 'item-1',
        type: 'in',
        quantity: 1000,
        reversal_of: 'source-1',
      },
      resultQuantity: 2000,
      restore: false,
      nowMs: 1,
    });

    await mutation.applyLocally({ runAsync } as never);

    expect(mutation).toMatchObject({
      entity: 'fridge_items',
      entityId: 'item-1',
      op: 'reverse_quantity',
      payload,
    });
    expect(runAsync).toHaveBeenCalledTimes(2);
  });
});

describe('parseInventorySplitPayload', () => {
  const payload = {
    transaction_id: 'transaction-1',
    source_item_id: 'source-1',
    opened_item_id: 'opened-1',
    household_id: 'household-1',
    expected_source_quantity: 5000,
    open_quantity: 1000,
    opened_at: '2026-09-07T10:00:00.000Z',
    new_expiry_date: '2026-09-10',
    expiry_user_set: true,
    created_at: '2026-09-07T10:00:00.000Z',
  };

  it('validiert Ausgangs- und Öffnungsmenge als Integer-Tausendstel', () => {
    expect(parseInventorySplitPayload(payload)).toEqual(payload);
    expect(() => parseInventorySplitPayload({ ...payload, open_quantity: 6000 })).toThrow(
      'höchstens die Ausgangsmenge',
    );
    expect(() => parseInventorySplitPayload({ ...payload, open_quantity: 0 })).toThrow(
      'keine gueltige Menge',
    );
  });

  it('weist identische Quell- und Ziel-IDs zurueck', () => {
    expect(() =>
      parseInventorySplitPayload({ ...payload, opened_item_id: payload.source_item_id }),
    ).toThrow('zwei unterschiedliche Bestands-IDs');
  });

  it('schreibt Rest-Los, geoeffnetes Los und Ledger lokal in einer Outbox-Operation', async () => {
    const runAsync = jest.fn().mockResolvedValue({ changes: 1, lastInsertRowId: 1 });
    const mutation = createInventorySplitMutation({
      payload,
      openedItem: { id: 'opened-1', household_id: 'household-1' },
      transaction: {
        id: 'transaction-1',
        household_id: 'household-1',
        fridge_item_id: 'opened-1',
        type: 'open',
        quantity: 1000,
      },
      nowMs: 1,
    });

    await mutation.applyLocally({ runAsync } as never);

    expect(mutation).toMatchObject({
      entity: 'fridge_items',
      entityId: 'source-1',
      op: 'split_open',
      payload,
    });
    expect(runAsync).toHaveBeenCalledTimes(3);
  });

  it('loescht das Rest-Los weich, wenn die Öffnungsmenge alles verbraucht', async () => {
    const runAsync = jest.fn().mockResolvedValue({ changes: 1, lastInsertRowId: 1 });
    const mutation = createInventorySplitMutation({
      payload: { ...payload, expected_source_quantity: 1000, open_quantity: 1000 },
      openedItem: { id: 'opened-1', household_id: 'household-1' },
      transaction: {
        id: 'transaction-1',
        household_id: 'household-1',
        fridge_item_id: 'opened-1',
        type: 'open',
        quantity: 1000,
      },
      nowMs: 1,
    });

    await mutation.applyLocally({ runAsync } as never);
    expect(runAsync).toHaveBeenCalledTimes(3);
    expect(runAsync.mock.calls[0]?.[0]).toEqual(expect.stringContaining('deleted_at'));
  });
});

describe('parseInventoryMergeUndoPayload', () => {
  const payload = {
    reversal_transaction_id: 'reversal-1',
    reversal_of: 'original-1',
    household_id: 'household-1',
    created_at: '2026-09-07T10:05:00.000Z',
    notes: '[Undone] Öffnung rückgängig gemacht',
    opened_item_id: 'opened-1',
  };

  it('validiert alle Pflichtfelder', () => {
    expect(parseInventoryMergeUndoPayload(payload)).toEqual(payload);
    expect(() => parseInventoryMergeUndoPayload({ ...payload, notes: '' })).toThrow(
      'kein gueltiges Feld notes',
    );
    expect(() => parseInventoryMergeUndoPayload({ ...payload, opened_item_id: '' })).toThrow(
      'kein gueltiges Feld opened_item_id',
    );
  });

  it('schreibt versiegeltes Los, geoeffnetes Los und Gegenbuchung lokal in einer Outbox-Operation', async () => {
    const runAsync = jest.fn().mockResolvedValue({ changes: 1, lastInsertRowId: 1 });
    const mutation = createInventoryMergeUndoMutation({
      payload,
      sealedItemId: 'sealed-1',
      sealedQuantityAfterMerge: 5000,
      openedItemId: 'opened-1',
      transaction: {
        id: 'reversal-1',
        household_id: 'household-1',
        fridge_item_id: 'sealed-1',
        type: 'open',
        quantity: 1000,
        reversal_of: 'original-1',
      },
      nowMs: 1,
    });

    await mutation.applyLocally({ runAsync } as never);

    expect(mutation).toMatchObject({
      entity: 'fridge_items',
      entityId: 'sealed-1',
      op: 'merge_undo_open',
      payload,
    });
    expect(runAsync).toHaveBeenCalledTimes(3);
  });
});
