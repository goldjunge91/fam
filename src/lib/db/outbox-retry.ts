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

  // Alte Inventar-Updates koennen die aus dem JOIN stammenden Felder
  // `location_kind` und `location_name` enthalten. Sie gehoeren zu
  // `storage_locations`, nicht zu `fridge_items`, und muessen vor dem
  // Wiederanlauf aus bereits terminalen Outbox-Eintraegen entfernt werden.
  const staleInventoryEntries = await db.getAllAsync<{ id: number; payload: string }>(
    `select id, payload
       from outbox
      where entity = 'fridge_items'
        and attempts >= ?
        and (payload like '%"location_kind"%' or payload like '%"location_name"%')`,
    [MAX_ATTEMPTS],
  );

  for (const entry of staleInventoryEntries) {
    const parsed: unknown = JSON.parse(entry.payload);
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) continue;

    const fixedPayload = JSON.stringify(
      Object.fromEntries(
        Object.entries(parsed).filter(
          ([key]) => key !== 'location_kind' && key !== 'location_name',
        ),
      ),
    );
    await db.runAsync('update outbox set payload = ? where id = ?', [fixedPayload, entry.id]);
  }

  const result = await db.runAsync(
    "update outbox set attempts = 0, next_attempt_at = ? where attempts >= ? or last_error like '%unit%'",
    [nowMs, MAX_ATTEMPTS],
  );

  return result.changes;
}
