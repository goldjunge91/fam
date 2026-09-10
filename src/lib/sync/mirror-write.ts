import {
  type InventoryOperationV1,
  validateInventoryOperation,
} from '@/features/inventory/inventory-lifecycle';
import { metaOf } from '@/lib/db/entities';
import { parseOutboxEntry } from '@/lib/db/outbox';
import type { Entity, OutboxEntry, SqlDatabase, SqlParam } from '@/lib/db/types';
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

  const cursorColumn = meta.syncCursorColumn ?? 'updated_at';
  const updatedAtRaw = remoteRow[cursorColumn];
  if (typeof updatedAtRaw !== 'string') {
    throw new Error(`Remote-Zeile fuer ${entity} hat keinen ${cursorColumn} als String.`);
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
  updated_at?: string;
  created_at?: string;
  deleted_at?: string | null;
};

type LocalRowMeta = { updated_at: number; deleted_at: number | null; _dirty: number };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

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

  const localSide: SyncSide = {
    id: remoteRow.id,
    updatedAt: local.updated_at,
    deletedAt: local.deleted_at,
  };
  const remoteSide: SyncSide = {
    id: remoteRow.id,
    updatedAt: toEpochMs(remoteRow[meta.syncCursorColumn ?? 'updated_at'] as string),
    deletedAt:
      meta.hasServerTombstone && remoteRow.deleted_at ? toEpochMs(remoteRow.deleted_at) : null,
  };

  const winner = resolve(localSide, remoteSide, { clockCeiling: clockCeilingMs });

  if (winner === 'local') return 'local-wins';

  await upsertMirrorRow(txn, entity, remoteRow, { dirty: 0 });
  return 'written';
}

function operationLotIds(operation: InventoryOperationV1): string[] {
  switch (operation.type) {
    case 'insert_inventory':
      return [operation.item_id];
    case 'consume_inventory':
      return operation.mode === 'sealed_partial'
        ? [operation.source_item_id, operation.opened_item_id]
        : [operation.source_item_id];
    case 'waste_inventory':
      return [operation.item_id];
    case 'move_inventory':
    case 'correct_quantity':
      return [operation.item_id];
  }
}

type ProjectionLot = {
  id: string;
  household_id: string;
  quantity: number;
  location_id: string;
  updated_at: number;
  deleted_at: number | null;
};

function projectionDelta(operation: InventoryOperationV1): number | null {
  switch (operation.type) {
    case 'consume_inventory':
      return operation.mode === 'sealed_partial'
        ? operation.portion_quantity
        : operation.consumed_quantity;
    case 'waste_inventory':
      return operation.waste_quantity;
    default:
      return null;
  }
}

/**
 * Reapplies unsent local inventory intent after a remote lot became the base.
 * The local commit already contains the full optimistic write; this projection
 * only repairs rows that a pull just replaced and never creates a second plan.
 */
export async function projectPendingInventoryOperations(
  txn: SqlDatabase,
  householdIds: readonly string[],
  remoteLotIds: ReadonlySet<string>,
): Promise<void> {
  if (remoteLotIds.size === 0) return;

  const entries = await txn.getAllAsync<OutboxEntry>(
    "select * from outbox where entity in ('fridge_items', 'transactions') order by id asc",
  );
  const operations = new Map<string, InventoryOperationV1>();
  for (const entry of entries) {
    try {
      const payload = parseOutboxEntry(entry);
      const envelope = payload.inventory_operation;
      if (!isRecord(envelope)) continue;
      const validation = validateInventoryOperation(envelope.request);
      if (!validation.success || operations.has(validation.data.operation_id)) continue;
      if (!householdIds.includes(validation.data.household_id)) continue;
      operations.set(validation.data.operation_id, validation.data);
    } catch {
      // Push owns malformed outbox handling; pull leaves it untouched.
    }
  }

  const nowMs = Date.now();
  for (const operation of operations.values()) {
    const lotIds = operationLotIds(operation);
    if (!lotIds.some((id) => remoteLotIds.has(id))) continue;

    if (operation.type === 'insert_inventory') {
      await txn.runAsync(
        'update fridge_items set updated_at = ?, _dirty = 1 where id = ? and household_id = ?',
        [nowMs, operation.item_id, operation.household_id],
      );
      continue;
    }

    const sourceId =
      operation.type === 'consume_inventory' ? operation.source_item_id : operation.item_id;
    const source = await txn.getFirstAsync<ProjectionLot>(
      'select id, household_id, quantity, location_id, updated_at, deleted_at from fridge_items where id = ? and household_id = ?',
      [sourceId, operation.household_id],
    );
    if (!source) continue;

    const delta = projectionDelta(operation);
    if (delta !== null) {
      const projectedQuantity = source.quantity - delta;
      if (projectedQuantity < 0) {
        await txn.runAsync(
          'update fridge_items set updated_at = ?, _dirty = 1 where id = ? and household_id = ?',
          [nowMs, source.id, operation.household_id],
        );
        continue;
      }
      await txn.runAsync(
        'update fridge_items set quantity = ?, deleted_at = ?, updated_at = ?, _dirty = 1 where id = ? and household_id = ?',
        [
          projectedQuantity,
          projectedQuantity === 0 ? nowMs : null,
          nowMs,
          source.id,
          operation.household_id,
        ],
      );
    } else if (operation.type === 'move_inventory') {
      await txn.runAsync(
        'update fridge_items set location_id = ?, updated_at = ?, _dirty = 1 where id = ? and household_id = ?',
        [operation.to_location_id, nowMs, source.id, operation.household_id],
      );
    } else if (operation.type === 'correct_quantity') {
      await txn.runAsync(
        'update fridge_items set quantity = ?, deleted_at = ?, updated_at = ?, _dirty = 1 where id = ? and household_id = ?',
        [
          operation.new_quantity,
          operation.new_quantity === 0 ? nowMs : null,
          nowMs,
          source.id,
          operation.household_id,
        ],
      );
    }

    if (operation.type === 'consume_inventory' && operation.mode === 'sealed_partial') {
      await txn.runAsync(
        'update fridge_items set quantity = ?, deleted_at = null, updated_at = ?, _dirty = 1 where id = ? and household_id = ?',
        [operation.remainder_quantity, nowMs, operation.opened_item_id, operation.household_id],
      );
    }
  }
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
