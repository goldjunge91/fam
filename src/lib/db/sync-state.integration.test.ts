import { MIGRATIONS } from '@/lib/db/migrations';
import { runMigrations } from '@/lib/db/migrator';
import { readSyncState, recordSyncError, writeSyncCursor } from '@/lib/db/sync-state';
import { createTestDatabase, type TestDatabase } from '../../../test/node-sqlite-adapter';

describe('sync-state', () => {
  let db: TestDatabase;

  beforeEach(async () => {
    db = createTestDatabase();
    await runMigrations(db, MIGRATIONS);
  });

  afterEach(() => {
    db.close();
  });

  it('cursor ist null, solange nie geschrieben wurde', async () => {
    const { cursor, lastError } = await readSyncState(db, 'fridge_items');
    expect(cursor).toBeNull();
    expect(lastError).toBeNull();
  });

  it('rundtrippt den rohen Cursor-String unveraendert, inklusive Mikrosekunden', async () => {
    const raw = '2024-01-15T10:30:00.123456+00:00';
    await writeSyncCursor(db, 'fridge_items', { lastSyncedAt: raw, lastSyncedId: 'abc-123' }, 5000);

    const { cursor } = await readSyncState(db, 'fridge_items');
    expect(cursor).toEqual({ lastSyncedAt: raw, lastSyncedId: 'abc-123' });
  });

  it('ein zweiter writeSyncCursor-Aufruf ueberschreibt den ersten (upsert)', async () => {
    await writeSyncCursor(db, 'fridge_items', { lastSyncedAt: 'a', lastSyncedId: '1' }, 1000);
    await writeSyncCursor(db, 'fridge_items', { lastSyncedAt: 'b', lastSyncedId: '2' }, 2000);

    const { cursor } = await readSyncState(db, 'fridge_items');
    expect(cursor).toEqual({ lastSyncedAt: 'b', lastSyncedId: '2' });
  });

  it('haelt Entities strikt getrennt', async () => {
    await writeSyncCursor(db, 'fridge_items', { lastSyncedAt: 'a', lastSyncedId: '1' }, 1000);

    const { cursor } = await readSyncState(db, 'shopping_list_items');
    expect(cursor).toBeNull();
  });

  it('recordSyncError schreibt den Fehler, ohne einen bestehenden Cursor zu beruehren', async () => {
    await writeSyncCursor(db, 'fridge_items', { lastSyncedAt: 'a', lastSyncedId: '1' }, 1000);
    await recordSyncError(db, 'fridge_items', 'Netzwerkfehler');

    const { cursor, lastError } = await readSyncState(db, 'fridge_items');
    expect(cursor).toEqual({ lastSyncedAt: 'a', lastSyncedId: '1' });
    expect(lastError).toBe('Netzwerkfehler');
  });

  it('recordSyncError funktioniert auch ohne vorherigen Cursor', async () => {
    await recordSyncError(db, 'fridge_items', 'erster Versuch schlug fehl');

    const { cursor, lastError } = await readSyncState(db, 'fridge_items');
    expect(cursor).toBeNull();
    expect(lastError).toBe('erster Versuch schlug fehl');
  });

  it('ein erfolgreicher writeSyncCursor loescht einen vorherigen Fehlerstand', async () => {
    await recordSyncError(db, 'fridge_items', 'timeout');
    await writeSyncCursor(db, 'fridge_items', { lastSyncedAt: 'a', lastSyncedId: '1' }, 1000);

    const { lastError } = await readSyncState(db, 'fridge_items');
    expect(lastError).toBeNull();
  });
});
