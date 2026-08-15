import { metaOf } from '@/lib/db/entities';
import type { Entity, SqlDatabase, SqlParam } from '@/lib/db/types';
import { toEpochMs } from '@/lib/sync/cursor';
import { resolve, type SyncSide } from '@/lib/sync/resolve';

/**
 * Gemeinsamer Remote→Lokal-Zeilenschreiber (#47, #48).
 *
 * Sowohl Pull ("eingehende Remote-Zeile anwenden") als auch Push ("Server-
 * Antwortzeile nach erfolgreichem Push anwenden") als auch die Realtime-Bridge
 * ("eingehendes postgres_changes-Event anwenden") schreiben ueber diese eine
 * Funktion — das uuid/timestamptz→text/epoch-ms-Mapping und die
 * Konfliktentscheidung existieren dadurch an genau einer Stelle.
 */

export type UpsertMirrorRowOptions = {
  /** 0 nach einem Pull oder einem erfolgreichen Push-Response. 1 nur, wo _dirty explizit erhalten bleiben soll. */
  dirty: 0 | 1;
};

function toSqlParam(value: unknown): SqlParam {
  if (value === undefined || value === null) return null;
  if (typeof value === 'string' || typeof value === 'number') return value;
  // Postgres boolean-Spalten (households.premium_active) kommen von
  // postgrest-js als JS-boolean — SQLite kennt keinen eigenen Bool-Typ,
  // deshalb als 0/1 gespiegelt, wie auch `_dirty` in diesem Schema.
  if (typeof value === 'boolean') return value ? 1 : 0;
  // Postgres text[]-Spalten (recipes.dish_types/dietary_tags/hashtags)
  // kommen von postgrest-js als JS-Array — SQLite kennt keinen Array-Typ,
  // deshalb als JSON-Text gespiegelt. Aufrufer, die die Spalte lesen, parsen
  // selbst zurueck (siehe use-recipes.ts).
  if (Array.isArray(value)) return JSON.stringify(value);
  // numeric-Spalten kommen von postgrest-js als JS-Number, alles andere in
  // diesem Schema ist text/uuid/date — als String. Ein anderer Typ waere
  // Schema-Drift zwischen supabase/schemas/*.sql und entities.ts.
  throw new Error(`Unerwarteter Werttyp fuer Spiegel-Zeile: ${typeof value}`);
}

/**
 * Schreibt eine Remote-Zeile in die passende Spiegeltabelle (upsert per id).
 *
 * `remoteRow` muss jede Spalte aus `metaOf(entity).columns` sowie
 * `updated_at` (und, wenn `hasServerTombstone`, `deleted_at`) enthalten — die
 * Form, in der `postgrest-js` ein `select('*')`-Ergebnis liefert.
 */
export async function upsertMirrorRow(
  txn: SqlDatabase,
  entity: Entity,
  remoteRow: Record<string, unknown>,
  options: UpsertMirrorRowOptions,
): Promise<void> {
  const meta = metaOf(entity);

  const updatedAtRaw = remoteRow.updated_at;
  if (typeof updatedAtRaw !== 'string') {
    throw new Error(`Remote-Zeile fuer ${entity} hat kein updated_at als String.`);
  }
  const updatedAt = toEpochMs(updatedAtRaw);

  const deletedAtRaw = remoteRow.deleted_at;
  const deletedAt =
    meta.hasServerTombstone && typeof deletedAtRaw === 'string' ? toEpochMs(deletedAtRaw) : null;

  const columns = [...meta.columns, 'updated_at', 'deleted_at', '_dirty'];
  const values: SqlParam[] = [
    ...meta.columns.map((column) => toSqlParam(remoteRow[column])),
    updatedAt,
    deletedAt,
    options.dirty,
  ];

  const placeholders = columns.map(() => '?').join(', ');
  const updateAssignments = columns.map((column) => `${column} = excluded.${column}`).join(', ');

  await txn.runAsync(
    `insert into ${meta.table} (${columns.join(', ')})
     values (${placeholders})
     on conflict(id) do update set ${updateAssignments}`,
    values,
  );
}

type RemoteRow = Record<string, unknown> & {
  id: string;
  updated_at: string;
  deleted_at?: string | null;
};

type LocalRowMeta = { updated_at: number; deleted_at: number | null; _dirty: number };

/**
 * Wendet eine einzelne Remote-Zeile lokal an — von `pull.ts` (Seiten-Zeilen)
 * und von `realtime.ts` (`postgres_changes`-Events) genutzt.
 *
 * `resolve()` laeuft nur, wenn die lokale Zeile `_dirty = 1` traegt — sonst
 * gibt es keinen Konflikt, die Remote-Zeile gewinnt immer kampflos. Gewinnt
 * `resolve()` fuer `'local'`, bleibt die lokale Zeile unangetastet; ihre
 * Absicht liegt weiterhin in der Outbox und wird dort erneut gepusht.
 */
export async function applyRemoteRow(
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

/**
 * Loescht eine Spiegelzeile hart — fuer ein echtes `DELETE`-Event, das nicht
 * ueber den ueblichen Soft-Delete-Pfad kommt (App-seitige Loeschungen laufen
 * immer als `update ... set deleted_at = ...` ueber `push.ts`). Ohne diesen
 * Pfad bliebe eine Zeile verwaist, wenn je ausserhalb der App hart geloescht
 * wird (z. B. Haushalts-Kaskadenloeschung).
 */
export async function deleteMirrorRow(txn: SqlDatabase, entity: Entity, id: string): Promise<void> {
  const meta = metaOf(entity);
  await txn.runAsync(`delete from ${meta.table} where id = ?`, [id]);
}
