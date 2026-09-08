// Inventory-spezifischer Push-Abschluss, extrahiert aus push.ts (fam-lem.26):
// die vier fachlichen Inventory-Operationen (Menge, Move, Split, Merge-Undo)
// teilen sich Fehlerklassifikation, Backoff und lokalen Bestaetigungsablauf
// ueber completeInventoryPush(). Fachliche Parser und konkrete RPC-Aufrufe
// bleiben je Operation explizit.
import { deleteOutboxEntries, recordOutboxOutcome } from '@/lib/db/outbox';
import type { Entity, SqlDatabase } from '@/lib/db/types';
import type { TypedSupabaseClient } from '@/lib/supabase';
import { backoffDelayMs, classifyError, MAX_ATTEMPTS } from '@/lib/sync/backoff';
import type { CoalescedEntry } from '@/lib/sync/coalesce';
import {
  parseInventoryMergeUndoPayload,
  parseInventoryMovePayload,
  parseInventoryQuantityCorrectionPayload,
  parseInventoryQuantityPayload,
  parseInventoryQuantityReversalPayload,
  parseInventorySplitPayload,
} from '@/lib/sync/inventory-quantity';
import { applyRemoteRow, type RemoteRow, upsertMirrorRow } from '@/lib/sync/mirror-write';
import type { AttemptResult, PushOutcome } from '@/lib/sync/push';

/** Prueft, ob ein Artikel noch eine offene, unbestaetigte Outbox-Operation hat. */
export async function hasPendingMutation(
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
  // Anders als move_fridge_item und split_fridge_item_open hat dieser RPC
  // keine nullbaren Argumente — der generierte Vertrag passt direkt, ohne
  // die Typumgehung, die die beiden anderen weiterhin brauchen.
  const rpcResponse = await supabase.rpc('merge_undo_fridge_item_open', {
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
      kind: 'transient',
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
    kind: 'permanent',
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

/**
 * Lehnt einen Outbox-Eintrag dauerhaft ab, wenn seine Entity nicht zur
 * Fachoperation passt. `null` bedeutet: Entity stimmt, weitermachen.
 */
async function requireFridgeItemsEntity(
  db: SqlDatabase,
  entry: CoalescedEntry,
  nowMs: number,
  currentAttempts: number,
  operationLabel: string,
): Promise<{ outcome: PushOutcome; stop: boolean } | null> {
  if (entry.entity === 'fridge_items') return null;
  const message = `Eine ${operationLabel} ist nur fuer fridge_items zulaessig.`;
  return recordInventoryPushFailure(db, entry, message, 'permanent', nowMs, currentAttempts);
}

/**
 * Parst den Outbox-Payload einer Fachoperation oder meldet einen dauerhaften
 * Fehler. Ein ungueltiger Payload ist kein Retry-Kandidat.
 */
async function parseInventoryPushPayload<T>(
  db: SqlDatabase,
  entry: CoalescedEntry,
  nowMs: number,
  currentAttempts: number,
  parse: () => T,
): Promise<{ payload: T } | { failure: { outcome: PushOutcome; stop: boolean } }> {
  try {
    return { payload: parse() };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const failure = await recordInventoryPushFailure(
      db,
      entry,
      message,
      'permanent',
      nowMs,
      currentAttempts,
    );
    return { failure };
  }
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

export async function applyInventoryQuantityPush(
  db: SqlDatabase,
  supabase: TypedSupabaseClient,
  entry: CoalescedEntry,
  nowMs: number,
  currentAttempts: number,
): Promise<{ outcome: PushOutcome; stop: boolean }> {
  const parsed = await parseInventoryPushPayload(db, entry, nowMs, currentAttempts, () =>
    parseInventoryQuantityOperation(entry),
  );
  if ('failure' in parsed) return parsed.failure;
  const operation = parsed.payload;

  const entityGuard = await requireFridgeItemsEntity(
    db,
    entry,
    nowMs,
    currentAttempts,
    'Mengenänderung',
  );
  if (entityGuard) return entityGuard;

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

export async function applyInventoryMovePush(
  db: SqlDatabase,
  supabase: TypedSupabaseClient,
  entry: CoalescedEntry,
  nowMs: number,
  currentAttempts: number,
): Promise<{ outcome: PushOutcome; stop: boolean }> {
  const entityGuard = await requireFridgeItemsEntity(
    db,
    entry,
    nowMs,
    currentAttempts,
    'Move-Operation',
  );
  if (entityGuard) return entityGuard;

  const parsed = await parseInventoryPushPayload(db, entry, nowMs, currentAttempts, () =>
    parseInventoryMovePayload(entry.payload),
  );
  if ('failure' in parsed) return parsed.failure;
  const move = parsed.payload;

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

export async function applyInventorySplitPush(
  db: SqlDatabase,
  supabase: TypedSupabaseClient,
  entry: CoalescedEntry,
  nowMs: number,
  currentAttempts: number,
): Promise<{ outcome: PushOutcome; stop: boolean }> {
  const entityGuard = await requireFridgeItemsEntity(
    db,
    entry,
    nowMs,
    currentAttempts,
    'Split-Operation',
  );
  if (entityGuard) return entityGuard;

  const parsed = await parseInventoryPushPayload(db, entry, nowMs, currentAttempts, () =>
    parseInventorySplitPayload(entry.payload),
  );
  if ('failure' in parsed) return parsed.failure;
  const split = parsed.payload;

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

export async function applyInventoryMergeUndoPush(
  db: SqlDatabase,
  supabase: TypedSupabaseClient,
  entry: CoalescedEntry,
  nowMs: number,
  currentAttempts: number,
): Promise<{ outcome: PushOutcome; stop: boolean }> {
  const entityGuard = await requireFridgeItemsEntity(
    db,
    entry,
    nowMs,
    currentAttempts,
    'Merge-Undo-Operation',
  );
  if (entityGuard) return entityGuard;

  const parsed = await parseInventoryPushPayload(db, entry, nowMs, currentAttempts, () =>
    parseInventoryMergeUndoPayload(entry.payload),
  );
  if ('failure' in parsed) return parsed.failure;
  const mergeUndo = parsed.payload;

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
