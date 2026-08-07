import type { SqlDatabase } from '@/lib/db/types';
import { MAX_ATTEMPTS } from '@/lib/sync/backoff';

/**
 * Retry-Primitive fuer dauerhaft gescheiterte Outbox-Eintraege (#51).
 */

export async function retryFailedOutboxEntries(
  db: SqlDatabase,
  nowMs = Date.now(),
): Promise<number> {
  // Reparatur von veralteten uppercase 'L' Einheiten im Outbox JSON payload
  const entries = await db.getAllAsync<{ id: number; payload: string }>(
    'select id, payload from outbox where payload like \'%"unit":"L"%\' or payload like \'%"unit":"LITER"%\'',
  );

  for (const entry of entries) {
    const fixedPayload = entry.payload
      .replace(/"unit":"L"/g, '"unit":"l"')
      .replace(/"unit":"LITER"/g, '"unit":"l"');
    await db.runAsync('update outbox set payload = ? where id = ?', [fixedPayload, entry.id]);
  }

  const result = await db.runAsync(
    "update outbox set attempts = 0, next_attempt_at = ? where attempts >= ? or last_error like '%unit%'",
    [nowMs, MAX_ATTEMPTS],
  );

  return result.changes;
}
