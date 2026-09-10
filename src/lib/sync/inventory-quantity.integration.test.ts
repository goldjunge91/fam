import {
  assertValidInventoryOperation,
  type InventoryOperationV1,
} from '@/features/inventory/inventory-lifecycle';
import { runDrizzleMigrations } from '@/lib/db/drizzle-migrator';
import type { OutboxEntry } from '@/lib/db/types';
import { createTestDatabase, type TestDatabase } from '../../../test/node-sqlite-adapter';
import { commitInventoryOperation } from './inventory-quantity';

const IDS = {
  household: '00000000-0000-4000-8000-000000000001',
  actor: '00000000-0000-4000-8000-000000000002',
  product: '00000000-0000-4000-8000-000000000003',
  location: '00000000-0000-4000-8000-000000000004',
  destination: '00000000-0000-4000-8000-000000000005',
  item: '00000000-0000-4000-8000-000000000006',
  insertOperation: '00000000-0000-4000-8000-000000000007',
  insertTransaction: '00000000-0000-4000-8000-000000000008',
  consumeOperation: '00000000-0000-4000-8000-000000000009',
  consumeTransaction: '00000000-0000-4000-8000-00000000000a',
  openedItem: '00000000-0000-4000-8000-00000000000b',
  correctionOperation: '00000000-0000-4000-8000-00000000000c',
  correctionTransaction: '00000000-0000-4000-8000-00000000000d',
  moveOperation: '00000000-0000-4000-8000-00000000000e',
  moveOutTransaction: '00000000-0000-4000-8000-00000000000f',
  moveInTransaction: '00000000-0000-4000-8000-000000000010',
} as const;
const INSERTED_AT = '2026-09-10T08:00:00.000Z';

function operation(value: Record<string, unknown>): InventoryOperationV1 {
  return assertValidInventoryOperation({
    contract_version: 1,
    household_id: IDS.household,
    ...value,
  });
}

function insertOperation(): InventoryOperationV1 {
  return operation({
    type: 'insert_inventory',
    operation_id: IDS.insertOperation,
    created_at: INSERTED_AT,
    item_id: IDS.item,
    in_transaction_id: IDS.insertTransaction,
    quantity: 500,
    product_id: IDS.product,
    name: 'Käse',
    unit: 'g',
    package_size: 500,
    package_size_unit: 'g',
    location_id: IDS.location,
    expiry_date: '2026-09-16',
    opened_at: null,
    vacuum_sealed: false,
    expiry_user_set: false,
  });
}

function partialConsumeOperation(): InventoryOperationV1 {
  return operation({
    type: 'consume_inventory',
    operation_id: IDS.consumeOperation,
    created_at: '2026-09-10T09:00:00.000Z',
    out_transaction_id: IDS.consumeTransaction,
    source_item_id: IDS.item,
    expected_quantity: 500,
    consumed_quantity: 200,
    product_id: IDS.product,
    unit: 'g',
    location_id: IDS.location,
    mode: 'sealed_partial',
    opened_item_id: IDS.openedItem,
    portion_quantity: 500,
    remainder_quantity: 300,
    opened_at: '2026-09-10T09:00:00.000Z',
    expiry_date: '2026-09-12',
    vacuum_sealed: false,
    expiry_user_set: false,
    merge_snapshot: {
      household_id: IDS.household,
      product_id: IDS.product,
      name: 'Käse',
      unit: 'g',
      package_size: 500,
      package_size_unit: 'g',
      location_id: IDS.location,
      expiry_date: '2026-09-16',
      opened_at: null,
      vacuum_sealed: false,
      expiry_user_set: false,
      added_by: IDS.actor,
      quantity_before: 500,
    },
  });
}

async function setupDatabase(): Promise<TestDatabase> {
  const db = createTestDatabase();
  await runDrizzleMigrations(db);
  return db;
}

async function outboxRows(db: TestDatabase): Promise<OutboxEntry[]> {
  return db.getAllAsync<OutboxEntry>('select * from outbox order by id asc');
}

describe('commitInventoryOperation phase 1', () => {
  let db: TestDatabase;

  beforeEach(async () => {
    db = await setupDatabase();
  });

  afterEach(() => db.close());

  it('writes insert inventory, IN ledger, and outbox atomically', async () => {
    const result = await commitInventoryOperation(db, insertOperation(), IDS.actor);

    expect(result).toMatchObject({
      kind: 'applied',
      operation_id: IDS.insertOperation,
      outbox_count: 2,
    });
    expect(
      await db.getFirstAsync<{ quantity: number; deleted_at: number | null }>(
        'select quantity, deleted_at from fridge_items where id = ?',
        [IDS.item],
      ),
    ).toEqual({ quantity: 500, deleted_at: null });
    expect(
      await db.getFirstAsync<{ type: string; quantity: number }>(
        'select type, quantity from transactions where id = ?',
        [IDS.insertTransaction],
      ),
    ).toEqual({ type: 'in', quantity: 500 });
    expect(await outboxRows(db)).toHaveLength(2);
  });

  it('commits sealed_partial with one OUT row for the opened remainder lot', async () => {
    await commitInventoryOperation(db, insertOperation(), IDS.actor);

    const result = await commitInventoryOperation(db, partialConsumeOperation(), IDS.actor);

    expect(result).toMatchObject({ kind: 'applied', outbox_count: 3 });
    expect(
      await db.getFirstAsync<{ quantity: number; deleted_at: number }>(
        'select quantity, deleted_at from fridge_items where id = ?',
        [IDS.item],
      ),
    ).toEqual({ quantity: 0, deleted_at: Date.parse('2026-09-10T09:00:00.000Z') });
    expect(
      await db.getFirstAsync<{ quantity: number; opened_at: string | null }>(
        'select quantity, opened_at from fridge_items where id = ?',
        [IDS.openedItem],
      ),
    ).toEqual({ quantity: 300, opened_at: '2026-09-10T09:00:00.000Z' });
    expect(
      await db.getFirstAsync<{ type: string; quantity: number; fridge_item_id: string }>(
        'select type, quantity, fridge_item_id from transactions where id = ?',
        [IDS.consumeTransaction],
      ),
    ).toEqual({ type: 'out', quantity: 200, fridge_item_id: IDS.openedItem });
  });

  it('keeps correction and move ledger rows within the three phase-1 types', async () => {
    await commitInventoryOperation(db, insertOperation(), IDS.actor);
    const correction = operation({
      type: 'correct_quantity',
      operation_id: IDS.correctionOperation,
      created_at: '2026-09-10T09:10:00.000Z',
      transaction_id: IDS.correctionTransaction,
      item_id: IDS.item,
      expected_quantity: 500,
      new_quantity: 499.5,
      product_id: IDS.product,
      unit: 'g',
      location_id: IDS.location,
    });
    await commitInventoryOperation(db, correction, IDS.actor);
    const move = operation({
      type: 'move_inventory',
      operation_id: IDS.moveOperation,
      created_at: '2026-09-10T09:20:00.000Z',
      out_transaction_id: IDS.moveOutTransaction,
      in_transaction_id: IDS.moveInTransaction,
      item_id: IDS.item,
      expected_quantity: 499.5,
      expected_location_id: IDS.location,
      to_location_id: IDS.destination,
      product_id: IDS.product,
      unit: 'g',
      location_id: IDS.location,
    });
    await commitInventoryOperation(db, move, IDS.actor);

    expect(
      await db.getAllAsync<{ type: string }>(
        'select type from transactions order by created_at asc, id asc',
      ),
    ).toEqual([{ type: 'in' }, { type: 'out' }, { type: 'out' }, { type: 'in' }]);
    expect(
      await db.getFirstAsync<{ location_id: string; quantity: number }>(
        'select location_id, quantity from fridge_items where id = ?',
        [IDS.item],
      ),
    ).toEqual({ location_id: IDS.destination, quantity: 499.5 });
  });

  it('replays a still-pending operation without adding another local effect', async () => {
    const insert = insertOperation();
    await commitInventoryOperation(db, insert, IDS.actor);

    expect(await commitInventoryOperation(db, insert, IDS.actor)).toMatchObject({
      kind: 'replayed',
      operation_id: IDS.insertOperation,
    });
    expect(await outboxRows(db)).toHaveLength(2);
  });
});
