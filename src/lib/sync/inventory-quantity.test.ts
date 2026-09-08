import { runDrizzleMigrations } from '@/lib/db/drizzle-migrator';
import { MIGRATIONS } from '@/lib/db/migrations';
import { runMigrations } from '@/lib/db/migrator';
import {
  createInventoryQuantityMutation,
  parseInventoryQuantityPayload,
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
