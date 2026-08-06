import type { SqlDatabase } from '@/lib/db/types';
import { MAX_ATTEMPTS } from '@/lib/sync/backoff';

/**
 * Retry-Primitive fuer dauerhaft gescheiterte Outbox-Eintraege (#51).
 *
 * Bewusst eine eigene Datei statt einer Ergaenzung von `outbox.ts`: Der
 * parallele Arbeitsstrang an #48/#50 aendert `outbox.ts` nicht, dieser Strang
 * an #51 aendert es damit ebenfalls nicht — die beiden Arbeitsstraenge teilen
 * sich keine einzige Datei, nicht einmal additiv.
 */

/**
 * Macht alle terminal gescheiterten Eintraege wieder faellig, damit der
 * naechste Push-Lauf sie erneut versucht.
 *
 * "Terminal" ist ueberall im Sync-Layer `attempts >= MAX_ATTEMPTS`, keine
 * eigene Spalte (siehe `push.ts`). Der Retry setzt deshalb nur `attempts`
 * und `next_attempt_at` zurueck, nicht `last_error` — die letzte
 * Fehlermeldung bleibt sichtbar, bis ein neuer Versuch sie ersetzt oder
 * loescht.
 */
export async function retryFailedOutboxEntries(
  db: SqlDatabase,
  nowMs = Date.now(),
): Promise<number> {
  const result = await db.runAsync(
    'update outbox set attempts = 0, next_attempt_at = ? where attempts >= ?',
    [nowMs, MAX_ATTEMPTS],
  );

  return result.changes;
}
