import { getDurationBucket, getResultBucket } from '@/lib/telemetry/buckets';

describe('telemetry buckets', () => {
  it.each([
    [0, '0-1s'],
    [999, '0-1s'],
    [1_000, '1-3s'],
    [2_999, '1-3s'],
    [3_000, '3s+'],
  ])('maps %d ms to %s', (durationMs, expected) => {
    expect(getDurationBucket(durationMs)).toBe(expected);
  });

  it.each([
    [-1, '0'],
    [0, '0'],
    [1, '1-5'],
    [5, '1-5'],
    [6, '6+'],
  ])('maps %d results to %s', (resultCount, expected) => {
    expect(getResultBucket(resultCount)).toBe(expected);
  });
});
