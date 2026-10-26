import { describe, expect, it } from '@jest/globals';
import {
  BROCHURE_PREFETCH_CONCURRENCY,
  type BrochureImagePrefetchItem,
  MAX_BROCHURE_PREFETCH_IMAGES,
  prefetchBrochureImages,
} from './brochure-image-prefetch';

function items(count: number): BrochureImagePrefetchItem[] {
  return Array.from({ length: count }, (_, index) => ({
    uri: `https://offerscdn.bringapi.app/content/page-${index + 1}.jpg`,
    validUntil: '2026-10-27T00:00:00.000Z',
  }));
}

describe('brochure image prefetch', () => {
  it('deduplicates URLs and starts no more than four requests at once', async () => {
    const duplicate = items(1)[0];
    if (!duplicate) throw new Error('Expected one fixture item');
    const completed = new Set<string>();
    const inFlight = new Map<string, Promise<boolean>>();
    let active = 0;
    let maximumActive = 0;

    await prefetchBrochureImages({
      items: [...items(12), duplicate],
      canContinue: () => true,
      completed,
      inFlight,
      now: () => Date.parse('2026-10-25T12:00:00.000Z'),
      prefetch: async () => {
        active += 1;
        maximumActive = Math.max(maximumActive, active);
        await Promise.resolve();
        active -= 1;
        return true;
      },
    });

    expect(maximumActive).toBe(BROCHURE_PREFETCH_CONCURRENCY);
    expect(completed.size).toBe(12);
    expect(inFlight.size).toBe(0);
  });

  it('limits a snapshot to 48 unique references and skips expired images', async () => {
    const completed = new Set<string>();
    const requested: string[] = [];
    const firstItem = items(1)[0];
    if (!firstItem) throw new Error('Expected one fixture item');
    const expiredItem = { ...firstItem, uri: 'expired', validUntil: '2026-10-24T00:00:00.000Z' };

    await prefetchBrochureImages({
      items: [expiredItem, ...items(MAX_BROCHURE_PREFETCH_IMAGES + 4)],
      canContinue: () => true,
      completed,
      inFlight: new Map(),
      now: () => Date.parse('2026-10-25T12:00:00.000Z'),
      prefetch: async (item) => {
        requested.push(item.uri);
        return true;
      },
    });

    expect(requested).toHaveLength(MAX_BROCHURE_PREFETCH_IMAGES - 1);
    expect(requested).not.toContain('expired');
  });

  it('does not start requests when the current ZIP snapshot is no longer usable', async () => {
    let calls = 0;

    await prefetchBrochureImages({
      items: items(5),
      canContinue: () => false,
      completed: new Set(),
      inFlight: new Map(),
      prefetch: async () => {
        calls += 1;
        return true;
      },
    });

    expect(calls).toBe(0);
  });
});
