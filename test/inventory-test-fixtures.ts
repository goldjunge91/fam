import type { LocalInventoryItem } from '@/features/inventory/use-inventory-items';
import type { SqlDatabase } from '@/lib/db/types';

export const ACTOR_ID = 'actor-1';

export const ITEM_BASE: LocalInventoryItem = {
  id: 'item-1',
  household_id: 'hh-1',
  location_id: 'loc-old',
  product_id: 'product-1',
  name: 'Milch',
  quantity: 3,
  unit: 'piece',
  package_size: null,
  package_size_unit: null,
  expiry_date: '2026-12-31',
  opened_at: null,
  vacuum_sealed: false,
  expiry_user_set: false,
  added_by: ACTOR_ID,
  created_at: '2026-09-07T10:00:00.000Z',
  location_kind: 'fridge',
  location_name: 'Kühlschrank',
};

type DbRunner = Pick<SqlDatabase, 'runAsync'>;
type DbReader = Pick<SqlDatabase, 'getAllAsync'>;

export async function insertItem(
  db: DbRunner,
  item: LocalInventoryItem = ITEM_BASE,
): Promise<void> {
  await db.runAsync(
    `insert into fridge_items
       (id, household_id, location_id, product_id, name, quantity, unit,
        package_size, package_size_unit, expiry_date, added_by, created_at,
        updated_at, deleted_at, _dirty, opened_at, vacuum_sealed, expiry_user_set)
     values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      item.id,
      item.household_id,
      item.location_id,
      item.product_id,
      item.name,
      item.quantity,
      item.unit,
      item.package_size,
      item.package_size_unit,
      item.expiry_date,
      item.added_by,
      item.created_at,
      1,
      null,
      0,
      item.opened_at ?? null,
      item.vacuum_sealed ? 1 : 0,
      item.expiry_user_set ? 1 : 0,
    ],
  );
}

export async function rowsForItem(db: DbReader, itemId: string) {
  return db.getAllAsync<{
    id: string;
    type: string;
    quantity: number;
    location_id: string | null;
    operation_id: string | null;
    reason: string | null;
    previous_expiry_date: string | null;
    notes: string | null;
    reversal_of: string | null;
  }>(
    `select id, type, quantity, location_id, operation_id, reason,
            previous_expiry_date, notes, reversal_of
       from transactions
      where fridge_item_id = ?
      order by rowid`,
    [itemId],
  );
}

export type InsertTransactionOptions = {
  id: string;
  household_id?: string;
  fridge_item_id?: string | null;
  product_id?: string | null;
  type: 'in' | 'out' | 'waste' | 'open';
  quantity: number;
  location_id?: string | null;
  reason?: 'expired' | 'spoiled' | 'other' | null;
  previous_expiry_date?: string | null;
  notes?: string | null;
  operation_id?: string | null;
  reversal_of?: string | null;
  created_at?: string;
};

export async function insertTransaction(
  db: DbRunner,
  transaction: InsertTransactionOptions,
): Promise<void> {
  await db.runAsync(
    `insert into transactions
       (id, operation_id, reversal_of, household_id, fridge_item_id, product_id,
        actor, type, quantity, location_id, reason, previous_expiry_date, notes,
        undone, created_at, updated_at, _dirty)
     values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, 0)`,
    [
      transaction.id,
      transaction.operation_id ?? null,
      transaction.reversal_of ?? null,
      transaction.household_id ?? 'hh-1',
      transaction.fridge_item_id ?? 'item-1',
      transaction.product_id ?? 'product-1',
      ACTOR_ID,
      transaction.type,
      transaction.quantity,
      transaction.location_id ?? 'loc-old',
      transaction.reason ?? null,
      transaction.previous_expiry_date ?? null,
      transaction.notes ?? null,
      transaction.created_at ?? new Date().toISOString(),
      1,
    ],
  );
}

export async function outboxRows(db: DbReader) {
  return db.getAllAsync<{ entity: string; entity_id: string; op: string; payload: string }>(
    'select entity, entity_id, op, payload from outbox order by id',
  );
}
