import type { Entity, OutboxEntry, OutboxOp, SqlDatabase } from '@/lib/db/types';
import { MAX_ATTEMPTS } from '@/lib/sync/backoff';

/** Parst `OutboxEntry.payload` (JSON-Text) in ein Objekt. Wirft bei Nicht-Objekt. */
export function parseOutboxEntry(entry: OutboxEntry): Record<string, unknown> {
  const parsed: unknown = JSON.parse(entry.payload);

  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`Outbox-Eintrag ${entry.id} hat kein Objekt als payload.`);
  }

  const rec = parsed as Record<string, unknown>;
  if ('unit' in rec && typeof rec.unit === 'string') {
    const u = rec.unit.toLowerCase().trim();
    if (u === 'l' || u === 'liter') rec.unit = 'l';
    else if (u === 'g' || u === 'gramm') rec.unit = 'g';
    else if (u === 'kg' || u === 'kilo') rec.unit = 'kg';
    else if (u === 'ml') rec.unit = 'ml';
    else if (u === 'piece' || u === 'stk' || u === 'stück') rec.unit = 'piece';
    else if (u === 'package' || u === 'packung') rec.unit = 'package';
    else if (u === 'portion') rec.unit = 'portion';
    else if (['g', 'kg', 'ml', 'l', 'piece', 'package', 'portion'].includes(u)) rec.unit = u;
    else rec.unit = 'piece';
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

type OutboxChangedListener = () => void;
const outboxChangedListeners = new Set<OutboxChangedListener>();

export function onOutboxChanged(listener: OutboxChangedListener): () => void {
  outboxChangedListeners.add(listener);
  return () => {
    outboxChangedListeners.delete(listener);
  };
}

function notifyOutboxChanged(): void {
  for (const listener of outboxChangedListeners) listener();
}

export async function enqueueMutations(
  db: SqlDatabase,
  inputs: readonly EnqueueMutationInput[],
): Promise<void> {
  if (inputs.length === 0) return;

  await db.withExclusiveTransactionAsync(async (txn) => {
    for (const input of inputs) {
      await input.applyLocally(txn);

      await txn.runAsync(
        'insert into outbox (entity, entity_id, op, payload, created_at, attempts, next_attempt_at) values (?, ?, ?, ?, ?, 0, 0)',
        [
          input.entity,
          input.entityId,
          input.op,
          JSON.stringify(input.payload),
          input.now ?? Date.now(),
        ],
      );
    }
  });

  notifyOutboxChanged();
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

/** Loescht Outbox-Zeilen nach id — nie per pauschalem `delete from outbox`. */
export async function deleteOutboxEntries(db: SqlDatabase, ids: readonly number[]): Promise<void> {
  if (ids.length === 0) return;

  const placeholders = ids.map(() => '?').join(', ');
  await db.runAsync(`delete from outbox where id in (${placeholders})`, [...ids]);
}

export type OutboxOutcome = {
  attempts: number;
  lastError: string;
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
    `update outbox set attempts = ?, last_error = ?, next_attempt_at = ? where id in (${placeholders})`,
    [outcome.attempts, outcome.lastError, outcome.nextAttemptAtMs, ...ids],
  );
}
