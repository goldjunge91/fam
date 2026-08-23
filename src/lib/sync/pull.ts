import { ALL_ENTITIES, metaOf } from '@/lib/db/entities';
import {
  readSyncState,
  recordSyncError,
  type SyncCursor,
  writeSyncCursor,
} from '@/lib/db/sync-state';
import type { Entity, SqlDatabase } from '@/lib/db/types';
import { Sentry } from '@/lib/sentry';
import type { TypedSupabaseClient } from '@/lib/supabase';
import { EPOCH_START } from '@/lib/sync/cursor';
import { applyRemoteRow } from '@/lib/sync/mirror-write';

/** Unter `config.toml`s `max_rows = 1000`. */
const PAGE_SIZE = 500;

/** Gueltige Untergrenze fuer den zusammengesetzten `(updated_at, id)`-Cursor. */
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

  const { cursor: storedCursor, lastError: previousError } = await readSyncState(db, entity);

  // RLS kann alte Haushalte neu sichtbar machen; deshalb immer voll scannen.
  let cursor = entity === 'households' ? initialCursor() : (storedCursor ?? initialCursor());

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
      // Wiederholte Poll-Fehler nicht erneut an Sentry melden.
      if (error.message !== previousError) {
        Sentry.captureMessage(`Sync-Pull fehlgeschlagen (${entity}): ${error.message}`, {
          level: 'warning',
          tags: { sync: 'pull', entity },
        });
      }
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

      // Der Cursor darf erst mit der vollstaendigen Seite committen.
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

/** Entfernt Haushalte, die durch RLS oder harte Loeschung nicht mehr sichtbar sind. */
async function reconcileHouseholdOrphans(db: SqlDatabase, supabase: TypedSupabaseClient) {
  // biome-ignore lint/suspicious/noExplicitAny: generisches Select, siehe push.ts
  const { data, error } = await (supabase.from('households') as any).select('id');
  if (error || !data) return;

  const remoteIds = new Set<string>((data as { id: string }[]).map((r) => r.id));

  const localRows = await db.getAllAsync<{ id: string }>('select id from households');
  const orphanIds = localRows.map((r) => r.id).filter((id) => !remoteIds.has(id));

  if (orphanIds.length > 0) {
    const deleteIn = orphanIds.map(() => '?').join(',');
    await db.runAsync(`delete from households where id in (${deleteIn})`, orphanIds);
  }
}

async function reconcileOrphans(
  db: SqlDatabase,
  supabase: TypedSupabaseClient,
  entity: Entity,
  householdIds: readonly string[],
) {
  if (entity === 'households') {
    await reconcileHouseholdOrphans(db, supabase);
    return;
  }

  const meta = metaOf(entity);
  if (!meta.householdScoped) return;

  // biome-ignore lint/suspicious/noExplicitAny: generisches Select
  const { data, error } = await (supabase.from(meta.table) as any)
    .select('id')
    .in('household_id', householdIds);

  if (error || !data) return;

  const remoteIds = new Set<string>((data as { id: string }[]).map((r) => r.id));

  const pendingOutbox = await db.getAllAsync<{ entity_id: string }>(
    'select entity_id from outbox where entity = ?',
    [entity],
  );
  const pendingIds = new Set<string>(pendingOutbox.map((o) => o.entity_id));

  const inClause = householdIds.map(() => '?').join(',');
  const localRows = await db.getAllAsync<{ id: string }>(
    `select id from ${meta.table} where household_id in (${inClause})`,
    [...householdIds],
  );

  const orphanIds = localRows
    .map((r) => r.id)
    .filter((id) => !remoteIds.has(id) && !pendingIds.has(id));

  if (orphanIds.length > 0) {
    const deleteIn = orphanIds.map(() => '?').join(',');
    await db.runAsync(`delete from ${meta.table} where id in (${deleteIn})`, orphanIds);
  }
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
    await reconcileOrphans(deps.db, deps.supabase, entity, deps.householdIds);
  }

  return outcomes;
}
