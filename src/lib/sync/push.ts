import { metaOf } from '@/lib/db/entities';
import { deleteOutboxEntries, loadDueOutboxEntries, recordOutboxOutcome } from '@/lib/db/outbox';
import type { Entity, SqlDatabase } from '@/lib/db/types';
import type { TypedSupabaseClient } from '@/lib/supabase';
import { backoffDelayMs, classifyError, MAX_ATTEMPTS } from '@/lib/sync/backoff';
import { type CoalescedEntry, coalesce } from '@/lib/sync/coalesce';
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

function buildInsertPayload(payload: Record<string, unknown>): Record<string, unknown> {
  const result = Object.fromEntries(
    Object.entries(payload).filter(([key]) => !SYNC_COLUMNS.has(key)),
  );
  if ('unit' in result) {
    result.unit = normalizeUnit(typeof result.unit === 'string' ? result.unit : undefined);
  }
  return result;
}

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

async function attempt(
  supabase: TypedSupabaseClient,
  table: Entity,
  op: 'insert' | 'update' | 'delete' | 'restore',
  entityId: string,
  payload: Record<string, unknown>,
  nowMs: number,
): Promise<AttemptResult> {
  // biome-ignore lint/suspicious/noExplicitAny: entity-uebergreifender Tabellenzugriff
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

  if (op === 'restore') {
    // Ein Restore kann nachfolgend gemergte Update-Felder enthalten.
    const response = await query
      .update({ ...buildUpdatePayload(payload), deleted_at: null })
      .eq('id', entityId)
      .select();
    return response as AttemptResult;
  }

  const response = await query.update(buildUpdatePayload(payload)).eq('id', entityId).select();
  return response as AttemptResult;
}

async function applyOnePush(
  db: SqlDatabase,
  supabase: TypedSupabaseClient,
  entry: CoalescedEntry,
  nowMs: number,
  currentAttempts: number,
): Promise<{ outcome: PushOutcome; stop: boolean }> {
  const meta = metaOf(entry.entity);

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

  // Ein vorher erfolgreicher Insert kann nach lokalem Commit-Abbruch bereits existieren.
  if (entry.op === 'insert' && response.error?.code === '23505') {
    response = await attempt(supabase, meta.table, 'update', entry.entityId, entry.payload, nowMs);
  }

  // Fehlende Lagerorte zuerst pushen oder die Referenz entfernen.
  if (
    response.error &&
    (response.error.code === '23503' || response.error.message?.includes('location_id_fkey')) &&
    entry.entity === 'fridge_items' &&
    entry.payload.location_id
  ) {
    const locId = String(entry.payload.location_id);
    const loc = await db.getFirstAsync<Record<string, unknown>>(
      'select * from storage_locations where id = ?',
      [locId],
    );

    if (loc) {
      // biome-ignore lint/suspicious/noExplicitAny: generisches Insert
      await (supabase.from('storage_locations') as any).insert(buildInsertPayload(loc)).select();
      response = await attempt(
        supabase,
        meta.table,
        entry.op,
        entry.entityId,
        entry.payload,
        nowMs,
      );
    } else {
      const fallbackPayload = { ...entry.payload, location_id: null };
      response = await attempt(
        supabase,
        meta.table,
        entry.op,
        entry.entityId,
        fallbackPayload,
        nowMs,
      );
    }
  }

  if (response.error) {
    const rawStatus = response.status;
    // PostgREST kodiert Netzwerkfehler als Status 0.
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
        // Abbruch bewahrt bei Netzfehlern die Erstellungsreihenfolge.
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

  // RLS kann Updates ohne Fehler auf null betroffene Zeilen filtern.
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
