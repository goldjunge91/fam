import {
  acquireOutboxSignOutGuard,
  beginOutboxWriteProducer,
  enqueueMutations,
  OutboxWriteProducerActiveError,
  onOutboxChanged,
  parseOutboxEntry,
} from '@/lib/db/outbox';
import type { OutboxEntry } from '@/lib/db/types';
import { createTestDatabase, type TestDatabase } from '../../../test/node-sqlite-adapter';

jest.mock('@/lib/telemetry', () => ({
  addDiagnosticStep: jest.fn(),
  reportError: jest.fn(),
}));

function outboxEntry(payload: string, entity: OutboxEntry['entity'] = 'fridge_items'): OutboxEntry {
  return {
    id: 1,
    entity,
    entity_id: 'item-1',
    op: 'insert',
    payload,
    created_at: 1,
    attempts: 0,
    last_error: null,
    last_error_kind: null,
    next_attempt_at: 0,
  };
}

describe('parseOutboxEntry', () => {
  it('normalizes inventory units from older outbox payloads', () => {
    expect(parseOutboxEntry(outboxEntry('{"unit":"gramm"}'))).toEqual({ unit: 'g' });
  });

  it.each(['null', '1', '"text"', '[]'])('rejects non-object payload %s', (payload) => {
    expect(() => parseOutboxEntry(outboxEntry(payload))).toThrow('kein Objekt');
  });

  it('preserves payloads without a normalizable inventory unit', () => {
    expect(parseOutboxEntry(outboxEntry('{"unit":4}'))).toEqual({ unit: 4 });
    expect(parseOutboxEntry(outboxEntry('{"unit":"gramm"}', 'products'))).toEqual({
      unit: 'gramm',
    });
  });
});

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
      create table outbox_history (
        id integer primary key autoincrement,
        outbox_id integer not null,
        entity text not null,
        entity_id text not null,
        op text not null,
        payload text not null,
        created_at integer not null,
        status text not null default 'queued',
        attempts integer not null default 0,
        last_error text,
        last_error_kind text,
        updated_at integer not null,
        completed_at integer
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

  it('serializes concurrent mutations on the same database', async () => {
    let releaseFirstMutation!: () => void;
    let firstMutationStarted!: () => void;
    const firstStarted = new Promise<void>((resolve) => {
      firstMutationStarted = resolve;
    });
    const firstCanFinish = new Promise<void>((resolve) => {
      releaseFirstMutation = resolve;
    });

    const first = enqueueMutations(db, [
      {
        entity: 'storage_locations',
        entityId: 'a',
        op: 'insert',
        payload: { id: 'a' },
        now: 10,
        applyLocally: async (txn) => {
          await insertStorageLocation(txn as TestDatabase, 'a');
          firstMutationStarted();
          await firstCanFinish;
        },
      },
    ]);
    await firstStarted;

    const second = enqueueMutations(db, [
      {
        entity: 'storage_locations',
        entityId: 'b',
        op: 'insert',
        payload: { id: 'b' },
        now: 11,
        applyLocally: (txn) => insertStorageLocation(txn as TestDatabase, 'b'),
      },
    ]);

    releaseFirstMutation();
    await Promise.all([first, second]);

    expect(await db.getAllAsync('select entity_id from outbox order by id')).toEqual([
      { entity_id: 'a' },
      { entity_id: 'b' },
    ]);
  });

  it('weist servererzeugte Chef-History vor lokalem Write und Outbox ab', async () => {
    const applyLocally = jest.fn().mockResolvedValue(undefined);

    await expect(
      enqueueMutations(db, [
        {
          entity: 'chef_conversation_turns',
          entityId: 'turn-1',
          op: 'insert',
          payload: { id: 'turn-1' },
          applyLocally,
        },
      ]),
    ).rejects.toThrow('servererzeugt');

    expect(applyLocally).not.toHaveBeenCalled();
    expect(await db.getAllAsync('select * from outbox')).toEqual([]);
  });

  it('blocks the sign-out guard while a local write producer is active', async () => {
    const releaseProducer = beginOutboxWriteProducer();
    expect(releaseProducer).not.toBeNull();

    const guardError = await acquireOutboxSignOutGuard(db).catch((error: unknown) => error);
    expect(guardError).toBeInstanceOf(OutboxWriteProducerActiveError);
    expect(guardError).toMatchObject({ count: 1 });

    releaseProducer?.();
    const afterRelease = beginOutboxWriteProducer();
    expect(afterRelease).not.toBeNull();
    afterRelease?.();
  });

  it('allows only one sign-out guard per database', async () => {
    const guard = await acquireOutboxSignOutGuard(db);

    try {
      await expect(acquireOutboxSignOutGuard(db)).rejects.toThrow('bereits');
    } finally {
      guard.release();
    }
  });

  it('counts pending and failed rows while pausing new outbox writes', async () => {
    await db.runAsync(
      'insert into outbox (entity, entity_id, op, payload, created_at, attempts, next_attempt_at) values (?, ?, ?, ?, ?, ?, ?)',
      ['storage_locations', 'pending', 'update', '{}', 10, 0, 0],
    );
    await db.runAsync(
      'insert into outbox (entity, entity_id, op, payload, created_at, attempts, next_attempt_at) values (?, ?, ?, ?, ?, ?, ?)',
      ['storage_locations', 'failed', 'update', '{}', 11, 5, 0],
    );

    const guard = await acquireOutboxSignOutGuard(db);
    expect(guard).toMatchObject({ pendingCount: 1, failedCount: 1, queuedWriteCount: 0 });
    expect(beginOutboxWriteProducer()).toBeNull();

    const waitingWrite = enqueueMutations(db, [
      {
        entity: 'storage_locations',
        entityId: 'queued',
        op: 'delete',
        payload: { id: 'queued' },
        applyLocally: async () => undefined,
      },
    ]);
    await new Promise<void>((resolve) => setImmediate(resolve));
    try {
      const writeFinishedBeforeRelease = await Promise.race([
        waitingWrite.then(() => true),
        new Promise<boolean>((resolve) => setImmediate(() => resolve(false))),
      ]);
      expect(writeFinishedBeforeRelease).toBe(false);
      expect(guard.queuedWriteCount).toBe(1);
    } finally {
      guard.release();
      guard.release();
      await waitingWrite;
    }

    expect(await db.getAllAsync('select entity_id from outbox order by id')).toEqual([
      { entity_id: 'pending' },
      { entity_id: 'failed' },
      { entity_id: 'queued' },
    ]);
    const afterRelease = beginOutboxWriteProducer();
    expect(afterRelease).not.toBeNull();
    afterRelease?.();
  });

  it('releases the sign-out guard when its database check fails', async () => {
    const error = new Error('database check failed');
    jest.spyOn(db, 'withExclusiveTransactionAsync').mockRejectedValueOnce(error);

    await expect(acquireOutboxSignOutGuard(db)).rejects.toBe(error);

    const releaseProducer = beginOutboxWriteProducer();
    expect(releaseProducer).not.toBeNull();
    releaseProducer?.();
  });
});
