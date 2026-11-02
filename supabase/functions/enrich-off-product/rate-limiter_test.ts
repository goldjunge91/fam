import { assertEquals } from 'jsr:@std/assert@1';

import { SlidingWindowRateLimiter } from './rate-limiter.ts';

Deno.test('erlaubt Anfragen bis zum Limit und blockt danach', () => {
  const limiter = new SlidingWindowRateLimiter(3, 60_000);
  const t0 = 1_000_000;

  assertEquals(limiter.isLimited(t0), false);
  limiter.record(t0);
  assertEquals(limiter.isLimited(t0), false);
  limiter.record(t0);
  assertEquals(limiter.isLimited(t0), false);
  limiter.record(t0);

  assertEquals(limiter.isLimited(t0), true);
});

Deno.test('lässt wieder Anfragen zu, sobald ältere aus dem Fenster fallen', () => {
  const limiter = new SlidingWindowRateLimiter(2, 60_000);
  const t0 = 1_000_000;

  limiter.record(t0);
  limiter.record(t0 + 1_000);
  assertEquals(limiter.isLimited(t0 + 2_000), true);
  assertEquals(limiter.isLimited(t0 + 61_000), false);
});

Deno.test('startet unbelastet', () => {
  const limiter = new SlidingWindowRateLimiter(1, 60_000);
  assertEquals(limiter.isLimited(), false);
});
