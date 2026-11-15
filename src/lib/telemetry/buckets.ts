export type DurationBucket = '0-1s' | '1-3s' | '3s+';
export type ResultBucket = '0' | '1-5' | '6+';

export function getDurationBucket(durationMs: number): DurationBucket {
  if (durationMs < 1_000) return '0-1s';
  if (durationMs < 3_000) return '1-3s';
  return '3s+';
}

export function getResultBucket(resultCount: number): ResultBucket {
  if (resultCount <= 0) return '0';
  if (resultCount <= 5) return '1-5';
  return '6+';
}
