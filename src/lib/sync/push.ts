import { metaOf } from '@/lib/db/entities';
import {
  deleteOutboxEntries,
  loadPendingOutboxEntries,
  recordOutboxOutcome,
} from '@/lib/db/outbox';
import type { Entity, OutboxEntry, SqlDatabase } from '@/lib/db/types';
import type { TypedSupabaseClient } from '@/lib/supabase';
import { backoffDelayMs, classifyError, MAX_ATTEMPTS } from '@/lib/sync/backoff';
import { type CoalescedEntry, coalesce } from '@/lib/sync/coalesce';
import { parseInventoryMovePayload } from '@/lib/sync/inventory-move';
import { parseInventoryMergeUndoPayload } from '@/lib/sync/inventory-open-merge';
import { parseInventorySplitPayload } from '@/lib/sync/inventory-open-split';
import { parseInventoryQuantityPayload } from '@/lib/sync/inventory-quantity';
import { parseInventoryQuantityCorrectionPayload } from '@/lib/sync/inventory-quantity-correction';
import { parseInventoryQuantityReversalPayload } from '@/lib/sync/inventory-quantity-reversal';
import { applyRemoteRow, type RemoteRow, upsertMirrorRow } from '@/lib/sync/mirror-write';
import { normalizeUnit } from '@/lib/units';

export type PushOutcome =
  | { kind: 'pushed' | 'discarded'; entity?: Entity; entityId?: string; sourceIds: number[] }
  | {
      kind: 'failed-transient' | 'failed-permanent';
      entity: Entity;
      entityId: string;
      sourceIds: number[];
      error: string;
    };

export type PushResult = {
  outcomes: PushOutcome[];
  stoppedEarly: boolean;
};

const SYNC_COLUMNS = new Set(['updated_at', 'deleted_at', '_dirty']);

/** Insert-Payload: Server-Spalten ohne die lokalen Sync-Spalten. */
function buildInsertPayload(
  payload: Record<string, unknown>,
  columns: readonly string[],
  normalizeQuantityUnits: boolean,
): Record<string, unknown> {
  const serverColumns = new Set(columns);
  const result = Object.fromEntries(
    Object.entries(payload).filter(([key]) => !SYNC_COLUMNS.has(key) && serverColumns.has(key)),
  );
  if (normalizeQuantityUnits && 'unit' in result) {
    result.unit = normalizeUnit(typeof result.unit === 'string' ? result.unit : undefined);
  }
  return result;
}

/** Update-Payload: geaenderte Server-Felder ohne Sync-Spalten und id. */
function buildUpdatePayload(
  payload: Record<string, unknown>,
  columns: readonly string[],
  normalizeQuantityUnits: boolean,
): Record<string, unknown> {
  const serverColumns = new Set(columns);
  const result = Object.fromEntries(
    Object.entries(payload).filter(
      ([key]) => !SYNC_COLUMNS.has(key) && key !== 'id' && serverColumns.has(key),
    ),
  );
  if (normalizeQuantityUnits && 'unit' in result) {
    result.unit = normalizeUnit(typeof result.unit === 'string' ? result.unit : undefined);
  }
  return result;
}

type AttemptResult = {
  data: Record<string, unknown>[] | null;
  error: { message: string; code?: string } | null;
  status: number;
};

async function hasPendingMutation(
  txn: SqlDatabase,
  entity: Entity,
  entityId: string,
): Promise<boolean> {
  const row = await txn.getFirstAsync<{ id: number }>(
    'select id from outbox where entity = ? and entity_id = ? limit 1',
    [entity, entityId],
  );
  return row !== null;
}

async function hasPendingFridgeItemInsert(db: SqlDatabase, itemId: string): Promise<boolean> {
  const row = await db.getFirstAsync<{ id: number }>(
    `select id
       from outbox
      where entity = 'fridge_items'
        and entity_id = ?
        and op = 'insert'
      limit 1`,
    [itemId],
  );
  return row !== null;
}

type MoveRpcArgs = {
  p_operation_id: string;
  p_item_id: string;
  p_household_id: string;
  p_expected_location_id: string | null;
  p_new_location_id: string | null;
  p_expected_quantity: number;
  p_out_transaction_id: string;
  p_in_transaction_id: string;
  p_created_at: string;
  p_reversal_of?: string | null;
  p_notes?: string | null;
};

type MoveRpcResponse = {
  data: string | null;
  error: { code?: string; message: string } | null;
  status: number;
};

type MoveRpc = (
  functionName: 'move_fridge_item' | 'reverse_move_fridge_item',
  args: MoveRpcArgs,
) => Promise<MoveRpcResponse>;

type SplitRpcArgs = {
  p_transaction_id: string;
  p_source_item_id: string;
  p_opened_item_id: string;
  p_household_id: string;
  p_expected_source_quantity: number;
  p_open_quantity: number;
  p_opened_at: string;
  p_new_expiry_date: string | null;
  p_expiry_user_set: boolean;
  p_created_at: string;
};

type SplitRpc = (
  functionName: 'split_fridge_item_open',
  args: SplitRpcArgs,
) => Promise<MoveRpcResponse>;

type MergeUndoRpcArgs = {
  p_reversal_transaction_id: string;
  p_reversal_of: string;
  p_household_id: string;
  p_created_at: string;
  p_notes: string;
};

type MergeUndoRpc = (
  functionName: 'merge_undo_fridge_item_open',
  args: MergeUndoRpcArgs,
) => Promise<MoveRpcResponse>;

type GenericQuery<T> = {
  then<TResult1 = T, TResult2 = never>(
    onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2>;
  insert(payload: Record<string, unknown>): GenericQuery<T>;
  update(payload: Record<string, unknown>): GenericQuery<T>;
  select(columns?: string): GenericQuery<T>;
  eq(column: string, value: unknown): GenericQuery<T>;
};

type SingleRowQuery = {
  select(columns: string): {
    eq(
      column: string,
      value: unknown,
    ): {
      maybeSingle(): Promise<{
        data: Record<string, unknown> | null;
        error: { code?: string; message: string } | null;
        status: number;
      }>;
    };
  };
};

/** Zeitstempel-Spalten (`*_at`) kommen von PostgREST in Postgres-Schreibweise
 * (z. B. `2026-09-04 10:00:00+00`) zurueck, nicht in der gesendeten ISO-Form
 * (`2026-09-04T10:00:00.000Z`) — beide koennen denselben Zeitpunkt meinen. */
function ledgerValuesMatch(column: string, actual: unknown, expected: unknown): boolean {
  const a = actual ?? null;
  const e = expected ?? null;
  if (column.endsWith('_at') && typeof a === 'string' && typeof e === 'string') {
    const aTime = Date.parse(a);
    const eTime = Date.parse(e);
    if (!Number.isNaN(aTime) && !Number.isNaN(eTime)) return aTime === eTime;
  }
  return Object.is(a, e);
}

async function verifyAppendOnlyDuplicate(
  supabase: TypedSupabaseClient,
  table: Entity,
  entityId: string,
  payload: Record<string, unknown>,
): Promise<{ matches: boolean; error?: string }> {
  const meta = metaOf(table);
  const expected = buildInsertPayload(payload, meta.columns, meta.normalizeQuantityUnits === true);
  const columns = Object.keys(expected);
  const idColumn = meta.columns[0];
  const query = supabase.from(table as never) as unknown as SingleRowQuery;
  const response = await query.select(columns.join(',')).eq(idColumn, entityId).maybeSingle();
  if (response.error) return { matches: false, error: response.error.message };
  if (response.data === null) return { matches: false, error: 'Serverzeile fehlt.' };

  const mismatchedColumn = columns.find(
    (column) => !ledgerValuesMatch(column, response.data?.[column], expected[column]),
  );
  return mismatchedColumn
    ? { matches: false, error: `Feld ${mismatchedColumn} stimmt nicht ueberein.` }
    : { matches: true };
}

async function attempt(
  supabase: TypedSupabaseClient,
  table: Entity,
  op: 'insert' | 'update' | 'delete' | 'restore',
  entityId: string,
  payload: Record<string, unknown>,
  nowMs: number,
): Promise<AttemptResult> {
  // Die Tabellenkorrelation geht bei einem dynamischen `Entity`-Union verloren.
  // Dieser kleine Adapter typisiert nur die tatsächlich verwendete Query-Fläche;
  // Tabelle und Spalten kommen weiterhin ausschließlich aus `entities.ts`.
  const query = supabase.from(table as never) as unknown as GenericQuery<AttemptResult>;
  const meta = metaOf(table);

  if (op === 'insert') {
    const insertPayload = buildInsertPayload(
      payload,
      meta.columns,
      meta.normalizeQuantityUnits === true,
    );
    const response = meta.pushOnly
      ? await query.insert(insertPayload)
      : await query.insert(insertPayload).select();
    return response as AttemptResult;
  }

  if (op === 'delete') {
    const response = await query
      .update({
        ...buildUpdatePayload(payload, meta.columns, meta.normalizeQuantityUnits === true),
        deleted_at: new Date(nowMs).toISOString(),
      })
      .eq('id', entityId)
      .select();
    return response as AttemptResult;
  }

  if (op === 'restore') {
    // Nicht nur { deleted_at: null }: coalesce() haelt group.op auf 'restore'
    // fest, auch wenn danach noch ein 'update' auf dieselbe id gemergt wird
    // (z. B. Praeferenz reaktivieren + neue category_id in einem Zug, #223
    // Paket 3) — der zusaetzliche Payload-Inhalt wuerde sonst schweigend
    // verworfen. Fuer bestehende reine Undo-Restores (#69) aendert das
    // nichts: deren Payload traegt ausser deleted_at nur unveraenderte
    // Identitaetsfelder (z. B. household_id), ein Update darauf ist idempotent.
    const response = await query
      .update({
        ...buildUpdatePayload(payload, meta.columns, meta.normalizeQuantityUnits === true),
        deleted_at: null,
      })
      .eq('id', entityId)
      .select();
    return response as AttemptResult;
  }

  const response = await query
    .update(buildUpdatePayload(payload, meta.columns, meta.normalizeQuantityUnits === true))
    .eq('id', entityId)
    .select();
  return response as AttemptResult;
}

async function attemptInventoryMove(
  supabase: TypedSupabaseClient,
  move: ReturnType<typeof parseInventoryMovePayload>,
): Promise<AttemptResult> {
  // Supabase's generated function type currently loses nullable UUID
  // arguments, although the declarative SQL function accepts NULL for both
  // locations. Keep the runtime contract explicit at this narrow boundary;
  // all fields are validated by parseInventoryMovePayload before the call.
  const moveRpc = supabase.rpc.bind(supabase) as unknown as MoveRpc;
  const isReversal = move.reversal_of !== undefined && move.reversal_of !== null;
  if (isReversal && (move.notes === undefined || move.notes === null)) {
    return {
      data: null,
      error: {
        code: 'move_payload_invalid',
        message: 'Eine Move-Gegenbuchung benötigt stabile Provenienz und Notizen.',
      },
      status: 400,
    };
  }

  const rpcResponse = await moveRpc(isReversal ? 'reverse_move_fridge_item' : 'move_fridge_item', {
    p_operation_id: move.operation_id,
    p_item_id: move.item_id,
    p_household_id: move.household_id,
    p_expected_location_id: move.expected_location_id,
    p_new_location_id: move.new_location_id,
    p_expected_quantity: move.expected_quantity,
    p_out_transaction_id: move.out_transaction_id,
    p_in_transaction_id: move.in_transaction_id,
    p_created_at: move.created_at,
    ...(isReversal ? { p_reversal_of: move.reversal_of, p_notes: move.notes } : {}),
  });
  if (rpcResponse.error) {
    return {
      data: null,
      error: { code: rpcResponse.error.code, message: rpcResponse.error.message },
      status: rpcResponse.status,
    };
  }

  // The RPC returns only the stable item id. Read the canonical row afterwards
  // so the normal mirror-write path also receives the server updated_at.
  const remoteResponse = await supabase
    .from('fridge_items')
    .select('*')
    .eq('id', move.item_id)
    .maybeSingle();
  if (remoteResponse.error) {
    return {
      data: null,
      error: { code: remoteResponse.error.code, message: remoteResponse.error.message },
      status: remoteResponse.status,
    };
  }
  if (remoteResponse.data === null) {
    return {
      data: null,
      error: { message: 'Move wurde bestaetigt, aber der Bestand ist nicht lesbar.' },
      status: remoteResponse.status,
    };
  }

  return { data: [{ ...remoteResponse.data }], error: null, status: remoteResponse.status };
}

type MultiRowQuery = {
  select(columns: string): {
    in(
      column: string,
      values: readonly unknown[],
    ): Promise<{
      data: Record<string, unknown>[] | null;
      error: { code?: string; message: string } | null;
      status: number;
    }>;
  };
};

async function attemptInventorySplit(
  supabase: TypedSupabaseClient,
  split: ReturnType<typeof parseInventorySplitPayload>,
): Promise<AttemptResult> {
  const splitRpc = supabase.rpc.bind(supabase) as unknown as SplitRpc;
  const rpcResponse = await splitRpc('split_fridge_item_open', {
    p_transaction_id: split.transaction_id,
    p_source_item_id: split.source_item_id,
    p_opened_item_id: split.opened_item_id,
    p_household_id: split.household_id,
    p_expected_source_quantity: split.expected_source_quantity,
    p_open_quantity: split.open_quantity,
    p_opened_at: split.opened_at,
    p_new_expiry_date: split.new_expiry_date,
    p_expiry_user_set: split.expiry_user_set,
    p_created_at: split.created_at,
  });
  if (rpcResponse.error) {
    return {
      data: null,
      error: { code: rpcResponse.error.code, message: rpcResponse.error.message },
      status: rpcResponse.status,
    };
  }

  // Der RPC liefert nur die ID des geoeffneten Loses zurueck. Ein Split
  // veraendert Rest- und geoeffnetes Los gemeinsam — RLS blendet weich
  // geloeschte Zeilen nicht aus, also liest ein Select beide unveraendert.
  const query = supabase.from('fridge_items') as unknown as MultiRowQuery;
  const remoteResponse = await query
    .select('*')
    .in('id', [split.source_item_id, split.opened_item_id]);
  if (remoteResponse.error) {
    return {
      data: null,
      error: { code: remoteResponse.error.code, message: remoteResponse.error.message },
      status: remoteResponse.status,
    };
  }
  const rows = remoteResponse.data ?? [];
  const sourceRow = rows.find((row) => row.id === split.source_item_id);
  const openedRow = rows.find((row) => row.id === split.opened_item_id);
  if (!sourceRow || !openedRow) {
    return {
      data: null,
      error: { message: 'Split wurde bestaetigt, aber nicht beide Lose sind lesbar.' },
      status: remoteResponse.status,
    };
  }

  return { data: [sourceRow, openedRow], error: null, status: remoteResponse.status };
}

async function attemptInventoryMergeUndo(
  supabase: TypedSupabaseClient,
  mergeUndo: ReturnType<typeof parseInventoryMergeUndoPayload>,
): Promise<AttemptResult> {
  const mergeUndoRpc = supabase.rpc.bind(supabase) as unknown as MergeUndoRpc;
  const rpcResponse = await mergeUndoRpc('merge_undo_fridge_item_open', {
    p_reversal_transaction_id: mergeUndo.reversal_transaction_id,
    p_reversal_of: mergeUndo.reversal_of,
    p_household_id: mergeUndo.household_id,
    p_created_at: mergeUndo.created_at,
    p_notes: mergeUndo.notes,
  });
  if (rpcResponse.error) {
    return {
      data: null,
      error: { code: rpcResponse.error.code, message: rpcResponse.error.message },
      status: rpcResponse.status,
    };
  }
  const sealedItemId = rpcResponse.data;
  if (!sealedItemId) {
    return {
      data: null,
      error: { message: 'Merge-Undo wurde bestaetigt, lieferte aber keine Bestands-ID.' },
      status: rpcResponse.status,
    };
  }

  // Der Server leitet Rest- und geoeffnetes Los aus der referenzierten
  // Split-Buchung ab; die Outbox-Entity kennt bislang nur das versiegelte Los
  // (entry.entityId). Die Ledgerzeile der Gegenbuchung nennt beide Ids.
  const ledgerResponse = await supabase
    .from('transactions')
    .select('fridge_item_id')
    .eq('id', mergeUndo.reversal_transaction_id)
    .maybeSingle();
  if (ledgerResponse.error) {
    return {
      data: null,
      error: { code: ledgerResponse.error.code, message: ledgerResponse.error.message },
      status: ledgerResponse.status,
    };
  }
  const openedItemId = ledgerResponse.data?.fridge_item_id;
  if (typeof openedItemId !== 'string') {
    return {
      data: null,
      error: { message: 'Merge-Undo bestaetigt, aber die Gegenbuchung ist nicht lesbar.' },
      status: ledgerResponse.status,
    };
  }

  const query = supabase.from('fridge_items') as unknown as MultiRowQuery;
  const remoteResponse = await query.select('*').in('id', [sealedItemId, openedItemId]);
  if (remoteResponse.error) {
    return {
      data: null,
      error: { code: remoteResponse.error.code, message: remoteResponse.error.message },
      status: remoteResponse.status,
    };
  }
  const rows = remoteResponse.data ?? [];
  const sealedRow = rows.find((row) => row.id === sealedItemId);
  const openedRow = rows.find((row) => row.id === openedItemId);
  if (!sealedRow || !openedRow) {
    return {
      data: null,
      error: { message: 'Merge-Undo wurde bestaetigt, aber nicht beide Lose sind lesbar.' },
      status: remoteResponse.status,
    };
  }

  return { data: [sealedRow, openedRow], error: null, status: remoteResponse.status };
}

type InventoryQuantityOperation =
  | { kind: 'adjustment'; payload: ReturnType<typeof parseInventoryQuantityPayload> }
  | { kind: 'correction'; payload: ReturnType<typeof parseInventoryQuantityCorrectionPayload> }
  | { kind: 'reversal'; payload: ReturnType<typeof parseInventoryQuantityReversalPayload> };

function parseInventoryQuantityOperation(entry: CoalescedEntry): InventoryQuantityOperation {
  if (entry.op === 'reverse_quantity') {
    return { kind: 'reversal', payload: parseInventoryQuantityReversalPayload(entry.payload) };
  }
  if (entry.op === 'correct_quantity') {
    return { kind: 'correction', payload: parseInventoryQuantityCorrectionPayload(entry.payload) };
  }
  return { kind: 'adjustment', payload: parseInventoryQuantityPayload(entry.payload) };
}

async function attemptInventoryQuantity(
  supabase: TypedSupabaseClient,
  operation: InventoryQuantityOperation,
): Promise<AttemptResult> {
  // Anders als move_fridge_item haben diese drei RPCs keine nullbaren
  // Argumente — der generierte Vertrag aus database.types.ts passt hier
  // direkt, ohne die Typumgehung, die move_fridge_item weiterhin braucht.
  const rpcResponse =
    operation.kind === 'reversal'
      ? await supabase.rpc('reverse_inventory_quantity_transaction', {
          p_reversal_transaction_id: operation.payload.reversal_transaction_id,
          p_reversal_of: operation.payload.reversal_of,
          p_item_id: operation.payload.item_id,
          p_household_id: operation.payload.household_id,
          p_created_at: operation.payload.created_at,
          p_notes: operation.payload.notes,
        })
      : operation.kind === 'correction'
        ? await supabase.rpc('correct_fridge_item_quantity', {
            p_operation_id: operation.payload.operation_id,
            p_transaction_id: operation.payload.transaction_id,
            p_item_id: operation.payload.item_id,
            p_household_id: operation.payload.household_id,
            p_expected_quantity: operation.payload.expected_quantity,
            p_new_quantity: operation.payload.new_quantity,
            p_created_at: operation.payload.created_at,
          })
        : await supabase.rpc('adjust_fridge_item_quantity', {
            p_operation_id: operation.payload.operation_id,
            p_transaction_id: operation.payload.transaction_id,
            p_item_id: operation.payload.item_id,
            p_household_id: operation.payload.household_id,
            p_delta: operation.payload.delta,
            p_created_at: operation.payload.created_at,
          });
  if (rpcResponse.error) {
    return {
      data: null,
      error: { code: rpcResponse.error.code, message: rpcResponse.error.message },
      status: rpcResponse.status,
    };
  }

  const remoteResponse = await supabase
    .from('fridge_items')
    .select('*')
    .eq('id', operation.payload.item_id)
    .maybeSingle();
  if (remoteResponse.error) {
    return {
      data: null,
      error: { code: remoteResponse.error.code, message: remoteResponse.error.message },
      status: remoteResponse.status,
    };
  }
  if (remoteResponse.data === null) {
    return {
      data: null,
      error: { message: 'Mengenänderung bestätigt, aber der Bestand ist nicht lesbar.' },
      status: remoteResponse.status,
    };
  }

  return { data: [{ ...remoteResponse.data }], error: null, status: remoteResponse.status };
}

type InventoryPushConfirmation = (
  txn: SqlDatabase,
  rows: readonly Record<string, unknown>[],
) => Promise<void>;

async function recordInventoryPushFailure(
  db: SqlDatabase,
  entry: CoalescedEntry,
  message: string,
  kind: 'transient' | 'permanent',
  nowMs: number,
  currentAttempts: number,
): Promise<{ outcome: PushOutcome; stop: boolean }> {
  if (kind === 'transient') {
    const nextAttempts = currentAttempts + 1;
    const terminal = nextAttempts >= MAX_ATTEMPTS;
    await recordOutboxOutcome(db, entry.sourceIds, {
      attempts: nextAttempts,
      lastError: message,
      nextAttemptAtMs: terminal ? Number.MAX_SAFE_INTEGER : nowMs + backoffDelayMs(currentAttempts),
    });
    return {
      outcome: {
        kind: 'failed-transient',
        entity: entry.entity,
        entityId: entry.entityId,
        sourceIds: entry.sourceIds,
        error: message,
      },
      stop: true,
    };
  }

  await recordOutboxOutcome(db, entry.sourceIds, {
    attempts: MAX_ATTEMPTS,
    lastError: message,
    nextAttemptAtMs: Number.MAX_SAFE_INTEGER,
  });
  return {
    outcome: {
      kind: 'failed-permanent',
      entity: entry.entity,
      entityId: entry.entityId,
      sourceIds: entry.sourceIds,
      error: message,
    },
    stop: false,
  };
}

async function completeInventoryPush(args: {
  db: SqlDatabase;
  entry: CoalescedEntry;
  nowMs: number;
  currentAttempts: number;
  attempt: () => Promise<AttemptResult>;
  expectedRows: number;
  missingRowsMessage: string;
  confirm: InventoryPushConfirmation;
}): Promise<{ outcome: PushOutcome; stop: boolean }> {
  const response = await args.attempt();
  if (response.error) {
    const status = response.status === 0 ? null : response.status;
    return recordInventoryPushFailure(
      args.db,
      args.entry,
      response.error.message,
      classifyError(status),
      args.nowMs,
      args.currentAttempts,
    );
  }

  const rows = response.data ?? [];
  if (rows.length < args.expectedRows) {
    return recordInventoryPushFailure(
      args.db,
      args.entry,
      args.missingRowsMessage,
      'permanent',
      args.nowMs,
      args.currentAttempts,
    );
  }

  await args.db.withExclusiveTransactionAsync(async (txn) => {
    await deleteOutboxEntries(txn, args.entry.sourceIds);
    await args.confirm(txn, rows);
  });

  return {
    outcome: {
      kind: 'pushed',
      entity: args.entry.entity,
      entityId: args.entry.entityId,
      sourceIds: args.entry.sourceIds,
    },
    stop: false,
  };
}

async function applyInventoryQuantityPush(
  db: SqlDatabase,
  supabase: TypedSupabaseClient,
  entry: CoalescedEntry,
  nowMs: number,
  currentAttempts: number,
): Promise<{ outcome: PushOutcome; stop: boolean }> {
  let operation: InventoryQuantityOperation;
  try {
    operation = parseInventoryQuantityOperation(entry);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return recordInventoryPushFailure(db, entry, message, 'permanent', nowMs, currentAttempts);
  }

  if (entry.entity !== 'fridge_items') {
    const message = 'Eine Mengenänderung ist nur fuer fridge_items zulaessig.';
    return recordInventoryPushFailure(db, entry, message, 'permanent', nowMs, currentAttempts);
  }

  if (operation.payload.item_id !== entry.entityId) {
    const message = 'Mengen-Payload und Outbox-Entity zeigen auf unterschiedliche Bestände.';
    return recordInventoryPushFailure(db, entry, message, 'permanent', nowMs, currentAttempts);
  }

  return completeInventoryPush({
    db,
    entry,
    nowMs,
    currentAttempts,
    attempt: () => attemptInventoryQuantity(supabase, operation),
    expectedRows: 1,
    missingRowsMessage: 'Mengenänderung lieferte keine kanonische Bestandszeile.',
    confirm: async (txn, rows) => {
      // Immer durch die Reconciliation schleusen, nicht nur wenn keine weitere
      // Mengenoperation mehr offen ist: sonst geht die gerade bestaetigte
      // Server-Basis fuer eine noch offene Folgeoperation verloren (fam-onu).
      await applyRemoteRow(txn, 'fridge_items', rows[0] as RemoteRow, nowMs);
      const transactionId =
        operation.kind === 'reversal'
          ? operation.payload.reversal_transaction_id
          : operation.payload.transaction_id;
      await txn.runAsync('update transactions set _dirty = 0 where id = ?', [transactionId]);
    },
  });
}

async function applyInventoryMovePush(
  db: SqlDatabase,
  supabase: TypedSupabaseClient,
  entry: CoalescedEntry,
  nowMs: number,
  currentAttempts: number,
): Promise<{ outcome: PushOutcome; stop: boolean }> {
  if (entry.entity !== 'fridge_items') {
    const message = 'Eine Move-Operation ist nur fuer fridge_items zulaessig.';
    return recordInventoryPushFailure(db, entry, message, 'permanent', nowMs, currentAttempts);
  }

  let move: ReturnType<typeof parseInventoryMovePayload>;
  try {
    move = parseInventoryMovePayload(entry.payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return recordInventoryPushFailure(db, entry, message, 'permanent', nowMs, currentAttempts);
  }

  if (move.item_id !== entry.entityId) {
    const message = 'Move-Payload und Outbox-Entity zeigen auf unterschiedliche Bestände.';
    return recordInventoryPushFailure(db, entry, message, 'permanent', nowMs, currentAttempts);
  }

  return completeInventoryPush({
    db,
    entry,
    nowMs,
    currentAttempts,
    attempt: () => attemptInventoryMove(supabase, move),
    expectedRows: 1,
    missingRowsMessage: 'Move lieferte keine kanonische Bestandszeile.',
    confirm: async (txn, rows) => {
      if (!(await hasPendingMutation(txn, entry.entity, entry.entityId))) {
        await upsertMirrorRow(txn, 'fridge_items', rows[0], { dirty: 0 });
      }
      await txn.runAsync('update transactions set _dirty = 0 where id in (?, ?)', [
        move.out_transaction_id,
        move.in_transaction_id,
      ]);
    },
  });
}

async function applyInventorySplitPush(
  db: SqlDatabase,
  supabase: TypedSupabaseClient,
  entry: CoalescedEntry,
  nowMs: number,
  currentAttempts: number,
): Promise<{ outcome: PushOutcome; stop: boolean }> {
  if (entry.entity !== 'fridge_items') {
    const message = 'Eine Split-Operation ist nur fuer fridge_items zulaessig.';
    return recordInventoryPushFailure(db, entry, message, 'permanent', nowMs, currentAttempts);
  }

  let split: ReturnType<typeof parseInventorySplitPayload>;
  try {
    split = parseInventorySplitPayload(entry.payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return recordInventoryPushFailure(db, entry, message, 'permanent', nowMs, currentAttempts);
  }

  if (split.source_item_id !== entry.entityId) {
    const message = 'Split-Payload und Outbox-Entity zeigen auf unterschiedliche Bestände.';
    return recordInventoryPushFailure(db, entry, message, 'permanent', nowMs, currentAttempts);
  }

  return completeInventoryPush({
    db,
    entry,
    nowMs,
    currentAttempts,
    attempt: () => attemptInventorySplit(supabase, split),
    expectedRows: 2,
    missingRowsMessage: 'Split lieferte nicht beide kanonischen Bestandszeilen.',
    confirm: async (txn, rows) => {
      await applyRemoteRow(txn, 'fridge_items', rows[0] as RemoteRow, nowMs);
      await applyRemoteRow(txn, 'fridge_items', rows[1] as RemoteRow, nowMs);
      await txn.runAsync('update transactions set _dirty = 0 where id = ?', [split.transaction_id]);
    },
  });
}

async function applyInventoryMergeUndoPush(
  db: SqlDatabase,
  supabase: TypedSupabaseClient,
  entry: CoalescedEntry,
  nowMs: number,
  currentAttempts: number,
): Promise<{ outcome: PushOutcome; stop: boolean }> {
  if (entry.entity !== 'fridge_items') {
    const message = 'Eine Merge-Undo-Operation ist nur fuer fridge_items zulaessig.';
    return recordInventoryPushFailure(db, entry, message, 'permanent', nowMs, currentAttempts);
  }

  let mergeUndo: ReturnType<typeof parseInventoryMergeUndoPayload>;
  try {
    mergeUndo = parseInventoryMergeUndoPayload(entry.payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return recordInventoryPushFailure(db, entry, message, 'permanent', nowMs, currentAttempts);
  }

  return completeInventoryPush({
    db,
    entry,
    nowMs,
    currentAttempts,
    attempt: () => attemptInventoryMergeUndo(supabase, mergeUndo),
    expectedRows: 2,
    missingRowsMessage: 'Merge-Undo lieferte nicht beide kanonischen Bestandszeilen.',
    confirm: async (txn, rows) => {
      await applyRemoteRow(txn, 'fridge_items', rows[0] as RemoteRow, nowMs);
      await applyRemoteRow(txn, 'fridge_items', rows[1] as RemoteRow, nowMs);
      await txn.runAsync('update transactions set _dirty = 0 where id = ?', [
        mergeUndo.reversal_transaction_id,
      ]);
    },
  });
}

/** Wendet einen einzelnen gecoalescten Push an. Gibt das Ergebnis und zurueck, ob die Schleife stoppen muss. */
async function applyOnePush(
  db: SqlDatabase,
  supabase: TypedSupabaseClient,
  entry: CoalescedEntry,
  nowMs: number,
  currentAttempts: number,
): Promise<{ outcome: PushOutcome; stop: boolean }> {
  if (entry.op === 'move') {
    return applyInventoryMovePush(db, supabase, entry, nowMs, currentAttempts);
  }
  if (
    entry.op === 'adjust_quantity' ||
    entry.op === 'correct_quantity' ||
    entry.op === 'reverse_quantity'
  ) {
    return applyInventoryQuantityPush(db, supabase, entry, nowMs, currentAttempts);
  }
  if (entry.op === 'split_open') {
    return applyInventorySplitPush(db, supabase, entry, nowMs, currentAttempts);
  }
  if (entry.op === 'merge_undo_open') {
    return applyInventoryMergeUndoPush(db, supabase, entry, nowMs, currentAttempts);
  }

  const meta = metaOf(entry.entity);

  if (meta.appendOnly && entry.op !== 'insert') {
    const message = `${entry.entity} ist append-only und akzeptiert ausschliesslich insert.`;
    await recordOutboxOutcome(db, entry.sourceIds, {
      attempts: MAX_ATTEMPTS,
      lastError: message,
      nextAttemptAtMs: Number.MAX_SAFE_INTEGER,
    });
    return {
      outcome: {
        kind: 'failed-permanent',
        entity: entry.entity,
        entityId: entry.entityId,
        sourceIds: entry.sourceIds,
        error: message,
      },
      stop: false,
    };
  }

  // Feedback-Events sind ein append-only/push-only Vertrag. Jede andere Op
  // ist ein lokaler Programmierfehler und wird garantiert vor `attempt()`
  // abgewiesen, also ohne SELECT, UPDATE, DELETE oder sonstigen Netzwerk-I/O.
  if (meta.pushOnly && entry.op !== 'insert') {
    const message = `${entry.entity} ist push-only und akzeptiert ausschliesslich insert.`;
    await recordOutboxOutcome(db, entry.sourceIds, {
      attempts: MAX_ATTEMPTS,
      lastError: message,
      nextAttemptAtMs: Number.MAX_SAFE_INTEGER,
    });
    return {
      outcome: {
        kind: 'failed-permanent',
        entity: entry.entity,
        entityId: entry.entityId,
        sourceIds: entry.sourceIds,
        error: message,
      },
      stop: false,
    };
  }

  // products hat kein deleted_at serverseitig — ein delete/restore waere ein
  // Soft-Delete-Versuch gegen eine nicht existente Spalte. Kein Netzwerkaufruf.
  if ((entry.op === 'delete' || entry.op === 'restore') && !meta.hasServerTombstone) {
    const message = `${entry.entity} unterstuetzt kein Loeschen/Wiederherstellen (kein Server-Tombstone).`;
    await recordOutboxOutcome(db, entry.sourceIds, {
      attempts: MAX_ATTEMPTS,
      lastError: message,
      nextAttemptAtMs: Number.MAX_SAFE_INTEGER,
    });
    return {
      outcome: {
        kind: 'failed-permanent',
        entity: entry.entity,
        entityId: entry.entityId,
        sourceIds: entry.sourceIds,
        error: message,
      },
      stop: false,
    };
  }

  let response = await attempt(
    supabase,
    meta.table,
    entry.op,
    entry.entityId,
    entry.payload,
    nowMs,
  );

  // Netzwerkaufruf erfolgreich, aber der lokale Commit (Outbox loeschen +
  // Server-Zeile upserten) kam vorher nicht mehr zustande: ein insert mit
  // derselben id verletzt den PK und liefert 23505/409. Die Zeile ist laengst
  // sicher auf dem Server — ein update mit demselben Inhalt ist idempotent.
  if (entry.op === 'insert' && response.error?.code === '23505') {
    if (meta.pushOnly || meta.appendOnly) {
      // Clientseitige IDs sind der Idempotenzschlüssel. Der Server hat das
      // Event bereits akzeptiert, also ist ein Retry derselben INSERT-Operation
      // ein erfolgreicher Abschluss und kein Anlass fuer ein UPDATE. Das ist
      // bei append-only-Tabellen nicht nur unnötig, sondern per RLS verboten.
      if (meta.appendOnly) {
        const verification = await verifyAppendOnlyDuplicate(
          supabase,
          meta.table,
          entry.entityId,
          entry.payload,
        );
        if (!verification.matches) {
          response = {
            data: null,
            error: {
              code: 'append_only_duplicate_mismatch',
              message: `Vorhandene ${entry.entity}-Zeile passt nicht zum Retry: ${verification.error ?? 'unbekannter Konflikt'}`,
            },
            status: 409,
          };
        } else {
          await db.withExclusiveTransactionAsync(async (txn) => {
            await deleteOutboxEntries(txn, entry.sourceIds);
            await txn.runAsync(`update ${meta.table} set _dirty = 0 where id = ?`, [
              entry.entityId,
            ]);
          });
          return {
            outcome: {
              kind: 'pushed',
              entity: entry.entity,
              entityId: entry.entityId,
              sourceIds: entry.sourceIds,
            },
            stop: false,
          };
        }
      }
      if (meta.pushOnly) response = { data: null, error: null, status: response.status };
    } else {
      response = await attempt(
        supabase,
        meta.table,
        'update',
        entry.entityId,
        entry.payload,
        nowMs,
      );
    }
  }

  // Bei jedem Fehler eines registrierten Resolvers die Chance geben, ihn zu
  // reparieren und den Push erneut zu versuchen — welcher Fehlercode/welche
  // Constraint das rechtfertigt, entscheidet ausschliesslich der Resolver
  // (siehe `entities.ts`, #192). Push.ts kennt weder Tabellennamen wie
  // `fridge_items` noch Spalten wie `location_id`.
  if (response.error && meta.onForeignKeyViolation) {
    const repairedPayload = await meta.onForeignKeyViolation(
      { db, supabase },
      entry.payload,
      response.error,
    );
    if (repairedPayload) {
      response = await attempt(
        supabase,
        meta.table,
        entry.op,
        entry.entityId,
        repairedPayload,
        nowMs,
      );
    }
  }

  if (response.error) {
    const rawStatus = response.status;
    // postgrest-js liefert bei einem echten Netzwerkfehler status: 0, nicht
    // null — classifyError() erwartet null fuer "Server nie erreicht".
    const status = rawStatus === 0 ? null : rawStatus;
    const kind = classifyError(status);
    const message = response.error.message;

    if (kind === 'transient') {
      const nextAttempts = currentAttempts + 1;
      const terminal = nextAttempts >= MAX_ATTEMPTS;
      await recordOutboxOutcome(db, entry.sourceIds, {
        attempts: nextAttempts,
        lastError: message,
        nextAttemptAtMs: terminal
          ? Number.MAX_SAFE_INTEGER
          : nowMs + backoffDelayMs(currentAttempts),
      });
      return {
        outcome: {
          kind: 'failed-transient',
          entity: entry.entity,
          entityId: entry.entityId,
          sourceIds: entry.sourceIds,
          error: message,
        },
        // Netz ist verdaechtig — der naechste Eintrag wuerde vermutlich
        // ebenso scheitern. Abbrechen erhaelt zudem die Erstellungsreihenfolge.
        stop: true,
      };
    }

    await recordOutboxOutcome(db, entry.sourceIds, {
      attempts: MAX_ATTEMPTS,
      lastError: message,
      nextAttemptAtMs: Number.MAX_SAFE_INTEGER,
    });
    return {
      outcome: {
        kind: 'failed-permanent',
        entity: entry.entity,
        entityId: entry.entityId,
        sourceIds: entry.sourceIds,
        error: message,
      },
      // Eine vergiftete Zeile darf die Queue nicht dauerhaft blockieren.
      stop: false,
    };
  }

  if (meta.pushOnly) {
    await db.withExclusiveTransactionAsync(async (txn) => {
      await deleteOutboxEntries(txn, entry.sourceIds);
      await txn.runAsync(`update ${meta.table} set _dirty = 0, synced_at = ? where event_id = ?`, [
        nowMs,
        entry.entityId,
      ]);
    });

    return {
      outcome: {
        kind: 'pushed',
        entity: entry.entity,
        entityId: entry.entityId,
        sourceIds: entry.sourceIds,
      },
      stop: false,
    };
  }

  const returnedRow = response.data?.[0];

  // Kein Fehler, aber auch keine Zeile: RLS hat die Zeile bei einem
  // update/delete-als-update still herausgefiltert (0 betroffene Zeilen ist
  // fuer Postgres kein Fehlerfall). Ohne diesen Fall wuerde unten auf eine nie
  // vorhandene Zeile zugegriffen.
  if (returnedRow === undefined) {
    const message = 'Zeile nicht gefunden oder keine Berechtigung (RLS).';
    await recordOutboxOutcome(db, entry.sourceIds, {
      attempts: MAX_ATTEMPTS,
      lastError: message,
      nextAttemptAtMs: Number.MAX_SAFE_INTEGER,
    });
    return {
      outcome: {
        kind: 'failed-permanent',
        entity: entry.entity,
        entityId: entry.entityId,
        sourceIds: entry.sourceIds,
        error: message,
      },
      stop: false,
    };
  }

  await db.withExclusiveTransactionAsync(async (txn) => {
    await deleteOutboxEntries(txn, entry.sourceIds);
    if (!(await hasPendingMutation(txn, entry.entity, entry.entityId))) {
      await upsertMirrorRow(txn, entry.entity, returnedRow, { dirty: 0 });
    }
  });

  return {
    outcome: {
      kind: 'pushed',
      entity: entry.entity,
      entityId: entry.entityId,
      sourceIds: entry.sourceIds,
    },
    stop: false,
  };
}

/** Welche fridge_items-Artikel eine Operation betrifft — Grundlage sowohl fuer
 * die Insert-Abhaengigkeit oben als auch fuer die Batch-interne Artikelsperre. */
function fridgeItemIdsReferencedBy(push: CoalescedEntry): string[] {
  if (push.entity === 'fridge_items') {
    if (push.op === 'split_open') {
      const openedItemId = push.payload.opened_item_id;
      return [push.entityId, ...(typeof openedItemId === 'string' ? [openedItemId] : [])];
    }
    return [push.entityId];
  }
  if (push.entity === 'transactions') {
    return [push.payload.fridge_item_id, push.payload.origin_item_id].filter(
      (itemId): itemId is string => typeof itemId === 'string',
    );
  }
  return [];
}

export async function pushOutbox(deps: {
  db: SqlDatabase;
  supabase: TypedSupabaseClient;
  now?(): number;
}): Promise<PushResult> {
  const nowMs = deps.now ? deps.now() : Date.now();

  const pendingEntries = await loadPendingOutboxEntries(deps.db);
  const pendingByKey = new Map<string, OutboxEntry[]>();
  for (const entry of pendingEntries) {
    const key = `${entry.entity}:${entry.entity_id}`;
    const entriesForKey = pendingByKey.get(key) ?? [];
    entriesForKey.push(entry);
    pendingByKey.set(key, entriesForKey);
  }

  const blockedByBackoff = new Set<string>();
  const dueEntries = pendingEntries.filter((entry) => entry.next_attempt_at <= nowMs);
  for (const entry of dueEntries) {
    const key = `${entry.entity}:${entry.entity_id}`;
    const earlierPending = pendingByKey
      .get(key)
      ?.some((candidate) => candidate.id < entry.id && candidate.next_attempt_at > nowMs);
    if (earlierPending) blockedByBackoff.add(key);
  }

  const entries = dueEntries.filter(
    (entry) => !blockedByBackoff.has(`${entry.entity}:${entry.entity_id}`),
  );
  const { pushes, discardable } = coalesce(entries);

  const outcomes: PushOutcome[] = [];

  if (discardable.length > 0) {
    await deleteOutboxEntries(deps.db, discardable);
    outcomes.push({ kind: 'discarded', sourceIds: discardable });
  }

  const attemptsById = new Map(entries.map((e) => [e.id, e.attempts]));

  // Artikel, deren vorherige Operation im laufenden Batch bereits gescheitert
  // ist. Nachfolgende Operationen desselben Artikels beruhen moeglicherweise
  // auf der abgelehnten Operation und werden zurueckgehalten (bleiben in der
  // Outbox, greifen erst im naechsten Durchlauf) — unabhaengige Artikel laufen
  // unbeeinflusst weiter.
  const blockedItemIds = new Set<string>();

  let stoppedEarly = false;
  for (const push of pushes) {
    const itemIds = fridgeItemIdsReferencedBy(push);
    if (itemIds.some((itemId) => blockedItemIds.has(itemId))) continue;

    if (push.entity === 'transactions') {
      let hasPendingDependency = false;
      for (const itemId of itemIds) {
        if (await hasPendingFridgeItemInsert(deps.db, itemId)) {
          hasPendingDependency = true;
          break;
        }
      }
      if (hasPendingDependency) continue;
    }

    const currentAttempts = Math.max(0, ...push.sourceIds.map((id) => attemptsById.get(id) ?? 0));
    const { outcome, stop } = await applyOnePush(
      deps.db,
      deps.supabase,
      push,
      nowMs,
      currentAttempts,
    );
    outcomes.push(outcome);

    if (outcome.kind === 'failed-permanent' || outcome.kind === 'failed-transient') {
      for (const itemId of itemIds) blockedItemIds.add(itemId);
    }

    if (stop) {
      stoppedEarly = true;
      break;
    }
  }

  return { outcomes, stoppedEarly };
}
