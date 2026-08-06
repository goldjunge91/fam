import { ALL_ENTITIES, metaOf } from '@/lib/db/entities';
import {
  readSyncState,
  recordSyncError,
  type SyncCursor,
  writeSyncCursor,
} from '@/lib/db/sync-state';
import type { Entity, SqlDatabase } from '@/lib/db/types';
import type { TypedSupabaseClient } from '@/lib/supabase';
import { EPOCH_START, toEpochMs } from '@/lib/sync/cursor';
import { upsertMirrorRow } from '@/lib/sync/mirror-write';
import { resolve, type SyncSide } from '@/lib/sync/resolve';

/**
 * Pull-Haelfte der Sync-Engine (#47).
 *
 * Keyset-Pagination ueber `(updated_at, id)` — `updated_at` allein ist kein
 * sicherer Cursor: `create_household()` fuegt drei `storage_locations` in
 * einer Transaktion ein, Postgres' `now()` ist fuer die ganze Transaktion
 * stabil, alle drei teilen sich denselben Wert. Der `.or()`-Filter dafuer
 * wurde vorab gegen die echte lokale Instanz validiert (genau dieses
 * Tie-Szenario, drei gleichzeitig angelegte Lagerorte).
 */

/** Unter `config.toml`s `max_rows = 1000`. */
const PAGE_SIZE = 500;

/**
 * Untere Grenze fuer `id.gt.` beim allerersten Pull einer Entity. Eine leere
 * Zeichenkette waere hier keine gueltige `.or()`-Filter-Komponente; die
 * kleinstmoegliche UUID ist es und schliesst dieselben Zeilen ein.
 */
const MIN_UUID = '00000000-0000-0000-0000-000000000000';

export type PullOutcome = {
  entity: Entity;
  pagesFetched: number;
  rowsWritten: number;
  rowsSkippedAsLocalWins: number;
};

function initialCursor(): SyncCursor {
  return { lastSyncedAt: EPOCH_START, lastSyncedId: MIN_UUID };
}

function buildOrFilter(cursor: SyncCursor): string {
  return `updated_at.gt.${cursor.lastSyncedAt},and(updated_at.eq.${cursor.lastSyncedAt},id.gt.${cursor.lastSyncedId})`;
}

type RemoteRow = Record<string, unknown> & {
  id: string;
  updated_at: string;
  deleted_at?: string | null;
};

type LocalRowMeta = { updated_at: number; deleted_at: number | null; _dirty: number };

/**
 * Wendet eine einzelne Remote-Zeile lokal an.
 *
 * `resolve()` laeuft nur, wenn die lokale Zeile `_dirty = 1` traegt — sonst
 * gibt es keinen Konflikt, die Remote-Zeile gewinnt immer kampflos. Gewinnt
 * `resolve()` fuer `'local'`, bleibt die lokale Zeile unangetastet; ihre
 * Absicht liegt weiterhin in der Outbox und wird dort erneut gepusht.
 */
async function applyRemoteRow(
  txn: SqlDatabase,
  entity: Entity,
  remoteRow: RemoteRow,
  clockCeilingMs: number,
): Promise<'written' | 'local-wins'> {
  const meta = metaOf(entity);

  const local = await txn.getFirstAsync<LocalRowMeta>(
    `select updated_at, deleted_at, _dirty from ${meta.table} where id = ?`,
    [remoteRow.id],
  );

  if (local === null || local._dirty === 0) {
    await upsertMirrorRow(txn, entity, remoteRow, { dirty: 0 });
    return 'written';
  }

  const localSide: SyncSide = {
    id: remoteRow.id,
    updatedAt: local.updated_at,
    deletedAt: local.deleted_at,
  };
  const remoteSide: SyncSide = {
    id: remoteRow.id,
    updatedAt: toEpochMs(remoteRow.updated_at),
    deletedAt:
      meta.hasServerTombstone && remoteRow.deleted_at ? toEpochMs(remoteRow.deleted_at) : null,
  };

  const winner = resolve(localSide, remoteSide, { clockCeiling: clockCeilingMs });

  if (winner === 'local') return 'local-wins';

  await upsertMirrorRow(txn, entity, remoteRow, { dirty: 0 });
  return 'written';
}

async function pullEntity(
  db: SqlDatabase,
  supabase: TypedSupabaseClient,
  entity: Entity,
  householdIds: readonly string[],
  clockCeilingMs: number,
): Promise<PullOutcome> {
  const meta = metaOf(entity);
  const outcome: PullOutcome = {
    entity,
    pagesFetched: 0,
    rowsWritten: 0,
    rowsSkippedAsLocalWins: 0,
  };

  const { cursor: storedCursor } = await readSyncState(db, entity);
  let cursor = storedCursor ?? initialCursor();

  for (;;) {
    // biome-ignore lint/suspicious/noExplicitAny: generische Tabelle, siehe push.ts
    let query = (supabase.from(meta.table) as any).select('*');
    if (meta.householdScoped) {
      query = query.in('household_id', householdIds);
    }
    query = query
      .or(buildOrFilter(cursor))
      .order('updated_at', { ascending: true })
      .order('id', { ascending: true })
      .limit(PAGE_SIZE);

    const { data, error } = (await query) as {
      data: RemoteRow[] | null;
      error: { message: string } | null;
    };

    if (error) {
      await recordSyncError(db, entity, error.message);
      break;
    }

    const page = data ?? [];
    outcome.pagesFetched += 1;

    if (page.length === 0) break;

    const last = page[page.length - 1];

    await db.withExclusiveTransactionAsync(async (txn) => {
      for (const row of page) {
        const result = await applyRemoteRow(txn, entity, row, clockCeilingMs);
        if (result === 'written') outcome.rowsWritten += 1;
        else outcome.rowsSkippedAsLocalWins += 1;
      }

      // Cursor rueckt erst nach Commit der vollstaendigen Seite vor — nie
      // mitten in einer Seite. Ein Crash zwischen Fetch und Commit holt beim
      // naechsten Lauf einfach dieselbe Seite erneut (on conflict macht das
      // wirkungslos, kein Duplikat).
      await writeSyncCursor(
        txn,
        entity,
        { lastSyncedAt: last.updated_at, lastSyncedId: last.id },
        Date.now(),
      );
    });

    cursor = { lastSyncedAt: last.updated_at, lastSyncedId: last.id };

    if (page.length < PAGE_SIZE) break;
  }

  return outcome;
}

export async function pullHousehold(deps: {
  db: SqlDatabase;
  supabase: TypedSupabaseClient;
  householdIds: readonly string[];
  clockCeilingMs: number;
  entities?: readonly Entity[];
}): Promise<PullOutcome[]> {
  const entities = deps.entities ?? ALL_ENTITIES;
  const outcomes: PullOutcome[] = [];

  for (const entity of entities) {
    outcomes.push(
      await pullEntity(deps.db, deps.supabase, entity, deps.householdIds, deps.clockCeilingMs),
    );
  }

  return outcomes;
}
