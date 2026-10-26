import { describe, expect, it } from '@jest/globals';
import {
  buildCanonicalReport,
  parseCanonicalReportArguments,
} from '../../tools/crawler/brochures/listing-only/canonical-report';

const validFrom = '2026-10-20';
const validUntil = '2026-10-27';
const imageUrl = 'https://cdn.bringapi.app/content/brn-a/page-1.jpg';

function persistedBrochure(title: string, availableZipCodes = ['10000', '20000']) {
  return {
    canonicalBrn: 'brn-a',
    sourceZipCode: '10000',
    storeName: 'Lidl',
    storeId: 'lidl',
    title,
    validFrom,
    validUntil,
    pageCount: 1,
    availableZipCodes,
    coverImage: imageUrl,
    pageUrls: [imageUrl],
    pages: [{ number: 1, imageUrl, hotspots: [] }],
  };
}

function reportFixture() {
  return {
    fullScan: {
      totalLocations: 3,
      completedLocations: 3,
      byZipCode: {
        '10000': [{
          brn: 'brn-a',
          storeName: 'Lidl',
          title: 'Lidl Angebote',
          validFrom,
          validUntil,
        }],
        '10100': [],
        '20000': [{
          brn: 'brn-a',
          storeName: 'Lidl',
          title: 'Lidl Angebote',
          validFrom,
          validUntil,
        }],
      },
    },
    persistedBrochures: {
      generatedAt: '2026-10-25T00:00:00.000Z',
      brochures: [persistedBrochure('Lidl Angebote')],
    },
  };
}

describe('BRN brochure report', () => {
  it('counts listing sightings separately from one BRN and preserves its scanned ZIPs', () => {
    expect(buildCanonicalReport(reportFixture())).toEqual({
      naive: 2,
      canonical: 1,
      metadata_groups: 1,
      savings_percent: 50,
      by_store: {
        Lidl: { naive: 2, canonical: 1, metadata_groups: 1 },
      },
    });
  });

  it('rejects a catalog missing a listed ZIP association', () => {
    const fixture = reportFixture();
    fixture.persistedBrochures.brochures[0]!.availableZipCodes = ['10000'];

    expect(() => buildCanonicalReport(fixture)).toThrow(
      'Persisted catalog is missing availability for 20000:brn-a',
    );
  });

  it('rejects a catalog record with availability absent from the scan', () => {
    const fixture = reportFixture();
    fixture.persistedBrochures.brochures[0]!.availableZipCodes.push('30000');

    expect(() => buildCanonicalReport(fixture)).toThrow(
      'Persisted catalog contains unavailable regional reference 30000:brn-a',
    );
  });

  it('rejects duplicate persisted records for one BRN', () => {
    const fixture = reportFixture();
    fixture.persistedBrochures.brochures.push(persistedBrochure('Lidl Angebote'));

    expect(() => buildCanonicalReport(fixture)).toThrow(
      'BRN brn-a appears more than once',
    );
  });

  it('rejects listing metadata that differs from persisted regional details', () => {
    const fixture = reportFixture();
    fixture.persistedBrochures.brochures[0]!.title = 'Unmatched title';

    expect(() => buildCanonicalReport(fixture)).toThrow(
      'Persisted catalog metadata disagrees with full scan for 10000:brn-a',
    );
  });

  it('uses metadata-only input paths and supports path overrides', () => {
    expect(parseCanonicalReportArguments([])).toEqual({
      inputPath: 'tools/crawler/data/listing-only/all-stores-full.json',
      persistedPath: 'tools/crawler/data/listing-only/canonical-brochures.json',
      outputPath: 'tools/crawler/data/listing-only/canonical-report.json',
    });
    expect(
      parseCanonicalReportArguments([
        '--input=fixtures/full.json',
        '--persisted=fixtures/persisted.json',
        '--output=fixtures/report.json',
      ]),
    ).toEqual({
      inputPath: 'fixtures/full.json',
      persistedPath: 'fixtures/persisted.json',
      outputPath: 'fixtures/report.json',
    });
  });
});
