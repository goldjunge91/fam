import { metaOf } from '@/lib/db/entities';
import type { Entity, SqlDatabase, SqlParam } from '@/lib/db/types';
import { toEpochMs } from '@/lib/sync/cursor';
import { resolve, type SyncSide } from '@/lib/sync/resolve';

/** Gemeinsamer Remote→Lokal-Schreibpfad für Pull, Push-Antworten und Realtime. */

export type UpsertMirrorRowOptions = {
  /** 0 für Serverdaten; 1 erhält eine lokale Änderung. */
  dirty: 0 | 1;
};

function mirrorMetaOf(entity: Entity) {
  const meta = metaOf(entity);
  if (meta.pushOnly) {
    throw new Error(`${entity} ist push-only und darf nicht gespiegelt werden.`);
  }
  return meta;
}

function remoteUpdatedAt(
  meta: ReturnType<typeof mirrorMetaOf>,
  remoteRow: Record<string, unknown>,
) {
  const value = meta.appendOnly ? remoteRow.created_at : remoteRow.updated_at;
  if (typeof value !== 'string') {
    throw new Error(
      `Remote-Zeile fuer ${meta.entity} hat keinen gültigen ${meta.appendOnly ? 'created_at' : 'updated_at'}-Zeitstempel.`,
    );
  }
  return value;
}

function toSqlParam(value: unknown): SqlParam {
  if (value === undefined || value === null) return null;
  if (typeof value === 'string' || typeof value === 'number') return value;
  // SQLite speichert Boolean als 0/1.
  if (typeof value === 'boolean') return value ? 1 : 0;
  // Postgres-Arrays werden lokal als JSON gespeichert.
  if (Array.isArray(value)) return JSON.stringify(value);
  // Andere Typen deuten auf Schema-Drift hin.
  throw new Error(`Unerwarteter Werttyp fuer Spiegel-Zeile: ${typeof value}`);
}

/**
 * Upsert einer vollständigen PostgREST-Zeile anhand ihrer ID.
 * Erwartet alle Entity-Spalten sowie den Cursor-Zeitstempel. Bei append-only
 * Tabellen ist das `created_at`; `updated_at`/`deleted_at` bleiben lokal als
 * technische Sync-Spalten vorhanden.
 */
export async function upsertMirrorRow(
  txn: SqlDatabase,
  entity: Entity,
  remoteRow: Record<string, unknown>,
  options: UpsertMirrorRowOptions,
): Promise<void> {
  const meta = mirrorMetaOf(entity);

  const updatedAt = toEpochMs(remoteUpdatedAt(meta, remoteRow));

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
  updated_at?: string;
  created_at?: string;
  deleted_at?: string | null;
};

type LocalRowMeta = { updated_at: number; deleted_at: number | null; _dirty: number };

type PendingOutboxRow = { op: string; payload: string };

/**
 * Spalten, die eine offene Outbox-Operation lokal bereits verändert hat und
 * die deshalb bei einer eingehenden Remote-Zeile ihren lokalen Wert behalten
 * müssen. `'all'` bedeutet: die ganze Zeile ist noch unbestätigt lokal
 * (Insert), die Remote-Zeile wird komplett ignoriert.
 */
function touchedColumns(op: string, payload: Record<string, unknown>): Set<string> | 'all' {
  switch (op) {
    case 'insert':
      return 'all';
    case 'delete':
    case 'restore':
      return new Set(['deleted_at']);
    case 'move':
      return new Set(['location_id']);
    case 'adjust_quantity':
    case 'correct_quantity':
    case 'reverse_quantity':
      return new Set(['quantity', 'deleted_at']);
    default:
      // 'update' und unbekannte künftige Ops: nur die tatsächlich gepatchten Felder.
      return new Set(Object.keys(payload).filter((key) => key !== 'id'));
  }
}

/**
 * Wendet eine Remote-Zeile auf eine lokal dirty Zeile an, für die noch
 * Outbox-Operationen offen sind. Remote gilt als bestätigte Basis; von
 * offenen Operationen berührte Spalten behalten ihren lokalen Wert, alle
 * anderen übernehmen die echte Remote-Änderung. `_dirty` bleibt 1, bis die
 * offenen Operationen bestätigt sind.
 */
async function reconcileDirtyRowWithPendingOps(
  txn: SqlDatabase,
  entity: Entity,
  meta: ReturnType<typeof mirrorMetaOf>,
  remoteRow: RemoteRow,
  pendingOps: readonly PendingOutboxRow[],
): Promise<'written' | 'local-wins'> {
  const touched = new Set<string>();
  for (const { op, payload } of pendingOps) {
    const columns = touchedColumns(op, JSON.parse(payload) as Record<string, unknown>);
    if (columns === 'all') return 'local-wins';
    for (const column of columns) touched.add(column);
  }

  const currentRow = await txn.getFirstAsync<Record<string, unknown>>(
    `select * from ${meta.table} where id = ?`,
    [remoteRow.id],
  );
  if (currentRow === null) {
    await upsertMirrorRow(txn, entity, remoteRow, { dirty: 0 });
    return 'written';
  }

  const deletedAtRaw = remoteRow.deleted_at;
  const remoteDeletedAt =
    meta.hasServerTombstone && typeof deletedAtRaw === 'string' ? toEpochMs(deletedAtRaw) : null;

  const columns = [...meta.columns, 'updated_at', 'deleted_at', '_dirty'];
  const values: SqlParam[] = columns.map((column) => {
    if (column === '_dirty') return 1;
    if (column === 'updated_at') return currentRow.updated_at as SqlParam;
    if (column === 'deleted_at') {
      return touched.has('deleted_at') ? (currentRow.deleted_at as SqlParam) : remoteDeletedAt;
    }
    if (touched.has(column)) return currentRow[column] as SqlParam;
    return toSqlParam(remoteRow[column]);
  });

  const placeholders = columns.map(() => '?').join(', ');
  const updateAssignments = columns.map((column) => `${column} = excluded.${column}`).join(', ');

  await txn.runAsync(
    `insert into ${meta.table} (${columns.join(', ')})
     values (${placeholders})
     on conflict(id) do update set ${updateAssignments}`,
    values,
  );
  return 'written';
}

/** Wendet Remote-Daten an; lokale Dirty-Zeilen durchlaufen die Konfliktauflösung. */
export async function applyRemoteRow(
  txn: SqlDatabase,
  entity: Entity,
  remoteRow: RemoteRow,
  clockCeilingMs: number,
): Promise<'written' | 'local-wins'> {
  const meta = mirrorMetaOf(entity);

  const local = await txn.getFirstAsync<LocalRowMeta>(
    `select updated_at, deleted_at, _dirty from ${meta.table} where id = ?`,
    [remoteRow.id],
  );

  if (local === null || local._dirty === 0) {
    await upsertMirrorRow(txn, entity, remoteRow, { dirty: 0 });
    return 'written';
  }

  const pendingOps = await txn.getAllAsync<PendingOutboxRow>(
    'select op, payload from outbox where entity = ? and entity_id = ? order by id asc',
    [entity, remoteRow.id],
  );

  if (pendingOps.length > 0) {
    return reconcileDirtyRowWithPendingOps(txn, entity, meta, remoteRow, pendingOps);
  }

  const localSide: SyncSide = {
    id: remoteRow.id,
    updatedAt: local.updated_at,
    deletedAt: local.deleted_at,
  };
  const remoteSide: SyncSide = {
    id: remoteRow.id,
    updatedAt: toEpochMs(remoteUpdatedAt(meta, remoteRow)),
    deletedAt:
      meta.hasServerTombstone && remoteRow.deleted_at ? toEpochMs(remoteRow.deleted_at) : null,
  };

  const winner = resolve(localSide, remoteSide, { clockCeiling: clockCeilingMs });

  if (winner === 'local') return 'local-wins';

  await upsertMirrorRow(txn, entity, remoteRow, { dirty: 0 });
  return 'written';
}

export type LocalMirrorWriteOp = 'insert' | 'update' | 'delete' | 'restore';

/**
 * Schreibt lokale Outbox-Mutationen anhand der bekannten Entity-Spalten.
 * Insert und Update setzen `_dirty`; Delete und Restore ändern nur `deleted_at`.
 * Der übergebene Zeitstempel hält lokalen und Remote-Payload synchron.
 */
export async function applyLocalMirrorWrite(
  txn: SqlDatabase,
  entity: Entity,
  op: LocalMirrorWriteOp,
  payload: Record<string, unknown>,
  nowMs: number,
): Promise<void> {
  const meta = mirrorMetaOf(entity);

  if (meta.appendOnly && op !== 'insert') {
    throw new Error(`${entity} ist append-only und akzeptiert ausschliesslich insert.`);
  }

  if (op === 'delete' || op === 'restore') {
    await txn.runAsync(
      `update ${meta.table} set deleted_at = ?, updated_at = ?, _dirty = 1 where id = ?`,
      [op === 'delete' ? nowMs : null, nowMs, String(payload.id)],
    );
    return;
  }

  if (op === 'insert') {
    const columns = [...meta.columns, 'updated_at', '_dirty'];
    const values: SqlParam[] = [
      ...meta.columns.map((column) => toSqlParam(payload[column])),
      nowMs,
      1,
    ];
    const placeholders = columns.map(() => '?').join(', ');
    await txn.runAsync(
      `insert into ${meta.table} (${columns.join(', ')}) values (${placeholders})`,
      values,
    );
    return;
  }

  // Nur bekannte Spalten setzen; `id` und `deleted_at` haben eigene Pfade.
  const fields = Object.keys(payload).filter((key) => key !== 'id' && meta.columns.includes(key));
  const setClauses = [...fields.map((field) => `${field} = ?`), 'updated_at = ?', '_dirty = 1'];
  const values: SqlParam[] = [...fields.map((field) => toSqlParam(payload[field])), nowMs];

  await txn.runAsync(`update ${meta.table} set ${setClauses.join(', ')} where id = ?`, [
    ...values,
    String(payload.id),
  ]);
}

/** Hard-Delete für echte DELETE-Events; App-Löschungen verwenden Tombstones. */
export async function deleteMirrorRow(txn: SqlDatabase, entity: Entity, id: string): Promise<void> {
  const meta = mirrorMetaOf(entity);
  await txn.runAsync(`delete from ${meta.table} where id = ?`, [id]);
}
