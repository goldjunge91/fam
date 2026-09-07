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
import { parseInventoryQuantityPayload } from '@/lib/sync/inventory-quantity';
import { upsertMirrorRow } from '@/lib/sync/mirror-write';
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

type QuantityRpcArgs = {
  p_operation_id: string;
  p_transaction_id: string;
  p_item_id: string;
  p_household_id: string;
  p_delta: number;
  p_created_at: string;
};

type QuantityRpc = (
  functionName: 'adjust_fridge_item_quantity',
  args: QuantityRpcArgs,
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
  entry: CoalescedEntry,
): Promise<AttemptResult> {
  let move: ReturnType<typeof parseInventoryMovePayload>;
  try {
    move = parseInventoryMovePayload(entry.payload);
  } catch (error) {
    return {
      data: null,
      error: {
        code: 'move_payload_invalid',
        message: error instanceof Error ? error.message : String(error),
      },
      status: 400,
    };
  }

  if (move.item_id !== entry.entityId) {
    return {
      data: null,
      error: {
        code: 'move_payload_invalid',
        message: 'Move-Payload und Outbox-Entity zeigen auf unterschiedliche Bestände.',
      },
      status: 400,
    };
  }

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

async function attemptInventoryQuantity(
  supabase: TypedSupabaseClient,
  entry: CoalescedEntry,
): Promise<AttemptResult> {
  let adjustment: ReturnType<typeof parseInventoryQuantityPayload>;
  try {
    adjustment = parseInventoryQuantityPayload(entry.payload);
  } catch (error) {
    return {
      data: null,
      error: {
        code: 'quantity_payload_invalid',
        message: error instanceof Error ? error.message : String(error),
      },
      status: 400,
    };
  }

  if (adjustment.item_id !== entry.entityId) {
    return {
      data: null,
      error: {
        code: 'quantity_payload_invalid',
        message: 'Mengen-Payload und Outbox-Entity zeigen auf unterschiedliche Bestände.',
      },
      status: 400,
    };
  }

  const quantityRpc = supabase.rpc.bind(supabase) as unknown as QuantityRpc;
  const rpcResponse = await quantityRpc('adjust_fridge_item_quantity', {
    p_operation_id: adjustment.operation_id,
    p_transaction_id: adjustment.transaction_id,
    p_item_id: adjustment.item_id,
    p_household_id: adjustment.household_id,
    p_delta: adjustment.delta,
    p_created_at: adjustment.created_at,
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
    .eq('id', adjustment.item_id)
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

async function applyInventoryQuantityPush(
  db: SqlDatabase,
  supabase: TypedSupabaseClient,
  entry: CoalescedEntry,
  nowMs: number,
  currentAttempts: number,
): Promise<{ outcome: PushOutcome; stop: boolean }> {
  let adjustment: ReturnType<typeof parseInventoryQuantityPayload>;
  try {
    adjustment = parseInventoryQuantityPayload(entry.payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
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

  if (entry.entity !== 'fridge_items') {
    const message = 'Eine Mengenänderung ist nur fuer fridge_items zulaessig.';
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

  const response = await attemptInventoryQuantity(supabase, entry);
  if (response.error) {
    const status = response.status === 0 ? null : response.status;
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

  const returnedRow = response.data?.[0];
  if (returnedRow === undefined) {
    const message = 'Mengenänderung lieferte keine kanonische Bestandszeile.';
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
      await upsertMirrorRow(txn, 'fridge_items', returnedRow, { dirty: 0 });
    }
    await txn.runAsync('update transactions set _dirty = 0 where id = ?', [
      adjustment.transaction_id,
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

async function applyInventoryMovePush(
  db: SqlDatabase,
  supabase: TypedSupabaseClient,
  entry: CoalescedEntry,
  nowMs: number,
  currentAttempts: number,
): Promise<{ outcome: PushOutcome; stop: boolean }> {
  if (entry.entity !== 'fridge_items') {
    const message = 'Eine Move-Operation ist nur fuer fridge_items zulaessig.';
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

  let move: ReturnType<typeof parseInventoryMovePayload>;
  try {
    move = parseInventoryMovePayload(entry.payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
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

  const response = await attemptInventoryMove(supabase, entry);
  if (response.error) {
    const status = response.status === 0 ? null : response.status;
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

  const returnedRow = response.data?.[0];
  if (returnedRow === undefined) {
    const message = 'Move lieferte keine kanonische Bestandszeile.';
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
      await upsertMirrorRow(txn, 'fridge_items', returnedRow, { dirty: 0 });
    }
    await txn.runAsync('update transactions set _dirty = 0 where id in (?, ?)', [
      move.out_transaction_id,
      move.in_transaction_id,
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
  if (entry.op === 'adjust_quantity') {
    return applyInventoryQuantityPush(db, supabase, entry, nowMs, currentAttempts);
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
        await db.withExclusiveTransactionAsync(async (txn) => {
          await deleteOutboxEntries(txn, entry.sourceIds);
          await txn.runAsync(`update ${meta.table} set _dirty = 0 where id = ?`, [entry.entityId]);
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
      response = { data: null, error: null, status: response.status };
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

  let stoppedEarly = false;
  for (const push of pushes) {
    const currentAttempts = Math.max(0, ...push.sourceIds.map((id) => attemptsById.get(id) ?? 0));
    const { outcome, stop } = await applyOnePush(
      deps.db,
      deps.supabase,
      push,
      nowMs,
      currentAttempts,
    );
    outcomes.push(outcome);

    if (stop) {
      stoppedEarly = true;
      break;
    }
  }

  return { outcomes, stoppedEarly };
}
