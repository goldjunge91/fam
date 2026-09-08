import { runDrizzleMigrations } from '@/lib/db/drizzle-migrator';
import { MIGRATIONS } from '@/lib/db/migrations';
import { runMigrations } from '@/lib/db/migrator';
import { enqueueMutation, recordOutboxOutcome } from '@/lib/db/outbox';
import { MAX_ATTEMPTS } from '@/lib/sync/backoff';
import { createInventoryQuantityMutation } from '@/lib/sync/inventory-quantity';
import { createInventoryQuantityCorrectionMutation } from '@/lib/sync/inventory-quantity-correction';

import { createTestDatabase } from '../../../test/node-sqlite-adapter';
import { getFridgeItemConflicts } from './outbox-conflicts';

describe('getFridgeItemConflicts', () => {
  async function makeDb() {
    const db = createTestDatabase();
    await runMigrations(db, MIGRATIONS);
    await runDrizzleMigrations(db);
    await db.runAsync(
      `insert into fridge_items
       (id, household_id, name, quantity, unit, created_at, updated_at)
       values (?, ?, ?, ?, ?, ?, ?)`,
      ['item-1', 'hh-1', 'Milch', 3, 'piece', '2026-09-07T10:00:00.000Z', 0],
    );
    return db;
  }

  it('liefert nichts, wenn keine Mengenoperation dauerhaft gescheitert ist', async () => {
    const db = await makeDb();
    try {
      expect(await getFridgeItemConflicts(db)).toEqual([]);
    } finally {
      db.close();
    }
  });

  it('erkennt eine einzelne gescheiterte Korrektur als bestaetigbaren Konflikt', async () => {
    const db = await makeDb();
    try {
      await enqueueMutation(
        db,
        createInventoryQuantityCorrectionMutation({
          payload: {
            operation_id: 'op-1',
            transaction_id: 'tx-1',
            item_id: 'item-1',
            household_id: 'hh-1',
            expected_quantity: 5,
            new_quantity: 3,
            created_at: '2026-09-07T10:00:00.000Z',
          },
          transaction: {
            id: 'tx-1',
            operation_id: 'op-1',
            household_id: 'hh-1',
            fridge_item_id: 'item-1',
            product_id: null,
            actor: 'user-1',
            type: 'out',
            quantity: 2,
            location_id: null,
            reason: null,
            previous_expiry_date: null,
            notes: '[Manual correction]',
            undone: false,
            created_at: '2026-09-07T10:00:00.000Z',
          },
          nowMs: 1,
        }),
      );
      const [row] = await db.getAllAsync<{ id: number }>('select id from outbox order by id');
      await recordOutboxOutcome(db, [row.id], {
        attempts: MAX_ATTEMPTS,
        lastError: 'Bestand veraendert',
        nextAttemptAtMs: Number.MAX_SAFE_INTEGER,
      });

      const conflicts = await getFridgeItemConflicts(db);
      expect(conflicts).toHaveLength(1);
      expect(conflicts[0]).toMatchObject({
        itemId: 'item-1',
        sourceIds: [row.id],
        lastError: 'Bestand veraendert',
      });
      expect(conflicts[0].correction).toMatchObject({
        item_id: 'item-1',
        expected_quantity: 5,
        new_quantity: 3,
      });
    } finally {
      db.close();
    }
  });

  it('haelt eine dahinter wartende Folgeoperation fest, bietet aber kein Neu-Bestaetigen an', async () => {
    const db = await makeDb();
    try {
      await enqueueMutation(
        db,
        createInventoryQuantityCorrectionMutation({
          payload: {
            operation_id: 'op-1',
            transaction_id: 'tx-1',
            item_id: 'item-1',
            household_id: 'hh-1',
            expected_quantity: 5,
            new_quantity: 3,
            created_at: '2026-09-07T10:00:00.000Z',
          },
          transaction: {
            id: 'tx-1',
            operation_id: 'op-1',
            household_id: 'hh-1',
            fridge_item_id: 'item-1',
            product_id: null,
            actor: 'user-1',
            type: 'out',
            quantity: 2,
            location_id: null,
            reason: null,
            previous_expiry_date: null,
            notes: '[Manual correction]',
            undone: false,
            created_at: '2026-09-07T10:00:00.000Z',
          },
          nowMs: 1,
        }),
      );
      await enqueueMutation(
        db,
        createInventoryQuantityMutation({
          payload: {
            operation_id: 'op-2',
            transaction_id: 'tx-2',
            item_id: 'item-1',
            household_id: 'hh-1',
            delta: -1,
            created_at: '2026-09-07T10:00:01.000Z',
          },
          transaction: {
            id: 'tx-2',
            operation_id: 'op-2',
            household_id: 'hh-1',
            fridge_item_id: 'item-1',
            product_id: null,
            actor: 'user-1',
            type: 'out',
            quantity: 1,
            location_id: null,
            reason: null,
            previous_expiry_date: null,
            notes: null,
            undone: false,
            created_at: '2026-09-07T10:00:01.000Z',
          },
          resultQuantity: 2,
          nowMs: 2,
        }),
      );
      const rows = await db.getAllAsync<{ id: number }>('select id from outbox order by id');
      await recordOutboxOutcome(db, [rows[0].id], {
        attempts: MAX_ATTEMPTS,
        lastError: 'Bestand veraendert',
        nextAttemptAtMs: Number.MAX_SAFE_INTEGER,
      });

      const conflicts = await getFridgeItemConflicts(db);
      expect(conflicts).toHaveLength(1);
      expect(conflicts[0].sourceIds).toEqual(rows.map((row) => row.id));
      expect(conflicts[0].correction).toBeNull();
    } finally {
      db.close();
    }
  });

  it('ignoriert dauerhaft gescheiterte Nicht-Mengenoperationen (z. B. reguläres update)', async () => {
    const db = await makeDb();
    try {
      await enqueueMutation(db, {
        entity: 'fridge_items',
        entityId: 'item-1',
        op: 'update',
        payload: { id: 'item-1', name: 'Vollmilch' },
        now: 1,
        applyLocally: async () => {},
      });
      const [row] = await db.getAllAsync<{ id: number }>('select id from outbox order by id');
      await recordOutboxOutcome(db, [row.id], {
        attempts: MAX_ATTEMPTS,
        lastError: 'RLS verweigert',
        nextAttemptAtMs: Number.MAX_SAFE_INTEGER,
      });

      expect(await getFridgeItemConflicts(db)).toEqual([]);
    } finally {
      db.close();
    }
  });
});
