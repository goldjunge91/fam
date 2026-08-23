import { MIGRATIONS } from '@/lib/db/migrations';
import { runMigrations } from '@/lib/db/migrator';
import {
  deleteOutboxEntries,
  enqueueMutation,
  loadDueOutboxEntries,
  parseOutboxEntry,
  recordOutboxOutcome,
} from '@/lib/db/outbox';
import type { OutboxEntry } from '@/lib/db/types';
import { MAX_ATTEMPTS } from '@/lib/sync/backoff';
import { createTestDatabase, type TestDatabase } from '../../../test/node-sqlite-adapter';

async function insertStorageLocation(
  db: TestDatabase,
  id: string,
  overrides: Partial<{ name: string; householdId: string }> = {},
) {
  await db.runAsync(
    'insert into storage_locations (id, household_id, name, kind, updated_at) values (?, ?, ?, ?, ?)',
    [id, overrides.householdId ?? 'hh-1', overrides.name ?? 'Kühlschrank', 'fridge', 1000],
  );
}

describe('enqueueMutation', () => {
  let db: TestDatabase;

  beforeEach(async () => {
    db = createTestDatabase();
    await runMigrations(db, MIGRATIONS);
  });

  afterEach(() => {
    db.close();
  });

  it('schreibt Spiegeltabelle und Outbox-Eintrag in einem Aufruf', async () => {
    await enqueueMutation(db, {
      entity: 'storage_locations',
      entityId: 'loc-1',
      op: 'insert',
      payload: { id: 'loc-1', household_id: 'hh-1', name: 'Kühlschrank', kind: 'fridge' },
      applyLocally: (txn) => insertStorageLocation(txn as TestDatabase, 'loc-1'),
      now: 5000,
    });

    const mirrorRow = await db.getFirstAsync<{ id: string }>(
      'select id from storage_locations where id = ?',
      ['loc-1'],
    );
    expect(mirrorRow?.id).toBe('loc-1');

    const outboxRows = await db.getAllAsync<OutboxEntry>('select * from outbox');
    expect(outboxRows).toHaveLength(1);
    expect(outboxRows[0]).toMatchObject({
      entity: 'storage_locations',
      entity_id: 'loc-1',
      op: 'insert',
      created_at: 5000,
      attempts: 0,
      next_attempt_at: 0,
    });
    expect(parseOutboxEntry(outboxRows[0])).toEqual({
      id: 'loc-1',
      household_id: 'hh-1',
      name: 'Kühlschrank',
      kind: 'fridge',
    });
  });

  it('die UI-Aenderung ist ohne Netzwerk sofort da — kein await auf irgendeinen Request', async () => {
    let applyLocallyRanBeforeReturn = false;

    await enqueueMutation(db, {
      entity: 'storage_locations',
      entityId: 'loc-2',
      op: 'insert',
      payload: { id: 'loc-2', household_id: 'hh-1', name: 'Gefrierfach', kind: 'freezer' },
      applyLocally: async (txn) => {
        await insertStorageLocation(txn as TestDatabase, 'loc-2', { name: 'Gefrierfach' });
        applyLocallyRanBeforeReturn = true;
      },
    });

    expect(applyLocallyRanBeforeReturn).toBe(true);
  });

  it('ein Abbruch mitten in der Transaktion hinterlaesst weder Spiegel- noch Outbox-Zeile', async () => {
    await expect(
      enqueueMutation(db, {
        entity: 'storage_locations',
        entityId: 'loc-3',
        op: 'insert',
        payload: { id: 'loc-3' },
        applyLocally: async (txn) => {
          await insertStorageLocation(txn as TestDatabase, 'loc-3');
          throw new Error('Absichtlicher Abbruch');
        },
      }),
    ).rejects.toThrow('Absichtlicher Abbruch');

    const mirrorRow = await db.getFirstAsync('select id from storage_locations where id = ?', [
      'loc-3',
    ]);
    expect(mirrorRow).toBeNull();

    const outboxRows = await db.getAllAsync('select * from outbox where entity_id = ?', ['loc-3']);
    expect(outboxRows).toEqual([]);
  });
});

describe('loadDueOutboxEntries / deleteOutboxEntries / recordOutboxOutcome', () => {
  let db: TestDatabase;

  beforeEach(async () => {
    db = createTestDatabase();
    await runMigrations(db, MIGRATIONS);
  });

  afterEach(() => {
    db.close();
  });

  async function enqueue(entityId: string, now: number) {
    await enqueueMutation(db, {
      entity: 'storage_locations',
      entityId,
      op: 'insert',
      payload: { id: entityId },
      applyLocally: (txn) => insertStorageLocation(txn as TestDatabase, entityId),
      now,
    });
  }

  it('liefert faellige Eintraege in aufsteigender id-Reihenfolge', async () => {
    await enqueue('a', 1000);
    await enqueue('b', 1000);
    await enqueue('c', 1000);

    const due = await loadDueOutboxEntries(db, 5000);
    expect(due.map((e) => e.entity_id)).toEqual(['a', 'b', 'c']);
  });

  it('schliesst Eintraege aus, deren next_attempt_at in der Zukunft liegt', async () => {
    await enqueue('a', 1000);
    const [entry] = await loadDueOutboxEntries(db, 5000);

    await recordOutboxOutcome(db, [entry.id], {
      attempts: 1,
      lastError: 'timeout',
      nextAttemptAtMs: 999_999,
    });

    expect(await loadDueOutboxEntries(db, 5000)).toEqual([]);
    expect(await loadDueOutboxEntries(db, 1_000_000)).toHaveLength(1);
  });

  it('schliesst Eintraege aus, deren attempts MAX_ATTEMPTS erreicht haben', async () => {
    await enqueue('a', 1000);
    const [entry] = await loadDueOutboxEntries(db, 5000);

    await recordOutboxOutcome(db, [entry.id], {
      attempts: MAX_ATTEMPTS,
      lastError: 'permanent failure',
      nextAttemptAtMs: Number.MAX_SAFE_INTEGER,
    });

    expect(await loadDueOutboxEntries(db, Number.MAX_SAFE_INTEGER)).toEqual([]);

    const raw = await db.getFirstAsync<OutboxEntry>('select * from outbox where id = ?', [
      entry.id,
    ]);
    expect(raw?.attempts).toBe(MAX_ATTEMPTS);
    expect(raw?.last_error).toBe('permanent failure');
  });

  it('deleteOutboxEntries loescht nur die angegebenen ids', async () => {
    await enqueue('a', 1000);
    await enqueue('b', 1000);
    const [first, second] = await loadDueOutboxEntries(db, 5000);

    await deleteOutboxEntries(db, [first.id]);

    const remaining = await loadDueOutboxEntries(db, 5000);
    expect(remaining.map((e) => e.id)).toEqual([second.id]);
  });

  it('deleteOutboxEntries mit leerem Array ist ein No-Op', async () => {
    await enqueue('a', 1000);
    await deleteOutboxEntries(db, []);
    expect(await loadDueOutboxEntries(db, 5000)).toHaveLength(1);
  });

  it('recordOutboxOutcome mit leerem Array ist ein No-Op', async () => {
    await enqueue('a', 1000);
    await expect(
      recordOutboxOutcome(db, [], { attempts: 1, lastError: 'x', nextAttemptAtMs: 0 }),
    ).resolves.not.toThrow();
  });
});
