import { type EntityMeta, metaOf } from '@/lib/db/entities';
import {
  deleteOutboxEntries,
  loadPendingOutboxEntries,
  recordOutboxOutcome,
} from '@/lib/db/outbox';
import type { Entity, OutboxEntry, SqlDatabase } from '@/lib/db/types';
import type { TypedSupabaseClient } from '@/lib/supabase';
import { backoffDelayMs, classifyError, MAX_ATTEMPTS } from '@/lib/sync/backoff';
import { type CoalescedEntry, coalesce } from '@/lib/sync/coalesce';
import {
  applyInventoryMergeUndoPush,
  applyInventoryMovePush,
  applyInventoryQuantityPush,
  applyInventorySplitPush,
  hasPendingMutation,
} from '@/lib/sync/inventory-push';
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

/** Server-Payload ohne die lokalen Sync-Spalten, optional ohne `id`. */
function buildServerPayload(
  payload: Record<string, unknown>,
  columns: readonly string[],
  normalizeQuantityUnits: boolean,
  includeId: boolean,
): Record<string, unknown> {
  const serverColumns = new Set(columns);
  const result = Object.fromEntries(
    Object.entries(payload).filter(
      ([key]) => !SYNC_COLUMNS.has(key) && (includeId || key !== 'id') && serverColumns.has(key),
    ),
  );
  if (normalizeQuantityUnits && 'unit' in result) {
    result.unit = normalizeUnit(typeof result.unit === 'string' ? result.unit : undefined);
  }
  return result;
}

/** Insert-Payload: Server-Spalten ohne die lokalen Sync-Spalten. */
function buildInsertPayload(
  payload: Record<string, unknown>,
  columns: readonly string[],
  normalizeQuantityUnits: boolean,
): Record<string, unknown> {
  return buildServerPayload(payload, columns, normalizeQuantityUnits, true);
}

/** Update-Payload: geaenderte Server-Felder ohne Sync-Spalten und id. */
function buildUpdatePayload(
  payload: Record<string, unknown>,
  columns: readonly string[],
  normalizeQuantityUnits: boolean,
): Record<string, unknown> {
  return buildServerPayload(payload, columns, normalizeQuantityUnits, false);
}

export type AttemptResult = {
  data: Record<string, unknown>[] | null;
  error: { message: string; code?: string } | null;
  status: number;
};

/** Alle Artikel mit noch offenem `insert`, in einer Abfrage statt einer pro Artikel. */
async function loadPendingFridgeItemInsertIds(db: SqlDatabase): Promise<Set<string>> {
  const rows = await db.getAllAsync<{ entity_id: string }>(
    `select distinct entity_id
       from outbox
      where entity = 'fridge_items'
        and op = 'insert'`,
  );
  return new Set(rows.map((row) => row.entity_id));
}

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

/** Markiert einen Outbox-Eintrag als permanent gescheitert ohne weiteren Netzwerk-I/O. */
async function rejectPermanent(
  db: SqlDatabase,
  entry: CoalescedEntry,
  message: string,
): Promise<{ outcome: PushOutcome; stop: boolean }> {
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

type DuplicateInsertResolution =
  | { outcome: 'confirmed'; result: { outcome: PushOutcome; stop: boolean } }
  | { outcome: 'continue'; response: AttemptResult };

/**
 * Netzwerkaufruf erfolgreich, aber der lokale Commit (Outbox loeschen +
 * Server-Zeile upserten) kam vorher nicht mehr zustande: ein insert mit
 * derselben id verletzt den PK und liefert 23505/409. Die Zeile ist laengst
 * sicher auf dem Server — ein update mit demselben Inhalt ist idempotent.
 */
async function resolveDuplicateInsert(
  db: SqlDatabase,
  supabase: TypedSupabaseClient,
  meta: EntityMeta,
  entry: CoalescedEntry,
  nowMs: number,
  response: AttemptResult,
): Promise<DuplicateInsertResolution> {
  if (meta.appendOnly) {
    const verification = await verifyAppendOnlyDuplicate(
      supabase,
      meta.table,
      entry.entityId,
      entry.payload,
    );
    if (!verification.matches) {
      return {
        outcome: 'continue',
        response: {
          data: null,
          error: {
            code: 'append_only_duplicate_mismatch',
            message: `Vorhandene ${entry.entity}-Zeile passt nicht zum Retry: ${verification.error ?? 'unbekannter Konflikt'}`,
          },
          status: 409,
        },
      };
    }

    await db.withExclusiveTransactionAsync(async (txn) => {
      await deleteOutboxEntries(txn, entry.sourceIds);
      await txn.runAsync(`update ${meta.table} set _dirty = 0 where id = ?`, [entry.entityId]);
    });
    return {
      outcome: 'confirmed',
      result: {
        outcome: {
          kind: 'pushed',
          entity: entry.entity,
          entityId: entry.entityId,
          sourceIds: entry.sourceIds,
        },
        stop: false,
      },
    };
  }

  // Clientseitige IDs sind der Idempotenzschlüssel. Der Server hat das Event
  // bereits akzeptiert, also ist ein Retry derselben INSERT-Operation ein
  // erfolgreicher Abschluss und kein Anlass fuer ein UPDATE.
  if (meta.pushOnly) {
    return { outcome: 'continue', response: { data: null, error: null, status: response.status } };
  }

  const updated = await attempt(
    supabase,
    meta.table,
    'update',
    entry.entityId,
    entry.payload,
    nowMs,
  );
  return { outcome: 'continue', response: updated };
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
    return rejectPermanent(
      db,
      entry,
      `${entry.entity} ist append-only und akzeptiert ausschliesslich insert.`,
    );
  }

  // Feedback-Events sind ein append-only/push-only Vertrag. Jede andere Op
  // ist ein lokaler Programmierfehler und wird garantiert vor `attempt()`
  // abgewiesen, also ohne SELECT, UPDATE, DELETE oder sonstigen Netzwerk-I/O.
  if (meta.pushOnly && entry.op !== 'insert') {
    return rejectPermanent(
      db,
      entry,
      `${entry.entity} ist push-only und akzeptiert ausschliesslich insert.`,
    );
  }

  // products hat kein deleted_at serverseitig — ein delete/restore waere ein
  // Soft-Delete-Versuch gegen eine nicht existente Spalte. Kein Netzwerkaufruf.
  if ((entry.op === 'delete' || entry.op === 'restore') && !meta.hasServerTombstone) {
    return rejectPermanent(
      db,
      entry,
      `${entry.entity} unterstuetzt kein Loeschen/Wiederherstellen (kein Server-Tombstone).`,
    );
  }

  let response = await attempt(
    supabase,
    meta.table,
    entry.op,
    entry.entityId,
    entry.payload,
    nowMs,
  );

  if (entry.op === 'insert' && response.error?.code === '23505') {
    const resolution = await resolveDuplicateInsert(db, supabase, meta, entry, nowMs, response);
    if (resolution.outcome === 'confirmed') return resolution.result;
    response = resolution.response;
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
        kind: 'transient',
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
    return rejectPermanent(db, entry, 'Zeile nicht gefunden oder keine Berechtigung (RLS).');
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
    if (push.op === 'split_open' || push.op === 'merge_undo_open') {
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

  // Einmal vorab geladen statt einer Abfrage pro betroffenem Artikel je
  // transactions-Push weiter unten.
  const pendingFridgeItemInsertIds = await loadPendingFridgeItemInsertIds(deps.db);

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

    if (
      push.entity === 'transactions' &&
      itemIds.some((itemId) => pendingFridgeItemInsertIds.has(itemId))
    ) {
      continue;
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
