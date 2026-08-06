import { metaOf } from '@/lib/db/entities';
import { deleteOutboxEntries, loadDueOutboxEntries, recordOutboxOutcome } from '@/lib/db/outbox';
import type { Entity, SqlDatabase } from '@/lib/db/types';
import type { TypedSupabaseClient } from '@/lib/supabase';
import { backoffDelayMs, classifyError, MAX_ATTEMPTS } from '@/lib/sync/backoff';
import { type CoalescedEntry, coalesce } from '@/lib/sync/coalesce';
import { upsertMirrorRow } from '@/lib/sync/mirror-write';

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
  return Object.fromEntries(Object.entries(payload).filter(([key]) => !SYNC_COLUMNS.has(key)));
}

/** update-Payload: geaenderte Felder minus Sync-Spalten und id (id geht in .eq()). */
function buildUpdatePayload(payload: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(payload).filter(([key]) => !SYNC_COLUMNS.has(key) && key !== 'id'),
  );
}

type AttemptResult = {
  data: Record<string, unknown>[] | null;
  error: { message: string; code?: string } | null;
  status: number;
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
  op: 'insert' | 'update' | 'delete',
  entityId: string,
  payload: Record<string, unknown>,
  nowMs: number,
): Promise<AttemptResult> {
  // biome-ignore lint/suspicious/noExplicitAny: generische Tabelle, siehe Kommentar oben
  const query = supabase.from(table) as any;

  if (op === 'insert') {
    const response = await query.insert(buildInsertPayload(payload)).select();
    return response as AttemptResult;
  }

  if (op === 'delete') {
    const response = await query
      .update({ deleted_at: new Date(nowMs).toISOString() })
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

  // products hat kein deleted_at serverseitig — ein delete waere ein
  // Soft-Delete-Versuch gegen eine nicht existente Spalte. Kein Netzwerkaufruf.
  if (entry.op === 'delete' && !meta.hasServerTombstone) {
    const message = `${entry.entity} unterstuetzt kein Loeschen (kein Server-Tombstone).`;
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
    response = await attempt(supabase, meta.table, 'update', entry.entityId, entry.payload, nowMs);
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
