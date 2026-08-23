/**
 * Gleitendes Zeitfenster-Rate-Limit, identische Logik zu
 * `SlidingWindowRateLimiter` in src/lib/open-food-facts.ts (kein Import
 * zwischen Deno und React Native möglich, siehe off-client.ts).
 *
 * Prozessweiter, geteilter Zustand (eine Instanz pro Edge-Function-Isolate,
 * nicht pro EAN oder Aufrufer) — schützt das eigene Aufrufbudget gegenüber
 * Open Food Facts (dokumentiertes Limit 15 Produktabfragen/Min/IP), nicht
 * einzelne Nutzer voneinander. "Best effort": ein neu gestartetes Isolate
 * beginnt wieder bei null, was fuer den Zweck (OFFs eigenes Limit nicht
 * reissen) ausreicht — anders als ein Nutzer-Kontingent braucht das keine
 * Persistenz ueber Kaltstarts hinweg.
 */
export class SlidingWindowRateLimiter {
  private timestamps: number[] = [];

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
  ) {}

  private prune(now: number) {
    while (this.timestamps.length > 0 && now - this.timestamps[0] > this.windowMs) {
      this.timestamps.shift();
    }
  }

  isLimited(now: number = Date.now()): boolean {
    this.prune(now);
    return this.timestamps.length >= this.limit;
  }

  record(now: number = Date.now()): void {
    this.prune(now);
    this.timestamps.push(now);
  }
}
