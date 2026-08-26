import { metaOf } from '@/lib/db/entities';
import type { Entity, SqlDatabase, SqlParam } from '@/lib/db/types';
import { toEpochMs } from '@/lib/sync/cursor';
import { resolve, type SyncSide } from '@/lib/sync/resolve';



export type UpsertMirrorRowOptions = {
  /** 0 nach einem Pull oder einem erfolgreichen Push-Response. 1 nur, wo _dirty explizit erhalten bleiben soll. */
  dirty: 0 | 1;
};

function mirrorMetaOf(entity: Entity) {
  const meta = metaOf(entity);
  if (meta.pushOnly) {
    throw new Error(`${entity} ist push-only und darf nicht gespiegelt werden.`);
  }
  return meta;
}

function toSqlParam(value: unknown): SqlParam {
  if (value === undefined || value === null) return null;
  if (typeof value === 'string' || typeof value === 'number') return value;
  // Booleans werden für SQLite als 0/1 gespiegelt.
  if (typeof value === 'boolean') return value ? 1 : 0;
  // Arrays werden für SQLite als JSON-Text gespiegelt.
  if (Array.isArray(value)) return JSON.stringify(value);
  // Numerische Werte bleiben Zahlen, übrige Schemawerte Strings.
export async function upsertMirrorRow(
  txn: SqlDatabase,
  entity: Entity,
  remoteRow: Record<string, unknown>,
  options: UpsertMirrorRowOptions,
): Promise<void> {
  const meta = mirrorMetaOf(entity);

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

export type LocalMirrorWriteOp = 'insert' | 'update' | 'delete' | 'restore';


export async function applyLocalMirrorWrite(
  txn: SqlDatabase,
  entity: Entity,
  op: LocalMirrorWriteOp,
  payload: Record<string, unknown>,
  nowMs: number,
): Promise<void> {
  const meta = mirrorMetaOf(entity);

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

  // Updates übernehmen nur bekannte Spalten, niemals `id` oder `deleted_at`.
  const fields = Object.keys(payload).filter((key) => key !== 'id' && meta.columns.includes(key));
  const setClauses = [...fields.map((field) => `${field} = ?`), 'updated_at = ?', '_dirty = 1'];
  const values: SqlParam[] = [...fields.map((field) => toSqlParam(payload[field])), nowMs];

  await txn.runAsync(`update ${meta.table} set ${setClauses.join(', ')} where id = ?`, [
    ...values,
    String(payload.id),
  ]);
}


export async function deleteMirrorRow(txn: SqlDatabase, entity: Entity, id: string): Promise<void> {
  const meta = mirrorMetaOf(entity);
  await txn.runAsync(`delete from ${meta.table} where id = ?`, [id]);
}
