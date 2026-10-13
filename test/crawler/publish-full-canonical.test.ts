import { describe, expect, it } from '@jest/globals';
import { hashOrderedPageSet } from '../../tools/crawler/brochures/listing-only/full-brochure-signature';
import { buildPersistedCanonicalBrochures } from '../../tools/crawler/brochures/listing-only/persist-canonical';
import { buildFullPagePublication } from '../../tools/crawler/brochures/listing-only/publish-full-canonical';

const pageHashes = [{ pageNumber: 1, sha256: 'a'.repeat(64) }];
const verification = {
  version: 1,
  scope: {
    mode: 'all-brns',
    complete: true,
    totalGroupCount: 1,
    verifiedGroupCount: 1,
    totalBrnCount: 1,
    verifiedBrnCount: 1,
    totalPageReferenceCount: 1,
    verifiedPageReferenceCount: 1,
  },
  summary: {
    metadataGroupCount: 1,
    uniqueBrnCount: 1,
    canonicalBrochureCount: 1,
    pageReferenceCount: 1,
  },
  groups: [{
    storeName: 'REWE',
    validFrom: '2026-10-01',
    validUntil: '2026-10-07',
    detailPageCount: 1,
    brns: ['brn-a'],
    availableZipCodes: ['10115'],
    sightingCount: 1,
    variants: [{
      canonicalBrn: 'brn-a',
      brns: ['brn-a'],
      title: 'REWE Angebote',
      storeId: 'rewe',
      pageUrls: ['https://cdn.example/rewe.jpg'],
      pages: [{ number: 1, imageUrl: 'https://cdn.example/rewe.jpg', hotspots: [] }],
      pageHashes,
      pageCount: 1,
      availableZipCodes: ['10115'],
      brochureSha256: hashOrderedPageSet(pageHashes, 1),
    }],
  }],
};

const fullScan = {
  totalLocations: 1,
  completedLocations: 1,
  byZipCode: {
    '10115': [{
      brn: 'brn-a',
      storeName: 'REWE',
      title: 'REWE Angebote',
      validFrom: '2026-10-01',
      validUntil: '2026-10-07',
    }],
  },
};

describe('full-page brochure publication', () => {
  it('builds app records only from complete verification and persisted full-scan coverage', () => {
    const persisted = {
      generatedAt: '2026-10-09T00:00:00.000Z',
      brochures: buildPersistedCanonicalBrochures(verification),
    };

    const publication = buildFullPagePublication({ fullScan, verification, persisted });

    expect(publication.scopedZipCodes).toEqual(['10115']);
    expect(publication.uniquePageHashes).toEqual(['a'.repeat(64)]);
    expect(publication.stores).toEqual([{ id: 'rewe', name: 'REWE' }]);
    expect(publication.catalog[0]).toMatchObject({
      canonicalBrn: 'brn-a',
      pageCount: 1,
      coverImage: `brochures/dumps/assets/sha256/${'a'.repeat(64)}.jpg`,
      pages: [{
        number: 1,
        imageUrl: `brochures/dumps/assets/sha256/${'a'.repeat(64)}.jpg`,
        hotspots: [],
      }],
      verifiedSha256: hashOrderedPageSet(pageHashes, 1),
    });
  });

  it('rejects incomplete ZIP scans before preparing an app publication', () => {
    expect(() => buildFullPagePublication({
      fullScan: { ...fullScan, completedLocations: 0 },
      verification,
      persisted: { brochures: buildPersistedCanonicalBrochures(verification) },
    })).toThrow('Full scan did not complete every postal code; publication is blocked.');
  });

  it('rejects sample verification reports even when their sample pages are complete', () => {
    const sample = {
      ...verification,
      scope: { ...verification.scope, mode: 'zip-sample', complete: false },
    };

    expect(() => buildFullPagePublication({
      fullScan,
      verification: sample,
      persisted: { brochures: buildPersistedCanonicalBrochures(sample) },
    })).toThrow(/Only a complete all-BRN page verification/);
  });
});
