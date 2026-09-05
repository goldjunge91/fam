import { getDatabase } from '@/lib/db/client';
import { onOutboxChanged } from '@/lib/db/outbox';
import { createTestDatabase, type TestDatabase } from '../../../test/node-sqlite-adapter';
import { applyInventoryConsumptionPlan } from './apply-inventory-consumption';

jest.mock('@/lib/db/client', () => ({ getDatabase: jest.fn() }));
jest.mock('@/lib/telemetry', () => ({ addDiagnosticStep: jest.fn(), reportError: jest.fn() }));

describe('confirmed inventory consumption', () => {
  let db: TestDatabase;
  const plan = ['a', 'b'].map((id) => ({
    id,
    household_id: 'hh',
    delta: -2,
    operation: 'consume' as const,
  }));

  beforeEach(async () => {
    db = createTestDatabase();
    jest.mocked(getDatabase).mockResolvedValue(db);
    await db.execAsync(`
      create table fridge_items (id text primary key, household_id text, quantity real,
        unit text, deleted_at integer, updated_at integer, _dirty integer default 0);
      insert into fridge_items values ('a', 'hh', 5, 'g', null, 0, 0), ('b', 'hh', 5, 'g', null, 0, 0);
      create table outbox (id integer primary key, entity text, entity_id text, op text,
        payload text, created_at integer, attempts integer, next_attempt_at integer);
    `);
  });
  afterEach(() => {
    jest.restoreAllMocks();
    db.close();
  });

  it('commits consumption and outbox together', async () => {
    expect(await applyInventoryConsumptionPlan(plan)).toHaveLength(2);
    expect(await db.getAllAsync('select quantity from fridge_items order by id')).toEqual([
      { quantity: 3 },
      { quantity: 3 },
    ]);
    expect(await db.getAllAsync('select entity_id from outbox order by id')).toEqual([
      { entity_id: 'a' },
      { entity_id: 'b' },
    ]);
  });

  it('queues deletions when the confirmed consumption empties the stock', async () => {
    const result = await applyInventoryConsumptionPlan(
      plan.map((item) => ({ ...item, delta: -5 })),
    );
    expect(result.every((item) => item.depleted)).toBe(true);
    expect(await db.getAllAsync('select id from fridge_items where deleted_at is null')).toEqual(
      [],
    );
    expect(await db.getAllAsync('select op from outbox order by id')).toEqual([
      { op: 'delete' },
      { op: 'delete' },
    ]);
  });

  it.each([
    ['quantity = 1', 'inventory_quantity_changed'],
    ["unit = 'kg'", 'inventory_quantity_changed'],
    ['deleted_at = 1', 'inventory_item_missing'],
    ["household_id = 'other'", 'inventory_household_mismatch'],
  ])(
    'rolls the whole batch back if %s changes before the write transaction',
    async (change, error) => {
      const transaction = db.withExclusiveTransactionAsync.bind(db);
      jest.spyOn(db, 'withExclusiveTransactionAsync').mockImplementationOnce(async (task) => {
        await db.execAsync(`update fridge_items set ${change} where id = 'b'`);
        await transaction(task);
      });
      const listener = jest.fn();
      const unsubscribe = onOutboxChanged(listener);
      try {
        await expect(applyInventoryConsumptionPlan(plan)).rejects.toThrow(error);
        expect(await db.getFirstAsync("select quantity from fridge_items where id = 'a'")).toEqual({
          quantity: 5,
        });
        expect(await db.getAllAsync('select * from outbox')).toEqual([]);
        expect(listener).not.toHaveBeenCalled();
      } finally {
        unsubscribe();
      }
    },
  );

  it('rejects already deleted inventory without queuing a mutation', async () => {
    await db.execAsync("update fridge_items set deleted_at = 1 where id = 'a'");
    await expect(applyInventoryConsumptionPlan(plan)).rejects.toThrow('inventory_item_missing');
    expect(await db.getAllAsync('select * from outbox')).toEqual([]);
  });

  it('rolls back an earlier deletion if a later stock item changed', async () => {
    const transaction = db.withExclusiveTransactionAsync.bind(db);
    jest.spyOn(db, 'withExclusiveTransactionAsync').mockImplementationOnce(async (task) => {
      await db.execAsync("update fridge_items set quantity = 6 where id = 'b'");
      await transaction(task);
    });
    await expect(
      applyInventoryConsumptionPlan(plan.map((item) => ({ ...item, delta: -5 }))),
    ).rejects.toThrow('inventory_quantity_changed');
    expect(
      await db.getFirstAsync("select quantity, deleted_at from fridge_items where id = 'a'"),
    ).toEqual({ quantity: 5, deleted_at: null });
    expect(await db.getAllAsync('select * from outbox')).toEqual([]);
  });
});
