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
      // Dedupliziert gegen den zuletzt gespeicherten Fehler: ein anhaltendes
      // Problem (z.B. RLS-Fehlkonfiguration) wuerde sich sonst bei jedem
      // 20s-Poll erneut melden und das Sentry-Kontingent durchlaufen.
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

/**
 * Bereinigt verwaiste `households`-Spiegelzeilen.
 *
 * Anders als der household-gescopte Zweig unten: beide Abfragen sind
 * ungefiltert (household_id gibt es hier nicht — die Zeile IST der
 * Haushalt), und es gibt keine Outbox-`pendingIds`-Ausnahme, weil Haushalte
 * nie ueber die Outbox angelegt werden (siehe migrations.ts-Kommentar bei
 * V6_HOUSEHOLDS). Die RLS-Policy `households_select_member` sorgt dafuer,
 * dass ein entferntes Mitglied die Zeile serverseitig gar nicht mehr sieht —
 * genau wie ein hart geloeschter Haushalt verschwindet er einfach aus
 * `remoteIds` und wird hier lokal entsprechend geloescht.
 */
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

  // 1. Remote-IDs von Supabase fuer den Haushalt laden
  // biome-ignore lint/suspicious/noExplicitAny: generisches Select
  const { data, error } = await (supabase.from(meta.table) as any)
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
