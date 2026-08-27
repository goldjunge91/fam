import * as Network from 'expo-network';

import { ALL_ENTITIES, metaOf } from '@/lib/db/entities';
import {
  readSyncState,
  recordSyncError,
  type SyncCursor,
  writeSyncCursor,
} from '@/lib/db/sync-state';
import type { Entity, SqlDatabase } from '@/lib/db/types';
import type { TypedSupabaseClient } from '@/lib/supabase';
import { EPOCH_START } from '@/lib/sync/cursor';
import { applyRemoteRow } from '@/lib/sync/mirror-write';
import { addDiagnosticStep, reportWarning } from '@/lib/telemetry';

/** Unter `config.toml`s `max_rows = 1000`. */
const PAGE_SIZE = 500;

const MIN_UUID = '00000000-0000-0000-0000-000000000000';

type PullResponse = {
  data: unknown;
  error: { code?: string; message: string } | null;
};

type GenericQuery<T> = {
  then<TResult1 = T, TResult2 = never>(
    onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2>;
  select(columns?: string): GenericQuery<T>;
  in(column: string, values: readonly string[]): GenericQuery<T>;
  or(filter: string): GenericQuery<T>;
  order(column: string, options: { ascending: boolean }): GenericQuery<T>;
  limit(count: number): GenericQuery<T>;
};

export type PullOutcome = {
  entity: Entity;
  pagesFetched: number;
  rowsWritten: number;
  rowsSkippedAsLocalWins: number;
  error?: string;
  errorCode?: string;
  errorWasPreviouslyRecorded?: boolean;
};

function isJwtIssuedInFuture(error: { code?: string; message: string }): boolean {
  return /jwt[^\n]*issued[^\n]*future/i.test(`${error.code ?? ''} ${error.message}`);
}

async function getNetworkState(): Promise<'online' | 'offline' | 'unknown'> {
  try {
    const state = await Network.getNetworkStateAsync();
    if (state.isConnected === false || state.isInternetReachable === false) return 'offline';
    if (state.isConnected === true || state.isInternetReachable === true) return 'online';
  } catch {
    // Netzwerkdiagnose ist best effort und darf den Sync nicht beeinflussen.
  }
  return 'unknown';
}

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
  diagnostics: {
    retryCount: number;
    suppressJwtWarning: boolean;
    serverNowMs?: () => number | null;
  },
): Promise<PullOutcome> {
  const meta = metaOf(entity);
  const outcome: PullOutcome = {
    entity,
    pagesFetched: 0,
    rowsWritten: 0,
    rowsSkippedAsLocalWins: 0,
  };

  // Push-only-Entities haben keinen Pull-Cursor und keine Remote-Spiegelzeile.
  if (meta.pushOnly) return outcome;

  const { cursor: storedCursor, lastError: previousError } = await readSyncState(db, entity);

  // Haushalte immer vollständig laden: Beitritte ändern die RLS-Sichtbarkeit ohne Zeilen-Update.
  let cursor = entity === 'households' ? initialCursor() : (storedCursor ?? initialCursor());

  for (;;) {
    let query = (
      supabase.from(meta.table as never) as unknown as GenericQuery<PullResponse>
    ).select('*');
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
      error: { code?: string; message: string } | null;
    };

    if (error) {
      await recordSyncError(db, entity, error.message);
      outcome.error = error.message;
      outcome.errorCode = error.code;
      outcome.errorWasPreviouslyRecorded = error.message === previousError;
      const jwtIssuedInFuture = isJwtIssuedInFuture(error);
      // Wiederholte identische Fehler nicht erneut an Sentry senden.
      if (
        (error.message !== previousError || diagnostics.retryCount > 0) &&
        !(jwtIssuedInFuture && diagnostics.suppressJwtWarning)
      ) {
        const serverNowMs = diagnostics.serverNowMs?.();
        reportWarning(`Sync-Pull fehlgeschlagen: ${error.message}`, {
          operation: 'sync.pull',
          entity,
          error_code: jwtIssuedInFuture
            ? 'jwt_issued_in_future'
            : (error.code ?? 'sync_pull_failed'),
          retry_count: diagnostics.retryCount,
          network_state: await getNetworkState(),
          ...(serverNowMs === null || serverNowMs === undefined
            ? {}
            : { clock_skew_ms: Date.now() - serverNowMs }),
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

      // Cursor erst nach dem vollständigen Seiten-Commit vorrücken; Wiederholung bleibt idempotent.
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

  if (!outcome.error) {
    // Auch ein leerer erfolgreicher Pull muss einen vorherigen Fehlerzustand löschen.
    await writeSyncCursor(db, entity, cursor, Date.now());
  }

  return outcome;
}

async function reconcileHouseholdOrphans(db: SqlDatabase, supabase: TypedSupabaseClient) {
  const { data, error } = await supabase.from('households').select('id');
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
  if (meta.pushOnly || !meta.householdScoped) return;

  // 1. Remote-IDs von Supabase fuer den Haushalt laden
  const { data, error } = await (
    supabase.from(meta.table as never) as unknown as GenericQuery<PullResponse>
  )
    .select('id')
    .in('household_id', householdIds);

  if (error || !data) return;

  const remoteIds = new Set<string>((data as { id: string }[]).map((r) => r.id));

  // 2. Lokale Outbox-IDs fuer diese Entity laden (lokal ungepushte Zeilen nicht loeschen)
  const pendingOutbox = await db.getAllAsync<{ entity_id: string }>(
    'select entity_id from outbox where entity = ?',
    [entity],
  );
  const pendingIds = new Set<string>(pendingOutbox.map((o) => o.entity_id));

  // 3. Lokale SQLite-IDs fuer die Haushalte laden
  const inClause = householdIds.map(() => '?').join(',');
  const localRows = await db.getAllAsync<{ id: string }>(
    `select id from ${meta.table} where household_id in (${inClause})`,
    [...householdIds],
  );

  // 4. Verwaiste Zeilen finden (lokal vorhanden, aber in Supabase geloescht & nicht in Outbox)
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
  serverNowMs?: () => number | null;
  entities?: readonly Entity[];
}): Promise<PullOutcome[]> {
  const entities = (deps.entities ?? ALL_ENTITIES).filter((entity) => !metaOf(entity).pushOnly);

  const run = async (
    runEntities: readonly Entity[],
    retryCount: number,
    suppressJwtWarning: boolean,
  ): Promise<PullOutcome[]> => {
    const outcomes: PullOutcome[] = [];
    for (const entity of runEntities) {
      const serverNowMs = deps.serverNowMs?.();
      const outcome = await pullEntity(
        deps.db,
        deps.supabase,
        entity,
        deps.householdIds,
        serverNowMs ?? deps.clockCeilingMs,
        { retryCount, suppressJwtWarning, serverNowMs: deps.serverNowMs },
      );
      outcomes.push(outcome);
      if (outcome.error) break;
      await reconcileOrphans(deps.db, deps.supabase, entity, deps.householdIds);
    }
    return outcomes;
  };

  const initialOutcomes = await run(entities, 0, true);
  const failedIndex = initialOutcomes.findIndex(
    (outcome) =>
      outcome.error !== undefined &&
      isJwtIssuedInFuture({ code: outcome.errorCode, message: outcome.error }),
  );
  if (failedIndex === -1) return initialOutcomes;

  const failed = initialOutcomes[failedIndex];
  const serverNowMs = deps.serverNowMs?.();
  const context = {
    operation: 'auth.session.refresh',
    entity: failed.entity,
    error_code: 'jwt_issued_in_future',
    retry_count: 0,
    network_state: await getNetworkState(),
    ...(serverNowMs === null || serverNowMs === undefined
      ? {}
      : { clock_skew_ms: Date.now() - serverNowMs }),
  };

  addDiagnosticStep('auth.session.refresh_started', { ...context, outcome: 'started' });
  const { error: refreshError } = await deps.supabase.auth.refreshSession();
  if (refreshError) {
    if (!failed.errorWasPreviouslyRecorded) {
      reportWarning(`Session-Aktualisierung fehlgeschlagen: ${refreshError.message}`, {
        ...context,
        error_code: refreshError.code ?? 'auth_session_refresh_failed',
      });
      reportWarning(`Sync-Pull fehlgeschlagen: ${failed.error}`, context);
    }
    return initialOutcomes;
  }

  addDiagnosticStep('auth.session.refresh_completed', {
    ...context,
    outcome: 'completed',
    retry_count: 1,
  });
  const retryOutcomes = await run(entities.slice(failedIndex), 1, false);
  return [...initialOutcomes.slice(0, failedIndex), ...retryOutcomes];
}
