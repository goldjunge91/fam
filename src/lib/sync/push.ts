import { metaOf } from '@/lib/db/entities';
import { deleteOutboxEntries, loadDueOutboxEntries, recordOutboxOutcome } from '@/lib/db/outbox';
import type { Entity, SqlDatabase } from '@/lib/db/types';
import type { TypedSupabaseClient } from '@/lib/supabase';
import { backoffDelayMs, classifyError, MAX_ATTEMPTS } from '@/lib/sync/backoff';
import { type CoalescedEntry, coalesce } from '@/lib/sync/coalesce';
import { upsertMirrorRow } from '@/lib/sync/mirror-write';
import { normalizeUnit } from '@/lib/units';

/**
 * Push-Haelfte der Sync-Engine (#47).
 *
 * Arbeitet die Outbox in Erstellungsreihenfolge ab (`coalesce()` reduziert
 * vorher), wendet bei Erfolg die Server-Antwortzeile lokal an und klassifiziert
 * Fehler ueber `backoff.ts`. Kein Aufruf von `resolve()` — Postgres hat kein
 * Compare-and-Swap auf `updated_at`, jeder Push wird angenommen und bekommt
 * einen neuen, autoritativen Zeitstempel.
 */

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

/** insert-Payload: volle Zeile minus Sync-Spalten. id und created_at bleiben. */
function buildInsertPayload(payload: Record<string, unknown>): Record<string, unknown> {
  const result = Object.fromEntries(
    Object.entries(payload).filter(([key]) => !SYNC_COLUMNS.has(key)),
  );
  if ('unit' in result) {
    result.unit = normalizeUnit(typeof result.unit === 'string' ? result.unit : undefined);
  }
  return result;
}

/** update-Payload: geaenderte Felder minus Sync-Spalten und id (id geht in .eq()). */
function buildUpdatePayload(payload: Record<string, unknown>): Record<string, unknown> {
  const result = Object.fromEntries(
    Object.entries(payload).filter(([key]) => !SYNC_COLUMNS.has(key) && key !== 'id'),
  );
  if ('unit' in result) {
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

/**
 * `Database`s generierte Typen binden `.from()`/`.insert()`/`.update()` an die
 * konkrete Tabelle — richtig fuer handgeschriebenen Feature-Code, aber diese
 * Funktion ist bewusst entity-uebergreifend generisch (dieselbe Logik fuer
 * alle vier Spiegeltabellen). Eine vollstaendig typsichere Version bruechte
 * eine Funktion pro Tabelle und wuerde den Zweck der generischen Push-Engine
 * unterlaufen. Die Korrektheit sichert stattdessen `entities.ts` (Tabellen-
 * und Spaltennamen kommen aus einer einzigen, gegen das echte Schema
 * getesteten Quelle — siehe `entities.integration.test.ts`), nicht der
 * Typchecker an dieser einen Stelle.
 */
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

  if (op === 'insert') {
    const response = metaOf(table).pushOnly
      ? await query.insert(buildInsertPayload(payload))
      : await query.insert(buildInsertPayload(payload)).select();
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
      .update({ ...buildUpdatePayload(payload), deleted_at: null })
      .eq('id', entityId)
      .select();
    return response as AttemptResult;
  }

  const response = await query.update(buildUpdatePayload(payload)).eq('id', entityId).select();
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
    if (meta.pushOnly) {
      // Clientseitige event_id ist der Idempotenzschlüssel. Der Server hat das
      // Event bereits akzeptiert, also ist ein Retry derselben INSERT-Operation
      // ein erfolgreicher Abschluss und kein Anlass fuer ein UPDATE.
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
