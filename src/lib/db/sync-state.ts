import type { Entity, SqlDatabase } from '@/lib/db/types';

/** Bewahrt den Pull-Cursor als unveraenderten Server-String. */

const DEFAULT_SCOPE = 'default';

export type SyncCursor = {
  lastSyncedAt: string;
  lastSyncedId: string;
};

type SyncStateRow = {
  last_synced_at: string | null;
  last_synced_id: string | null;
  last_error: string | null;
};

export async function readSyncState(
  db: SqlDatabase,
  entity: Entity,
  scope: string = DEFAULT_SCOPE,
): Promise<{ cursor: SyncCursor | null; lastError: string | null }> {
  const row = await db.getFirstAsync<SyncStateRow>(
    'select last_synced_at, last_synced_id, last_error from sync_state where entity = ? and scope = ?',
    [entity, scope],
  );

  if (row === null || row.last_synced_at === null || row.last_synced_id === null) {
    return { cursor: null, lastError: row?.last_error ?? null };
  }

  return {
    cursor: { lastSyncedAt: row.last_synced_at, lastSyncedId: row.last_synced_id },
    lastError: row.last_error,
  };
}

/** Loescht beim erfolgreichen Cursor-Fortschritt den vorherigen Fehler. */
export async function writeSyncCursor(
  txn: SqlDatabase,
  entity: Entity,
  cursor: SyncCursor,
  lastRunAtMs: number,
  scope: string = DEFAULT_SCOPE,
): Promise<void> {
  await txn.runAsync(
    `insert into sync_state (entity, scope, last_synced_at, last_synced_id, last_run_at, last_error)
     values (?, ?, ?, ?, ?, null)
     on conflict(entity, scope) do update set
       last_synced_at = excluded.last_synced_at,
       last_synced_id = excluded.last_synced_id,
       last_run_at = excluded.last_run_at,
       last_error = excluded.last_error`,
    [entity, scope, cursor.lastSyncedAt, cursor.lastSyncedId, lastRunAtMs],
  );
}

export async function recordSyncError(
  db: SqlDatabase,
  entity: Entity,
  error: string,
  scope: string = DEFAULT_SCOPE,
): Promise<void> {
  await db.runAsync(
    `insert into sync_state (entity, scope, last_error)
     values (?, ?, ?)
     on conflict(entity, scope) do update set last_error = excluded.last_error`,
    [entity, scope, error],
  );
}
