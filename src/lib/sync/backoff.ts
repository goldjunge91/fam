export const MAX_ATTEMPTS = 5;

const DELAYS_MS = [1_000, 5_000, 15_000, 60_000, 300_000] as const;

export function backoffDelayMs(attempts: number): number {
  const index = Math.min(Math.max(attempts, 0), DELAYS_MS.length - 1);
  return DELAYS_MS[index];
}

export type ErrorKind = 'transient' | 'permanent';

export function classifyError(status: number | null): ErrorKind {
  if (status === null) return 'transient';

  if (status === 408 || status === 429) return 'transient';
  if (status >= 500) return 'transient';

  return 'permanent';
}
