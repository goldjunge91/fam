import { describe, expect, it } from '@jest/globals';
import { hashOrderedPageSet } from '../../tools/crawler/brochures/listing-only/full-brochure-signature';
import {
  buildCanonicalReport,
  parseCanonicalReportArguments,
} from '../../tools/crawler/brochures/listing-only/canonical-report';

const hashA = 'a'.repeat(64);
const hashB = 'b'.repeat(64);
const hashC = 'c'.repeat(64);
const hashD = 'd'.repeat(64);

function page(number: number, imageUrl: string) {
  return { number, imageUrl, hotspots: [] };
}

function variant(options: {
  canonicalBrn: string;
  brns: string[];
  title: string;
  storeId: string;
  availableZipCodes: string[];
  pageHashes: { pageNumber: number; sha256: string }[];
}) {
  const pageUrls = options.pageHashes.map(
    (_, index) => `https://images.example.test/${options.canonicalBrn}/${index + 1}.jpg`,
  );
  const pages = pageUrls.map((url, index) => page(index + 1, url));
  return {
    ...options,
    pageUrls,
    pages,
    pageCount: pageUrls.length,
    brochureSha256: hashOrderedPageSet(options.pageHashes, pageUrls.length),
  };
}

function makePersistedRow(
  group: { storeName: string; validFrom: string; validUntil: string },
  brochureVariant: ReturnType<typeof variant>,
) {
  return {
    canonicalBrn: brochureVariant.canonicalBrn,
    storeName: group.storeName,
    storeId: brochureVariant.storeId,
    title: brochureVariant.title,
    validFrom: group.validFrom,
    validUntil: group.validUntil,
    pageCount: brochureVariant.pageCount,
    availableZipCodes: brochureVariant.availableZipCodes,
    verifiedSha256: brochureVariant.brochureSha256,
    verifiedPageHashes: brochureVariant.pageHashes,
    coverImage: brochureVariant.pageUrls[0],
    pageUrls: brochureVariant.pageUrls,
    pages: brochureVariant.pages,
  };
}

function reportFixture() {
  const lidl = {
    storeName: 'Lidl',
    validFrom: '2026-10-01',
    validUntil: '2026-10-07',
    detailPageCount: 2,
    brns: ['brn-a', 'brn-b', 'brn-c'],
    availableZipCodes: ['10000', '10100'],
    sightingCount: 5,
    variants: [
      variant({
        canonicalBrn: 'brn-a',
        brns: ['brn-a', 'brn-b'],
        title: 'Lidl Woche',
        storeId: 'lidl',
        availableZipCodes: ['10000', '10100'],
        pageHashes: [
          { pageNumber: 1, sha256: hashA },
          { pageNumber: 2, sha256: hashB },
        ],
      }),
      variant({
        canonicalBrn: 'brn-c',
        brns: ['brn-c'],
        title: 'Lidl Woche Süd',
        storeId: 'lidl',
        availableZipCodes: ['10000'],
        pageHashes: [
          { pageNumber: 1, sha256: hashC },
          { pageNumber: 2, sha256: hashD },
        ],
      }),
    ],
  };
  const rewe = {
    storeName: 'REWE',
    validFrom: '2026-10-01',
    validUntil: '2026-10-07',
    detailPageCount: 1,
    brns: ['brn-d'],
    availableZipCodes: ['30000'],
    sightingCount: 1,
    variants: [
      variant({
        canonicalBrn: 'brn-d',
        brns: ['brn-d'],
        title: 'REWE Woche',
        storeId: 'rewe',
        availableZipCodes: ['30000'],
        pageHashes: [{ pageNumber: 1, sha256: hashD }],
      }),
    ],
  };
  const groups = [lidl, rewe];
  const canonicalBrochureCount = groups.reduce((sum, group) => sum + group.variants.length, 0);
  const uniqueBrnCount = groups.reduce((sum, group) => sum + group.brns.length, 0);

  return {
    fullScan: {
      byZipCode: {
        '10000': [
          { brn: 'brn-a', storeName: 'Lidl', validFrom: lidl.validFrom, validUntil: lidl.validUntil },
          { brn: 'brn-b', storeName: 'Lidl', validFrom: lidl.validFrom, validUntil: lidl.validUntil },
          { brn: 'brn-c', storeName: 'Lidl', validFrom: lidl.validFrom, validUntil: lidl.validUntil },
        ],
        '10100': [
          { brn: 'brn-a', storeName: 'Lidl', validFrom: lidl.validFrom, validUntil: lidl.validUntil },
          { brn: 'brn-b', storeName: 'Lidl', validFrom: lidl.validFrom, validUntil: lidl.validUntil },
        ],
        '30000': [
          { brn: 'brn-d', storeName: 'REWE', validFrom: rewe.validFrom, validUntil: rewe.validUntil },
        ],
      },
    },
    verification: {
      version: 1,
      summary: {
        metadataGroupCount: groups.length,
        uniqueBrnCount,
        canonicalBrochureCount,
      },
      groups,
    },
    persistedBrochures: {
      generatedAt: '2026-10-07T00:00:00.000Z',
      brochures: groups.flatMap((group) => group.variants.map((entry) => makePersistedRow(group, entry))),
    },
  };
}

describe('canonical brochure report', () => {
  it('reports full-brochure variants, metadata groups, sightings, and per-store counts', () => {
    expect(buildCanonicalReport(reportFixture())).toEqual({
      naive: 6,
      canonical: 3,
      metadata_groups: 2,
      savings_percent: 50,
      by_store: {
        Lidl: { naive: 5, canonical: 2, metadata_groups: 1 },
        REWE: { naive: 1, canonical: 1, metadata_groups: 1 },
      },
    });
  });

  it('rejects persisted output missing a verified full-brochure variant', () => {
    const fixture = reportFixture();
    fixture.persistedBrochures.brochures.pop();

    expect(() => buildCanonicalReport(fixture)).toThrow(
      'Persisted full-brochure variants do not match verification variants',
    );
  });

  it('rejects a persisted hash vector that disagrees with its full brochure root', () => {
    const fixture = reportFixture();
    fixture.persistedBrochures.brochures[0]!.verifiedPageHashes[1]!.sha256 = hashC;

    expect(() => buildCanonicalReport(fixture)).toThrow(
      'brochureSha256 does not match its ordered page hashes',
    );
  });

  it('rejects verification variants with inconsistent page counts', () => {
    const fixture = reportFixture();
    fixture.verification.groups[0]!.variants[0]!.pageCount = 1;

    expect(() => buildCanonicalReport(fixture)).toThrow(
      'pageCount does not match its metadata group',
    );
  });

  it('rejects variant ZIP availability that does not match full-scan sightings', () => {
    const fixture = reportFixture();
    fixture.verification.groups[0]!.variants[0]!.availableZipCodes = ['10000'];

    expect(() => buildCanonicalReport(fixture)).toThrow(
      'ZIP availability does not match full scan',
    );
  });

  it('rejects a metadata group whose ZIP coverage does not match the full scan', () => {
    const fixture = reportFixture();
    fixture.verification.groups[0]!.availableZipCodes = ['10000'];

    expect(() => buildCanonicalReport(fixture)).toThrow(
      'does not match full-scan ZIP coverage',
    );
  });

  it('rejects full-scan sightings missing from the full-page report', () => {
    const fixture = reportFixture();
    fixture.fullScan.byZipCode['10000'].pop();

    expect(() => buildCanonicalReport(fixture)).toThrow(
      'does not match full-scan ZIP coverage',
    );
  });

  it('rejects verification summary counts that disagree with its variants', () => {
    const fixture = reportFixture();
    fixture.verification.summary.canonicalBrochureCount = 99;

    expect(() => buildCanonicalReport(fixture)).toThrow(
      'summary counts do not match its groups and variants',
    );
  });

  it('uses full-page verification paths and allows each input path to be overridden', () => {
    expect(parseCanonicalReportArguments([])).toEqual({
      inputPath: 'tools/crawler/data/listing-only/all-stores-full.json',
      verificationPath: 'tools/crawler/data/listing-only/canonical-page-verification.json',
      persistedPath: 'tools/crawler/data/listing-only/canonical-brochures.json',
      outputPath: 'tools/crawler/data/listing-only/canonical-report.json',
    });
    expect(
      parseCanonicalReportArguments([
        '--input=fixtures/full.json',
        '--verification=fixtures/page-verification.json',
        '--persisted=fixtures/persisted.json',
        '--output=fixtures/report.json',
      ]),
    ).toEqual({
      inputPath: 'fixtures/full.json',
      verificationPath: 'fixtures/page-verification.json',
      persistedPath: 'fixtures/persisted.json',
      outputPath: 'fixtures/report.json',
    });
  });
});
