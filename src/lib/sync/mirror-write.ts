import { metaOf } from '@/lib/db/entities';
import type { Entity, SqlDatabase, SqlParam } from '@/lib/db/types';
import { toEpochMs } from '@/lib/sync/cursor';

/**
 * Gemeinsamer Remote→Lokal-Zeilenschreiber (#47).
 *
 * Sowohl Pull ("eingehende Remote-Zeile anwenden") als auch Push ("Server-
 * Antwortzeile nach erfolgreichem Push anwenden") schreiben ueber diese eine
 * Funktion — das uuid/timestamptz→text/epoch-ms-Mapping existiert dadurch an
 * genau einer Stelle.
 */

export type UpsertMirrorRowOptions = {
  /** 0 nach einem Pull oder einem erfolgreichen Push-Response. 1 nur, wo _dirty explizit erhalten bleiben soll. */
  dirty: 0 | 1;
};

function toSqlParam(value: unknown): SqlParam {
  if (value === undefined || value === null) return null;
  if (typeof value === 'string' || typeof value === 'number') return value;
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
