import { describe, expect, it } from '@jest/globals';
import { buildCanonicalCatalog } from '../../tools/crawler/brochures/listing-only/canonical-catalog';
import { hashOrderedPageSet } from '../../tools/crawler/brochures/listing-only/full-brochure-signature';

const hashA = 'a'.repeat(64);
const hashB = 'b'.repeat(64);
const hashC = 'c'.repeat(64);
const validFrom = '2026-10-01T00:00:00.000Z';
const validUntil = '2026-10-07T23:59:59.000Z';

type VerifiedPageHash = { pageNumber: number; sha256: string };

function pages(prefix: string, count = 2) {
  return Array.from({ length: count }, (_, index) => ({
    number: index + 1,
    imageUrl: `https://r2.example.test/brochures/dumps/assets/${prefix}-page-${index + 1}.jpg`,
    hotspots:
      index === 0
        ? [
            {
              kind: 'discount' as const,
              id: `${prefix}-hotspot`,
              x: 10,
              y: 20,
              width: 30,
              height: 40,
              title: `${prefix} offer`,
              discount: '-20%',
              priceCents: 129,
            },
          ]
        : [],
  }));
}

function brochure(
  id: string,
  title: string,
  verifiedSha256: string | undefined,
  pageList: ReturnType<typeof pages>,
  verifiedPageHashes?: VerifiedPageHash[],
) {
  return {
    id,
    storeId: 'lidl',
    title,
    validFrom,
    validUntil,
    coverImage: pageList[0]?.imageUrl ?? '',
    pages: pageList,
    ...(verifiedSha256 === undefined ? {} : { verifiedSha256 }),
    ...(verifiedPageHashes === undefined ? {} : { verifiedPageHashes }),
  };
}

function dump(zipCode: string, brochures: ReturnType<typeof brochure>[], storeName = 'Lidl') {
  return {
    location: { zipCode, latitude: 52, longitude: 13 },
    stores: [{ id: 'lidl', name: storeName }],
    brochures,
  };
}

describe('canonical brochure catalog', () => {
  it('merges same-hash sightings and keeps the smallest BRN pages and hotspots', () => {
    const representativePages = pages('brn-a');
    const verifiedPageHashes = [
      { pageNumber: 1, sha256: hashA },
      { pageNumber: 2, sha256: hashB },
    ];
    const contentHash = hashOrderedPageSet(verifiedPageHashes, 2);
    const dumps = [
      dump(
        '20000',
        [brochure('brn-z', 'Lidl Z', hashA, pages('brn-z'), verifiedPageHashes)],
      ),
      dump('10000', [
        brochure('brn-m', 'Lidl M', hashA, pages('brn-m'), verifiedPageHashes),
        brochure('brn-a', 'Lidl A', hashA, representativePages, verifiedPageHashes),
      ]),
    ];

    expect(buildCanonicalCatalog(dumps)).toEqual([
      {
        id: `canonical:${JSON.stringify(['Lidl', validFrom, validUntil, 2, ['content', contentHash]])}`,
        canonicalBrn: 'brn-a',
        storeId: 'lidl',
        title: 'Lidl A',
        validFrom,
        validUntil,
        coverImage: representativePages[0]?.imageUrl,
        pages: representativePages,
        pageCount: 2,
        verifiedSha256: hashA,
        verifiedPageHashes,
        availableZipCodes: ['10000', '20000'],
      },
    ]);
  });

  it('keeps same-cover brochures separate when a later page hash differs', () => {
    const dumps = [
      dump('10000', [
        brochure('brn-a', 'Lidl A', hashA, pages('brn-a'), [
          { pageNumber: 1, sha256: hashA },
          { pageNumber: 2, sha256: hashB },
        ]),
        brochure('brn-b', 'Lidl B', hashA, pages('brn-b'), [
          { pageNumber: 1, sha256: hashA },
          { pageNumber: 2, sha256: hashC },
        ]),
      ]),
    ];

    const catalog = buildCanonicalCatalog(dumps);

    expect(catalog).toHaveLength(2);
    expect(catalog.map((record) => record.canonicalBrn).sort()).toEqual(['brn-a', 'brn-b']);
  });

  it('does not merge different BRNs when full page hashes are unavailable', () => {
    const catalog = buildCanonicalCatalog([
      dump('10000', [
        brochure('brn-a', 'Lidl A', hashA, pages('brn-a')),
        brochure('brn-b', 'Lidl B', hashA, pages('brn-b')),
      ]),
    ]);

    expect(catalog).toHaveLength(2);
    expect(catalog.map((record) => record.canonicalBrn)).toEqual(['brn-a', 'brn-b']);
  });

  it('keeps differing hashes as separate records with stable IDs and ordering', () => {
    const dumps = [
      dump('20000', [brochure('brn-z', 'Lidl Z', hashB, pages('brn-z'))]),
      dump('10000', [brochure('brn-a', 'Lidl A', hashA, pages('brn-a'))]),
    ];

    const catalog = buildCanonicalCatalog(dumps);

    expect(catalog.map((record) => record.verifiedSha256)).toEqual([hashA, hashB]);
    expect(new Set(catalog.map((record) => record.id)).size).toBe(2);
    expect(buildCanonicalCatalog([...dumps].reverse())).toEqual(catalog);
  });

  it('treats page count as part of the grouping key', () => {
    const catalog = buildCanonicalCatalog([
      dump('10000', [
        brochure('brn-a', 'Lidl A', hashA, pages('brn-a', 1)),
        brochure('brn-b', 'Lidl B', hashA, pages('brn-b', 2)),
      ]),
    ]);

    expect(catalog).toHaveLength(2);
    expect(catalog.map((record) => record.pages.length)).toEqual([1, 2]);
  });

  it('rejects older crawl dumps without a verified image hash', () => {
    expect(() =>
      buildCanonicalCatalog([
        dump('10000', [brochure('brn-old', 'Lidl alt', undefined, pages('brn-old'))]),
      ]),
    ).toThrow('Brochure brn-old is missing a valid verified SHA-256');
  });
});
