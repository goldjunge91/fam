import { enqueueMutations, onOutboxChanged } from '@/lib/db/outbox';
import { createTestDatabase, type TestDatabase } from '../../../test/node-sqlite-adapter';

async function insertStorageLocation(db: TestDatabase, id: string): Promise<void> {
  await db.runAsync(
    'insert into storage_locations (id, household_id, name, kind, updated_at) values (?, ?, ?, ?, ?)',
    [id, 'hh-1', id, 'fridge', 1000],
  );
}

describe('enqueueMutations', () => {
  let db: TestDatabase;

  beforeEach(async () => {
    db = createTestDatabase();
    await db.execAsync(`
      create table outbox (
        id integer primary key autoincrement,
        entity text not null,
        entity_id text not null,
        op text not null,
        payload text not null,
        created_at integer not null,
        attempts integer not null default 0,
        last_error text,
        next_attempt_at integer not null default 0
      );
      create table storage_locations (
        id text primary key not null,
        household_id text not null,
        name text not null,
        kind text not null,
        updated_at integer not null
      );
    `);
  });

  afterEach(() => db.close());

  it('commits all mutations and notifies once', async () => {
    const listener = jest.fn();
    const unsubscribe = onOutboxChanged(listener);

    await enqueueMutations(db, [
      {
        entity: 'storage_locations',
        entityId: 'a',
        op: 'insert',
        payload: { id: 'a' },
        now: 10,
        applyLocally: (txn) => insertStorageLocation(txn as TestDatabase, 'a'),
      },
      {
        entity: 'storage_locations',
        entityId: 'b',
        op: 'insert',
        payload: { id: 'b' },
        now: 11,
        applyLocally: (txn) => insertStorageLocation(txn as TestDatabase, 'b'),
      },
    ]);

    unsubscribe();
    expect(listener).toHaveBeenCalledTimes(1);
    expect(await db.getAllAsync('select id from storage_locations order by id')).toEqual([
      { id: 'a' },
      { id: 'b' },
    ]);
    expect(await db.getAllAsync('select entity_id, created_at from outbox order by id')).toEqual([
      { entity_id: 'a', created_at: 10 },
      { entity_id: 'b', created_at: 11 },
    ]);
  });

  it('rolls back every mutation and sends no notification when one fails', async () => {
    const listener = jest.fn();
    const unsubscribe = onOutboxChanged(listener);

    await expect(
      enqueueMutations(db, [
        {
          entity: 'storage_locations',
          entityId: 'a',
          op: 'insert',
          payload: { id: 'a' },
          applyLocally: (txn) => insertStorageLocation(txn as TestDatabase, 'a'),
        },
        {
          entity: 'storage_locations',
          entityId: 'b',
          op: 'insert',
          payload: { id: 'b' },
          applyLocally: async (txn) => {
            await insertStorageLocation(txn as TestDatabase, 'b');
            throw new Error('rollback batch');
          },
        },
      ]),
    ).rejects.toThrow('rollback batch');

    unsubscribe();
    expect(listener).not.toHaveBeenCalled();
    expect(await db.getAllAsync('select id from storage_locations')).toEqual([]);
    expect(await db.getAllAsync('select * from outbox')).toEqual([]);
  });
});
