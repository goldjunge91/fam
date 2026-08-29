import { MIGRATIONS } from '@/lib/db/migrations';
import { runMigrations } from '@/lib/db/migrator';
import { enqueueMutation, loadDueOutboxEntries, recordOutboxOutcome } from '@/lib/db/outbox';
import { retryFailedOutboxEntries } from '@/lib/db/outbox-retry';
import type { SqlDatabase } from '@/lib/db/types';
import { MAX_ATTEMPTS } from '@/lib/sync/backoff';
import { createTestDatabase, type TestDatabase } from '../../../test/node-sqlite-adapter';

/**
 * `retryFailedOutboxEntries` (#51) gegen eine echte SQLite-Engine — kein Mock.
 */

async function insertStorageLocation(db: SqlDatabase, id: string) {
  await db.runAsync(
    'insert into storage_locations (id, household_id, name, kind, updated_at) values (?, ?, ?, ?, ?)',
    [id, 'hh-1', 'Kühlschrank', 'fridge', 1000],
  );
}

describe('retryFailedOutboxEntries', () => {
  let db: TestDatabase;

  beforeEach(async () => {
    db = createTestDatabase();
    await runMigrations(db, MIGRATIONS);
  });

  afterEach(() => {
    db.close();
  });

  it('macht einen terminal gescheiterten Eintrag wieder faellig', async () => {
    await enqueueMutation(db, {
      entity: 'storage_locations',
      entityId: 'loc-1',
      op: 'insert',
      payload: { id: 'loc-1', household_id: 'hh-1', name: 'Kühlschrank', kind: 'fridge' },
      applyLocally: (txn) => insertStorageLocation(txn, 'loc-1'),
    });

    const [entry] = await loadDueOutboxEntries(db, 0);
    await recordOutboxOutcome(db, [entry.id], {
      attempts: MAX_ATTEMPTS,
      lastError: 'RLS-Verstoss',
      nextAttemptAtMs: Number.MAX_SAFE_INTEGER,
    });

    // Terminal: taucht in der faelligen Liste nicht mehr auf, egal wie weit
    // `nowMs` in der Zukunft liegt.
    expect(await loadDueOutboxEntries(db, Date.now() + 1_000_000)).toHaveLength(0);

    const changed = await retryFailedOutboxEntries(db, 500);

    expect(changed).toBe(1);
    const due = await loadDueOutboxEntries(db, 500);
    expect(due).toHaveLength(1);
    expect(due[0].id).toBe(entry.id);
    expect(due[0].attempts).toBe(0);
    // last_error bleibt erhalten, bis ein neuer Versuch ihn ersetzt oder loescht.
    expect(due[0].last_error).toBe('RLS-Verstoss');
  });

  it('laesst noch nicht terminal gescheiterte Eintraege unangetastet', async () => {
    await enqueueMutation(db, {
      entity: 'storage_locations',
      entityId: 'loc-2',
      op: 'insert',
      payload: { id: 'loc-2', household_id: 'hh-1', name: 'Vorrat', kind: 'pantry' },
      applyLocally: (txn) => insertStorageLocation(txn, 'loc-2'),
    });

    const [entry] = await loadDueOutboxEntries(db, 0);
    await recordOutboxOutcome(db, [entry.id], {
      attempts: 2,
      lastError: 'timeout',
      nextAttemptAtMs: 999_999,
    });

    const changed = await retryFailedOutboxEntries(db, 500);

    expect(changed).toBe(0);
    const row = await db.getFirstAsync<{ attempts: number; next_attempt_at: number }>(
      'select attempts, next_attempt_at from outbox where id = ?',
      [entry.id],
    );
    expect(row?.attempts).toBe(2);
    expect(row?.next_attempt_at).toBe(999_999);
  });

  it('entfernt veraltete JOIN-Felder aus gescheiterten Inventar-Updates', async () => {
    await enqueueMutation(db, {
      entity: 'fridge_items',
      entityId: 'item-1',
      op: 'update',
      payload: {
        id: 'item-1',
        household_id: 'hh-1',
        expiry_date: '2026-08-29',
        location_kind: 'fridge',
        location_name: 'Kühlschrank',
      },
      applyLocally: async () => {},
    });

    const [entry] = await loadDueOutboxEntries(db, 0);
    await recordOutboxOutcome(db, [entry.id], {
      attempts: MAX_ATTEMPTS,
      lastError: "Could not find the 'location_kind' column",
      nextAttemptAtMs: Number.MAX_SAFE_INTEGER,
    });

    const changed = await retryFailedOutboxEntries(db, 500);

    expect(changed).toBe(1);
    const [due] = await loadDueOutboxEntries(db, 500);
    expect(JSON.parse(due.payload)).toEqual({
      id: 'item-1',
      household_id: 'hh-1',
      expiry_date: '2026-08-29',
    });
  });

  it('gibt 0 zurueck, wenn keine Eintraege terminal gescheitert sind', async () => {
    expect(await retryFailedOutboxEntries(db)).toBe(0);
  });
});
