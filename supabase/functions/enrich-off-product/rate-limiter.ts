/** Prozessweites Best-Effort-Limit fuer das gemeinsame OFF-Anfragebudget. */
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
