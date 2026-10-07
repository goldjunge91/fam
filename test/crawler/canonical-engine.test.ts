import { describe, expect, it } from '@jest/globals';
import { crawlAllLocations } from '../../tools/crawler/brochures/engine';
import {
  hashOrderedPageSet,
  type PageContentHash,
} from '../../tools/crawler/brochures/listing-only/full-brochure-signature';
import type { BrochureSource } from '../../tools/crawler/brochures/types';

describe('canonical crawler identities', () => {
  it('keeps image variants of the same brochure ID and their verified hashes', async () => {
    const source: BrochureSource = {
      name: 'mock',
      async fetchBrochuresForLocation(location) {
        const pageUrl = `https://example.com/${location.zipCode}.jpg`;
        return [
          {
            store: { id: 'store', name: 'Store' },
            brochures: [
              {
                id: 'same-brn',
                storeId: 'store',
                title: 'Prospekt',
                validFrom: '2026-08-25T00:00:00Z',
                validUntil: '2026-09-01T00:00:00Z',
                coverImage: pageUrl,
                pages: [{ number: 1, imageUrl: pageUrl, hotspots: [] }],
              },
            ],
          },
        ];
      },
    };

    const result = await crawlAllLocations(
      [
        { zipCode: '11111', latitude: 50, longitude: 10 },
        { zipCode: '22222', latitude: 50, longitude: 10 },
      ],
      {
        concurrency: 1,
        sources: [source],
        backupPath: null,
        resolveImageSha256: async (imageUrl) =>
          imageUrl.includes('11111') ? 'a'.repeat(64) : 'b'.repeat(64),
      },
    );

    expect(result.uniqueBrochuresCount).toBe(2);
    expect(
      result.dumps.map(({ brochures }) => {
        const brochure = brochures[0];
        return [brochure?.pages[0]?.imageUrl, brochure?.verifiedSha256];
      }),
    ).toEqual([
      ['https://example.com/11111.jpg', 'a'.repeat(64)],
      ['https://example.com/22222.jpg', 'b'.repeat(64)],
    ]);
  });

  it('preserves the complete verified page hash vector and its root', async () => {
    const verifiedPageHashes: PageContentHash[] = [
      { pageNumber: 1, sha256: 'a'.repeat(64) },
      { pageNumber: 2, sha256: 'b'.repeat(64) },
    ];
    const verifiedSha256 = hashOrderedPageSet(verifiedPageHashes, 2);
    const brochure = {
      id: 'full-hash-brn',
      storeId: 'store',
      title: 'Prospekt',
      validFrom: '2026-08-25T00:00:00Z',
      validUntil: '2026-09-01T00:00:00Z',
      coverImage: 'https://example.com/cover.jpg',
      pages: [
        { number: 1, imageUrl: 'https://example.com/cover.jpg', hotspots: [] },
        { number: 2, imageUrl: 'https://example.com/page-2.jpg', hotspots: [] },
      ],
      verifiedPageHashes,
      verifiedSha256,
    };
    const source: BrochureSource = {
      name: 'mock',
      async fetchBrochuresForLocation() {
        return [{ store: { id: 'store', name: 'Store' }, brochures: [brochure] }];
      },
    };

    const result = await crawlAllLocations(
      [{ zipCode: '11111', latitude: 50, longitude: 10 }],
      {
        concurrency: 1,
        sources: [source],
        backupPath: null,
      },
    );

    const crawledBrochure = result.dumps[0]?.brochures[0];
    expect(crawledBrochure?.verifiedPageHashes).toEqual(verifiedPageHashes);
    expect(crawledBrochure?.verifiedSha256).toBe(verifiedSha256);
  });
});
