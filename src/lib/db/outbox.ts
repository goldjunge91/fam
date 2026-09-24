import { metaOf } from '@/lib/db/entities';
import type { Entity, OutboxEntry, OutboxOp, SqlDatabase } from '@/lib/db/types';
import { MAX_ATTEMPTS } from '@/lib/sync/backoff';
import { addDiagnosticStep, reportError } from '@/lib/telemetry';
import { normalizeUnit } from '@/lib/units';

/** Parst `OutboxEntry.payload` (JSON-Text) in ein Objekt. Wirft bei Nicht-Objekt. */
export function parseOutboxEntry(entry: OutboxEntry): Record<string, unknown> {
  const parsed: unknown = JSON.parse(entry.payload);

  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`Outbox-Eintrag ${entry.id} hat kein Objekt als payload.`);
  }

  const rec = parsed as Record<string, unknown>;
  if (metaOf(entry.entity).normalizeQuantityUnits && typeof rec.unit === 'string') {
    rec.unit = normalizeUnit(rec.unit);
  }

  return rec;
}

export type EnqueueMutationInput = {
  entity: Entity;
  entityId: string;
  op: OutboxOp;
  /** Volle Zeile bei insert, geaenderte Felder bei update. Muss household_id enthalten (ausser bei products). */
  payload: Record<string, unknown>;
  /** Schreibt die Spiegeltabelle. Laeuft IMMER gegen das uebergebene Transaktions-Handle, nie gegen das aeussere db. */
  applyLocally: (txn: SqlDatabase) => Promise<void>;
  /** Injizierbare Uhr fuer Tests. Default Date.now(). */
  now?: number;
};

export type OutboxHistoryStatus = 'queued' | 'failed' | 'pushed' | 'discarded';

export type OutboxHistoryEntry = {
  id: number;
  outbox_id: number;
  entity: Entity;
  entity_id: string;
  op: OutboxOp;
  payload: string;
  created_at: number;
  status: OutboxHistoryStatus;
  attempts: number;
  last_error: string | null;
  last_error_kind: 'transient' | 'permanent' | null;
  updated_at: number;
  completed_at: number | null;
};

type OutboxChangedListener = () => void;
const outboxChangedListeners = new Set<OutboxChangedListener>();
const exclusiveQueues = new WeakMap<SqlDatabase, Promise<void>>();

export function onOutboxChanged(listener: OutboxChangedListener): () => void {
  outboxChangedListeners.add(listener);
  return () => {
    outboxChangedListeners.delete(listener);
  };
}

function notifyOutboxChanged(): void {
  for (const listener of outboxChangedListeners) listener();
}

async function runQueuedExclusive(db: SqlDatabase, task: () => Promise<void>): Promise<void> {
  const previous = exclusiveQueues.get(db) ?? Promise.resolve();
  const current = previous.then(task, task);
  const settled = current.catch(() => undefined);
  exclusiveQueues.set(db, settled);

  try {
    await current;
  } finally {
    if (exclusiveQueues.get(db) === settled) exclusiveQueues.delete(db);
  }
}

async function writeOutboxEntries(
  txn: SqlDatabase,
  inputs: readonly EnqueueMutationInput[],
): Promise<void> {
  for (const input of inputs) {
    const createdAt = input.now ?? Date.now();
    await input.applyLocally(txn);
    const result = await txn.runAsync(
      'insert into outbox (entity, entity_id, op, payload, created_at, attempts, next_attempt_at) values (?, ?, ?, ?, ?, 0, 0)',
      [input.entity, input.entityId, input.op, JSON.stringify(input.payload), createdAt],
    );
    await txn.runAsync(
      `insert into outbox_history
        (outbox_id, entity, entity_id, op, payload, created_at, status, attempts, updated_at)
       values (?, ?, ?, ?, ?, ?, 'queued', 0, ?)`,
      [
        result.lastInsertRowId,
        input.entity,
        input.entityId,
        input.op,
        JSON.stringify(input.payload),
        createdAt,
        createdAt,
      ],
    );
  }
}

export type EnqueueMutationBuilder = (txn: SqlDatabase) => Promise<readonly EnqueueMutationInput[]>;

/** Baut und schreibt Mutationen in genau einer exklusiven SQLite-Transaktion. */
export async function enqueueMutationsInExclusiveTransaction(
  db: SqlDatabase,
  build: EnqueueMutationBuilder,
): Promise<void> {
  let inputs: readonly EnqueueMutationInput[] = [];

  try {
    await runQueuedExclusive(db, async () => {
      await db.withExclusiveTransactionAsync(async (txn) => {
        inputs = await build(txn);
        await writeOutboxEntries(txn, inputs);
      });
    });
  } catch (error) {
    reportError(error, {
      operation: 'outbox.enqueue',
      entity: inputs[0]?.entity ?? 'unknown',
      error_code: 'outbox_enqueue_failed',
      outbox_count: inputs.length,
    });
    throw error;
  }

  if (inputs.length === 0) return;

  addDiagnosticStep('outbox.mutation.queued', {
    operation: 'outbox.enqueue',
    entity: inputs[0]?.entity ?? 'unknown',
    outbox_count: inputs.length,
  });
  notifyOutboxChanged();
}

/**
 * Baut und schreibt abhängige Mutationen schrittweise in einer Transaktion.
 *
 * Der normale Builder bleibt für unabhängige Mutationen optimiert. Dieser
 * Builder schreibt jeden bestätigten Schritt sofort in den Transaktions-Handle,
 * damit der nächste Schritt den gerade lokal gemergten Zustand sehen kann.
 */
export type EnqueueMutationStepBuilder = (
  txn: SqlDatabase,
  append: (input: EnqueueMutationInput) => Promise<void>,
) => Promise<void>;

export async function enqueueMutationStepsInExclusiveTransaction(
  db: SqlDatabase,
  build: EnqueueMutationStepBuilder,
): Promise<void> {
  const inputs: EnqueueMutationInput[] = [];

  try {
    await runQueuedExclusive(db, async () => {
      await db.withExclusiveTransactionAsync(async (txn) => {
        await build(txn, async (input) => {
          await writeOutboxEntries(txn, [input]);
          inputs.push(input);
        });
      });
    });
  } catch (error) {
    reportError(error, {
      operation: 'outbox.enqueue',
      entity: inputs[0]?.entity ?? 'unknown',
      error_code: 'outbox_enqueue_failed',
      outbox_count: inputs.length,
    });
    throw error;
  }

  if (inputs.length === 0) return;

  addDiagnosticStep('outbox.mutation.queued', {
    operation: 'outbox.enqueue',
    entity: inputs[0]?.entity ?? 'unknown',
    outbox_count: inputs.length,
  });
  notifyOutboxChanged();
}

export async function enqueueMutations(
  db: SqlDatabase,
  inputs: readonly EnqueueMutationInput[],
): Promise<void> {
  if (inputs.length === 0) return;
  await enqueueMutationsInExclusiveTransaction(db, async () => inputs);
}

/** Kompatibler Einzelmutations-Wrapper fuer bestehende Aufrufer. */
export async function enqueueMutation(db: SqlDatabase, input: EnqueueMutationInput): Promise<void> {
  await enqueueMutations(db, [input]);
}

export async function loadDueOutboxEntries(db: SqlDatabase, nowMs: number): Promise<OutboxEntry[]> {
  return db.getAllAsync<OutboxEntry>(
    'select * from outbox where next_attempt_at <= ? and attempts < ? order by id asc',
    [nowMs, MAX_ATTEMPTS],
  );
}

/** Lädt alle nicht-terminalen Einträge, damit ein Backoff keine spätere
 * Mutation derselben Zeile überholen lässt. Die Fälligkeit wird im Push-Plan
 * separat ausgewertet; unabhängige Zeilen dürfen weiterlaufen. */
export async function loadPendingOutboxEntries(db: SqlDatabase): Promise<OutboxEntry[]> {
  return db.getAllAsync<OutboxEntry>('select * from outbox where attempts < ? order by id asc', [
    MAX_ATTEMPTS,
  ]);
}

export async function loadOutboxHistory(
  db: SqlDatabase,
  limit = 100,
): Promise<OutboxHistoryEntry[]> {
  return db.getAllAsync<OutboxHistoryEntry>(
    'select * from outbox_history order by id desc limit ?',
    [Math.max(1, Math.floor(limit))],
  );
}

/** Loescht Outbox-Zeilen nach id — nie per pauschalem `delete from outbox`. */
export async function deleteOutboxEntries(
  db: SqlDatabase,
  ids: readonly number[],
  status: Extract<OutboxHistoryStatus, 'pushed' | 'discarded'> = 'discarded',
): Promise<void> {
  if (ids.length === 0) return;

  const placeholders = ids.map(() => '?').join(', ');
  const completedAt = Date.now();
  await db.runAsync(
    `update outbox_history
        set status = ?, updated_at = ?, completed_at = ?
      where outbox_id in (${placeholders})`,
    [status, completedAt, completedAt, ...ids],
  );
  await db.runAsync(`delete from outbox where id in (${placeholders})`, [...ids]);
}

export type OutboxOutcome = {
  attempts: number;
  lastError: string;
  /**
   * 'permanent': der Server hat definitiv abgelehnt (z. B. CAS-Konflikt).
   * 'transient': Netzwerk/Timeout/5xx — der tatsaechliche Servererfolg bleibt
   * unbekannt, auch nach Erschoepfen der Retries. Ein Retry-Limit macht
   * `unknown` nicht zu `conflict` (fam-lem.25); `getFridgeItemConflicts`
   * verlaesst sich auf dieses Feld, nicht auf `attempts` allein.
   */
  kind: 'transient' | 'permanent';
  nextAttemptAtMs: number;
};

/** Schreibt das Ergebnis eines gescheiterten Push-Versuchs auf die betroffenen Outbox-Zeilen. */
export async function recordOutboxOutcome(
  db: SqlDatabase,
  ids: readonly number[],
  outcome: OutboxOutcome,
): Promise<void> {
  if (ids.length === 0) return;

  const placeholders = ids.map(() => '?').join(', ');
  await db.runAsync(
    `update outbox set attempts = ?, last_error = ?, last_error_kind = ?, next_attempt_at = ? where id in (${placeholders})`,
    [outcome.attempts, outcome.lastError, outcome.kind, outcome.nextAttemptAtMs, ...ids],
  );
  await db.runAsync(
    `update outbox_history
        set status = 'failed', attempts = ?, last_error = ?, last_error_kind = ?, updated_at = ?
      where outbox_id in (${placeholders})`,
    [outcome.attempts, outcome.lastError, outcome.kind, Date.now(), ...ids],
  );
}
