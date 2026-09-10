import {
  type EnqueueMutationBuilder,
  enqueueMutations,
  enqueueMutationsInExclusiveTransaction,
  onOutboxChanged,
} from '@/lib/db/outbox';
import type { SqlDatabase } from '@/lib/db/types';
import { createTestDatabase, type TestDatabase } from '../../../test/node-sqlite-adapter';

jest.mock('@/lib/telemetry', () => ({
  addDiagnosticStep: jest.fn(),
  reportError: jest.fn(),
}));

async function insertStorageLocation(db: SqlDatabase, id: string): Promise<void> {
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
        applyLocally: (txn) => insertStorageLocation(txn, 'a'),
      },
      {
        entity: 'storage_locations',
        entityId: 'b',
        op: 'insert',
        payload: { id: 'b' },
        now: 11,
        applyLocally: (txn) => insertStorageLocation(txn, 'b'),
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
          applyLocally: (txn) => insertStorageLocation(txn, 'a'),
        },
        {
          entity: 'storage_locations',
          entityId: 'b',
          op: 'insert',
          payload: { id: 'b' },
          applyLocally: async (txn) => {
            await insertStorageLocation(txn, 'b');
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

  it('builds inside one exclusive transaction and notifies once after commit', async () => {
    await insertStorageLocation(db, 'seed');
    const listener = jest.fn();
    const unsubscribe = onOutboxChanged(listener);
    const transaction = jest.spyOn(db, 'withExclusiveTransactionAsync');
    let freshRead: string | null = null;
    let builderTxn: SqlDatabase | null = null;
    let applyTxn: SqlDatabase | null = null;

    const builder: EnqueueMutationBuilder = async (txn) => {
      builderTxn = txn;
      const row = await txn.getFirstAsync<{ id: string }>(
        'select id from storage_locations where id = ?',
        ['seed'],
      );
      freshRead = row?.id ?? null;

      return [
        {
          entity: 'storage_locations',
          entityId: 'created-in-transaction',
          op: 'insert',
          payload: { id: 'created-in-transaction' },
          now: 10,
          applyLocally: (innerTxn) => {
            applyTxn = innerTxn;
            return insertStorageLocation(innerTxn, 'created-in-transaction');
          },
        },
      ];
    };

    await enqueueMutationsInExclusiveTransaction(db, builder);

    unsubscribe();
    expect(freshRead).toBe('seed');
    expect(applyTxn).toBe(builderTxn);
    expect(transaction).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(await db.getAllAsync('select id from storage_locations order by id')).toEqual([
      { id: 'created-in-transaction' },
      { id: 'seed' },
    ]);
    expect(await db.getAllAsync('select entity_id, created_at from outbox')).toEqual([
      { entity_id: 'created-in-transaction', created_at: 10 },
    ]);
  });

  it('benachrichtigt bei einem leeren Builder-Batch nicht', async () => {
    const listener = jest.fn();
    const unsubscribe = onOutboxChanged(listener);
    const builder: EnqueueMutationBuilder = async () => [];

    await enqueueMutationsInExclusiveTransaction(db, builder);

    unsubscribe();
    expect(listener).not.toHaveBeenCalled();
    expect(await db.getAllAsync('select * from outbox')).toEqual([]);
  });

  it('rolls back Builderfehler und benachrichtigt nicht', async () => {
    const listener = jest.fn();
    const unsubscribe = onOutboxChanged(listener);
    const builder: EnqueueMutationBuilder = async () => {
      throw new Error('builder failed');
    };

    await expect(enqueueMutationsInExclusiveTransaction(db, builder)).rejects.toThrow(
      'builder failed',
    );

    unsubscribe();
    expect(listener).not.toHaveBeenCalled();
    expect(await db.getAllAsync('select * from outbox')).toEqual([]);
    expect(await db.getAllAsync('select id from storage_locations')).toEqual([]);
  });

  it('rolls back alle Batch-Writes und benachrichtigt nicht bei einem Fehler zwischen Writes', async () => {
    const listener = jest.fn();
    const unsubscribe = onOutboxChanged(listener);
    const builder: EnqueueMutationBuilder = async () => [
      {
        entity: 'storage_locations',
        entityId: 'first',
        op: 'insert',
        payload: { id: 'first' },
        now: 10,
        applyLocally: (txn) => insertStorageLocation(txn, 'first'),
      },
      {
        entity: 'storage_locations',
        entityId: 'second',
        op: 'insert',
        payload: { id: 'second' },
        now: 11,
        applyLocally: async (txn) => {
          await insertStorageLocation(txn, 'second');
          throw new Error('between writes');
        },
      },
    ];

    await expect(enqueueMutationsInExclusiveTransaction(db, builder)).rejects.toThrow(
      'between writes',
    );

    unsubscribe();
    expect(listener).not.toHaveBeenCalled();
    expect(await db.getAllAsync('select id from storage_locations')).toEqual([]);
    expect(await db.getAllAsync('select * from outbox')).toEqual([]);
  });
});
