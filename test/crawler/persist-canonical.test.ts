import { describe, expect, it } from '@jest/globals';
import { hashOrderedPageSet } from '../../tools/crawler/brochures/listing-only/full-brochure-signature';
import {
  buildPersistedCanonicalBrochures,
  parsePersistCanonicalArguments,
} from '../../tools/crawler/brochures/listing-only/persist-canonical';

const hashA = 'a'.repeat(64);
const hashB = 'b'.repeat(64);
const pageHashes = [
  { pageNumber: 1, sha256: hashA },
  { pageNumber: 2, sha256: hashB },
];

function page(number: number, imageUrl: string) {
  return { number, imageUrl, hotspots: [] };
}

function variant(overrides: Record<string, unknown> = {}) {
  const pages = [
    page(1, 'https://assets.example/cover.jpg'),
    page(2, 'https://assets.example/page-2.jpg'),
  ];
  return {
    canonicalBrn: 'brn-a',
    title: 'Lidl Woche',
    storeId: 'lidl',
    brns: ['brn-a'],
    availableZipCodes: ['10000', '10100'],
    pageUrls: pages.map(({ imageUrl }) => imageUrl),
    pages,
    pageHashes,
    pageCount: 2,
    brochureSha256: hashOrderedPageSet(pageHashes, 2),
    ...overrides,
  };
}

function report(variants: unknown[] = [variant()]) {
  return {
    version: 1,
    scope: { mode: 'all-brns', complete: true },
    groups: [
      {
        storeName: 'Lidl',
        validFrom: '2026-10-01',
        validUntil: '2026-10-07',
        detailPageCount: 2,
        brns: ['brn-a'],
        availableZipCodes: ['10000', '10100'],
        sightingCount: 2,
        variants,
      },
    ],
  };
}

describe('canonical brochure persistence', () => {
  it('refuses pilot and ZIP sample reports as publication input', () => {
    for (const scope of [
      { mode: 'pilot', complete: false },
      { mode: 'zip-sample', complete: false },
      { mode: 'all-brns', complete: false },
    ]) {
      expect(() => buildPersistedCanonicalBrochures({ ...report(), scope })).toThrow(
        'Only a complete all-BRN page verification can be persisted for publication',
      );
    }
  });

  it('persists a full-page verification variant with its complete hash vector', () => {
    expect(buildPersistedCanonicalBrochures(report())).toEqual([
      {
        canonicalBrn: 'brn-a',
        storeName: 'Lidl',
        storeId: 'lidl',
        title: 'Lidl Woche',
        validFrom: '2026-10-01',
        validUntil: '2026-10-07',
        pageCount: 2,
        availableZipCodes: ['10000', '10100'],
        verifiedSha256: hashOrderedPageSet(pageHashes, 2),
        verifiedPageHashes: pageHashes,
        coverImage: 'https://assets.example/cover.jpg',
        pageUrls: ['https://assets.example/cover.jpg', 'https://assets.example/page-2.jpg'],
        pages: [
          page(1, 'https://assets.example/cover.jpg'),
          page(2, 'https://assets.example/page-2.jpg'),
        ],
      },
    ]);
  });

  it('writes one output row for every complete variant in a metadata group', () => {
    const secondPageHashes = [
      { pageNumber: 1, sha256: hashB },
      { pageNumber: 2, sha256: hashA },
    ];
    const variants = [
      variant(),
      variant({
        canonicalBrn: 'brn-b',
        title: 'Lidl Woche Süd',
        brns: ['brn-b', 'brn-c'],
        availableZipCodes: ['20000'],
        pageHashes: secondPageHashes,
        brochureSha256: hashOrderedPageSet(secondPageHashes, 2),
      }),
    ];

    const brochures = buildPersistedCanonicalBrochures(report(variants));

    expect(brochures).toHaveLength(2);
    expect(brochures.map(({ canonicalBrn }) => canonicalBrn)).toEqual(['brn-a', 'brn-b']);
    expect(brochures[1]).toMatchObject({
      title: 'Lidl Woche Süd',
      availableZipCodes: ['20000'],
      verifiedSha256: hashOrderedPageSet(secondPageHashes, 2),
      verifiedPageHashes: secondPageHashes,
    });
  });

  it('rejects an invalid page count', () => {
    expect(() => buildPersistedCanonicalBrochures(report([variant({ pageCount: 3 })]))).toThrow(
      'pageCount does not match its metadata group',
    );
  });

  it('rejects page records that are out of order or disagree with pageUrls', () => {
    const outOfOrderPages = [
      page(2, 'https://assets.example/page-2.jpg'),
      page(1, 'https://assets.example/cover.jpg'),
    ];

    expect(() =>
      buildPersistedCanonicalBrochures(report([variant({ pages: outOfOrderPages })])),
    ).toThrow('pages must match the ordered page URLs');
  });

  it('rejects page hashes that are not in page-number order', () => {
    expect(() =>
      buildPersistedCanonicalBrochures(report([variant({ pageHashes: [...pageHashes].reverse() })])),
    ).toThrow('page hashes must be ordered from page 1 to 2');
  });

  it('rejects a brochure root that does not match the complete ordered hash vector', () => {
    expect(() =>
      buildPersistedCanonicalBrochures(report([variant({ brochureSha256: hashA })])),
    ).toThrow('brochureSha256 does not match its ordered page hashes');
  });

  it('rejects duplicate canonical BRNs across variants', () => {
    expect(() => buildPersistedCanonicalBrochures(report([variant(), variant()]))).toThrow(
      'Canonical BRN brn-a appears more than once',
    );
  });

  it('uses the full-page verification and canonical output paths by default', () => {
    expect(parsePersistCanonicalArguments([])).toEqual({
      verificationPath: 'tools/crawler/data/listing-only/canonical-page-verification.json',
      outputPath: 'tools/crawler/data/listing-only/canonical-brochures.json',
    });
    expect(
      parsePersistCanonicalArguments([
        '--verification=fixtures/page-verification.json',
        '--output=fixtures/brochures.json',
      ]),
    ).toEqual({
      verificationPath: 'fixtures/page-verification.json',
      outputPath: 'fixtures/brochures.json',
    });
  });
});
