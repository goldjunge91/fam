import { metaOf } from '@/lib/db/entities';
import {
  deleteOutboxEntries,
  loadDueOutboxEntries,
  parseOutboxEntry,
  recordOutboxOutcome,
} from '@/lib/db/outbox';
import type { Entity, SqlDatabase } from '@/lib/db/types';
import type { TypedSupabaseClient } from '@/lib/supabase';
import { backoffDelayMs, classifyError, MAX_ATTEMPTS } from '@/lib/sync/backoff';
import { type CoalescedEntry, coalesce } from '@/lib/sync/coalesce';
import {
  type InventoryOperationEnvelope,
  readInventoryOperationEnvelope,
} from '@/lib/sync/inventory-quantity';
import { upsertMirrorRow } from '@/lib/sync/mirror-write';
import {
  notifyInventoryConflict,
  parseInventoryConflict,
} from '@/lib/sync/resolve-inventory-conflict';
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

export type InventoryPushOutcome =
  | { kind: 'conflict'; operation_id: string; code: string; sourceIds: number[] }
  | { kind: 'pushed'; operation_id: string; sourceIds: number[] };

export type PushResult = {
  outcomes: Array<PushOutcome | InventoryPushOutcome>;
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

type InventoryPushGroup = {
  envelope: InventoryOperationEnvelope;
  entries: Array<{
    entity: Entity;
    entityId: string;
    sourceId: number;
  }>;
  sequence: number;
};

type InventoryRpcResponse = {
  kind: 'applied' | 'replayed' | 'conflict' | 'invalid';
  operation_id?: string;
  code?: string;
  lots?: unknown;
  transactions?: unknown;
};

function isInventoryPayload(payload: Record<string, unknown>): boolean {
  return 'inventory_operation' in payload;
}

function collectInventoryPushGroups(entries: readonly import('@/lib/db/types').OutboxEntry[]): {
  groups: InventoryPushGroup[];
  genericEntries: import('@/lib/db/types').OutboxEntry[];
  invalidEntries: import('@/lib/db/types').OutboxEntry[];
} {
  const grouped = new Map<string, InventoryPushGroup>();
  const genericEntries: import('@/lib/db/types').OutboxEntry[] = [];
  const invalidEntries: import('@/lib/db/types').OutboxEntry[] = [];

  for (const entry of entries) {
    const payload = parseOutboxEntry(entry);
    if (!isInventoryPayload(payload)) {
      genericEntries.push(entry);
      continue;
    }
    const envelope = readInventoryOperationEnvelope(entry);
    if (!envelope) {
      invalidEntries.push(entry);
      continue;
    }
    const existing = grouped.get(envelope.operation_id);
    if (existing) {
      existing.entries.push({
        entity: entry.entity,
        entityId: entry.entity_id,
        sourceId: entry.id,
      });
      continue;
    }
    grouped.set(envelope.operation_id, {
      envelope,
      entries: [{ entity: entry.entity, entityId: entry.entity_id, sourceId: entry.id }],
      sequence: entry.id,
    });
  }

  return {
    groups: [...grouped.values()].sort((left, right) => left.sequence - right.sequence),
    genericEntries,
    invalidEntries,
  };
}

function inventoryResponse(value: unknown): InventoryRpcResponse | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  const response = value as {
    kind?: unknown;
    operation_id?: unknown;
    code?: unknown;
    lots?: unknown;
    transactions?: unknown;
  };
  if (
    (response.kind !== 'applied' &&
      response.kind !== 'replayed' &&
      response.kind !== 'conflict' &&
      response.kind !== 'invalid') ||
    (response.operation_id !== undefined && typeof response.operation_id !== 'string') ||
    (response.code !== undefined && typeof response.code !== 'string')
  )
    return null;
  return {
    kind: response.kind,
    operation_id: response.operation_id,
    code: response.code,
    lots: response.lots,
    transactions: response.transactions,
  };
}

function rowsOf(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value)
    ? value.filter(
        (row): row is Record<string, unknown> =>
          typeof row === 'object' && row !== null && !Array.isArray(row),
      )
    : [];
}

async function pushInventoryOperation(
  db: SqlDatabase,
  supabase: TypedSupabaseClient,
  group: InventoryPushGroup,
  nowMs: number,
  currentAttempts: number,
): Promise<{ outcome: PushOutcome | InventoryPushOutcome; stop: boolean }> {
  const sourceIds = group.entries.map((entry) => entry.sourceId);
  const response = await supabase.rpc('apply_inventory_operation', {
    p_operation: group.envelope.request,
  });
  if (response.error) {
    const status = response.error.code === 'PGRST' ? 400 : 0;
    const kind = classifyError(status === 0 ? null : status);
    const nextAttempts = currentAttempts + 1;
    await recordOutboxOutcome(db, sourceIds, {
      attempts: nextAttempts,
      lastError: response.error.message,
      nextAttemptAtMs:
        kind === 'transient' && nextAttempts < MAX_ATTEMPTS
          ? nowMs + backoffDelayMs(currentAttempts)
          : Number.MAX_SAFE_INTEGER,
    });
    return {
      outcome: {
        kind: 'failed-transient',
        entity: 'fridge_items',
        entityId:
          group.envelope.request.type === 'insert_inventory'
            ? group.envelope.request.item_id
            : group.envelope.request.type === 'consume_inventory'
              ? group.envelope.request.source_item_id
              : group.envelope.request.type === 'waste_inventory' ||
                  group.envelope.request.type === 'correct_quantity'
                ? group.envelope.request.item_id
                : group.envelope.request.item_id,
        sourceIds,
        error: response.error.message,
      },
      stop: kind === 'transient',
    };
  }

  const result = inventoryResponse(response.data);
  if (!result) {
    const error = 'Inventory-RPC lieferte eine ungueltige Antwort.';
    await recordOutboxOutcome(db, sourceIds, {
      attempts: MAX_ATTEMPTS,
      lastError: error,
      nextAttemptAtMs: Number.MAX_SAFE_INTEGER,
    });
    return {
      outcome: {
        kind: 'failed-permanent',
        entity: 'fridge_items',
        entityId:
          group.envelope.request.type === 'insert_inventory'
            ? group.envelope.request.item_id
            : group.envelope.request.type === 'consume_inventory'
              ? group.envelope.request.source_item_id
              : group.envelope.request.item_id,
        sourceIds,
        error,
      },
      stop: false,
    };
  }

  const conflict = parseInventoryConflict(result);
  if (conflict) {
    notifyInventoryConflict(conflict);
    await recordOutboxOutcome(db, sourceIds, {
      attempts: MAX_ATTEMPTS,
      lastError: conflict.code,
      nextAttemptAtMs: Number.MAX_SAFE_INTEGER,
    });
    return {
      outcome: {
        kind: 'conflict',
        operation_id: conflict.operation_id,
        code: conflict.code,
        sourceIds,
      },
      stop: true,
    };
  }
  if (result.kind === 'invalid') {
    const error = result.code ?? 'PAYLOAD_VALIDATION_FAILED';
    await recordOutboxOutcome(db, sourceIds, {
      attempts: MAX_ATTEMPTS,
      lastError: error,
      nextAttemptAtMs: Number.MAX_SAFE_INTEGER,
    });
    return {
      outcome: {
        kind: 'failed-permanent',
        entity: 'fridge_items',
        entityId:
          group.envelope.request.type === 'insert_inventory'
            ? group.envelope.request.item_id
            : group.envelope.request.type === 'consume_inventory'
              ? group.envelope.request.source_item_id
              : group.envelope.request.item_id,
        sourceIds,
        error,
      },
      stop: false,
    };
  }

  const remoteLots = rowsOf(result.lots);
  const remoteTransactions = rowsOf(result.transactions);
  await db.withExclusiveTransactionAsync(async (txn) => {
    await deleteOutboxEntries(txn, sourceIds);
    for (const row of remoteLots) await upsertMirrorRow(txn, 'fridge_items', row, { dirty: 0 });
    for (const row of remoteTransactions)
      await upsertMirrorRow(txn, 'transactions', row, { dirty: 0 });
    if (remoteLots.length === 0 && remoteTransactions.length === 0) {
      for (const entry of group.entries) {
        await txn.runAsync(`update ${entry.entity} set _dirty = 0 where id = ?`, [entry.entityId]);
      }
    }
  });
  return {
    outcome: { kind: 'pushed', operation_id: group.envelope.operation_id, sourceIds },
    stop: false,
  };
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
      .update({ deleted_at: new Date(nowMs).toISOString() })
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

/** Wendet einen einzelnen gecoalescten Push an. Gibt das Ergebnis und zurueck, ob die Schleife stoppen muss. */
async function applyOnePush(
  db: SqlDatabase,
  supabase: TypedSupabaseClient,
  entry: CoalescedEntry,
  nowMs: number,
  currentAttempts: number,
): Promise<{ outcome: PushOutcome; stop: boolean }> {
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
    await upsertMirrorRow(txn, entry.entity, returnedRow, { dirty: 0 });
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

  const entries = await loadDueOutboxEntries(deps.db, nowMs);
  const {
    groups: inventoryGroups,
    genericEntries,
    invalidEntries,
  } = collectInventoryPushGroups(entries);
  const { pushes, discardable } = coalesce(genericEntries);

  const outcomes: Array<PushOutcome | InventoryPushOutcome> = [];

  if (discardable.length > 0) {
    await deleteOutboxEntries(deps.db, discardable);
    outcomes.push({ kind: 'discarded', sourceIds: discardable });
  }

  if (invalidEntries.length > 0) {
    const invalidIds = invalidEntries.map((entry) => entry.id);
    const message = 'Inventory-Outbox-Eintrag ist kein gueltiger Phase-1-Request.';
    await recordOutboxOutcome(deps.db, invalidIds, {
      attempts: MAX_ATTEMPTS,
      lastError: message,
      nextAttemptAtMs: Number.MAX_SAFE_INTEGER,
    });
    for (const entry of invalidEntries) {
      outcomes.push({
        kind: 'failed-permanent',
        entity: entry.entity,
        entityId: entry.entity_id,
        sourceIds: [entry.id],
        error: message,
      });
    }
  }

  const attemptsById = new Map(entries.map((e) => [e.id, e.attempts]));

  let stoppedEarly = false;
  const queue: Array<
    { kind: 'generic'; push: CoalescedEntry } | { kind: 'inventory'; group: InventoryPushGroup }
  > = [
    ...pushes.map((push) => ({ kind: 'generic' as const, push })),
    ...inventoryGroups.map((group) => ({ kind: 'inventory' as const, group })),
  ].sort(
    (left, right) =>
      (left.kind === 'generic' ? left.push.sequence : left.group.sequence) -
      (right.kind === 'generic' ? right.push.sequence : right.group.sequence),
  );

  for (const item of queue) {
    if (item.kind === 'inventory') {
      const currentAttempts = Math.max(
        0,
        ...item.group.entries.map((entry) => attemptsById.get(entry.sourceId) ?? 0),
      );
      const { outcome, stop } = await pushInventoryOperation(
        deps.db,
        deps.supabase,
        item.group,
        nowMs,
        currentAttempts,
      );
      outcomes.push(outcome);
      if (stop) {
        stoppedEarly = true;
        break;
      }
      continue;
    }

    const push = item.push;
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
