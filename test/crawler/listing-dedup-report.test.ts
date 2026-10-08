import { describe, expect, it } from '@jest/globals';
import {
  buildListingDedupReport,
  parseListingDedupReportArguments,
} from '../../tools/crawler/brochures/listing-only/listing-dedup-report';

function makeListingFixture() {
  const sameMetadata = {
    storeName: 'Lidl',
    validFrom: '2026-10-01',
    validUntil: '2026-10-07',
    pageCount: 1,
  };

  return {
    fullScan: {
      byZipCode: {
        '10100': [
          {
            brn: 'brn-a',
            title: 'Lidl Woche Nord',
            imageUrl: 'https://cdn.example/nord-a.jpg',
            ...sameMetadata,
          },
          {
            brn: 'brn-b',
            title: 'Lidl Woche Nord',
            imageUrl: 'https://cdn.example/nord-b.jpg',
            ...sameMetadata,
          },
          {
            brn: 'brn-d',
            title: 'Lidl Woche Nord',
            imageUrl: 'https://cdn.example/nord-d.jpg',
            ...sameMetadata,
          },
        ],
        '10000': [
          {
            brn: 'brn-b',
            title: 'Lidl Woche Süd',
            imageUrl: 'https://cdn.example/sued-b.jpg',
            ...sameMetadata,
          },
          {
            brn: 'brn-c',
            title: 'Lidl Woche Süd',
            imageUrl: 'https://cdn.example/sued-c.jpg',
            ...sameMetadata,
            validUntil: '2026-10-08',
          },
          {
            brn: 'brn-b',
            title: 'anderer Titel',
            imageUrl: 'https://cdn.example/another-url.jpg',
            ...sameMetadata,
          },
          {
            brn: 'brn-a',
            title: 'Lidl Woche Süd',
            imageUrl: 'https://cdn.example/sued-a.jpg',
            ...sameMetadata,
          },
        ],
      },
    },
    detailPages: {
      'brn-a': 2,
      'brn-b': 2,
      'brn-c': 3,
      'brn-d': 2,
    },
  };
}

describe('listing-only deduplication report', () => {
  it('inverts exact BRN availability and groups only by store, dates, and detail page count', () => {
    const { fullScan, detailPages } = makeListingFixture();

    expect(buildListingDedupReport(fullScan, detailPages)).toEqual({
      version: 1,
      scope: 'metadata-only',
      identity: {
        confirmed: false,
        metadataGroupsAreDownloadCandidates: true,
        metadataGroupsMaySkipDownloads: false,
      },
      totals: {
        rawSightings: 7,
        uniqueBrns: 4,
        metadataGroups: 2,
      },
      downloads: {
        global: {
          wouldDownloadBrns: 4,
          skippedBrns: 0,
          metadataCandidateGroups: 2,
          possibleBrnSavings: 2,
          repeatedSightings: 3,
        },
        local: {
          wouldDownloadBrns: 6,
          skippedBrns: 0,
          metadataCandidateGroups: 3,
          possibleBrnSavings: 3,
          repeatedSightings: 1,
        },
      },
      pageTotals: {
        rawSightings: 15,
        globalWouldDownload: 9,
        localWouldDownload: 13,
        globalMetadataCandidates: 5,
        localMetadataCandidates: 7,
      },
      availabilityByBrn: [
        { brn: 'brn-a', zipCodes: ['10000', '10100'] },
        { brn: 'brn-b', zipCodes: ['10000', '10100'] },
        { brn: 'brn-c', zipCodes: ['10000'] },
        { brn: 'brn-d', zipCodes: ['10100'] },
      ],
      groups: [
        {
          storeName: 'Lidl',
          validFrom: '2026-10-01',
          validUntil: '2026-10-07',
          detailPageCount: 2,
          brns: ['brn-a', 'brn-b', 'brn-d'],
          availableZipCodes: ['10000', '10100'],
          sightingCount: 5,
        },
        {
          storeName: 'Lidl',
          validFrom: '2026-10-01',
          validUntil: '2026-10-08',
          detailPageCount: 3,
          brns: ['brn-c'],
          availableZipCodes: ['10000'],
          sightingCount: 1,
        },
      ],
      byZipCode: [
        {
          zipCode: '10000',
          rawSightings: 4,
          uniqueBrns: 3,
          wouldDownloadBrns: 3,
          skippedBrns: 0,
          metadataCandidateGroups: 2,
          possibleBrnSavings: 1,
          repeatedSightings: 1,
          pageTotals: {
            rawSightings: 9,
            wouldDownload: 7,
            metadataCandidates: 5,
          },
        },
        {
          zipCode: '10100',
          rawSightings: 3,
          uniqueBrns: 3,
          wouldDownloadBrns: 3,
          skippedBrns: 0,
          metadataCandidateGroups: 1,
          possibleBrnSavings: 2,
          repeatedSightings: 0,
          pageTotals: {
            rawSightings: 6,
            wouldDownload: 6,
            metadataCandidates: 2,
          },
        },
      ],
    });
  });

  it('keeps output deterministic when ZIP and listing entry order changes', () => {
    const { fullScan, detailPages } = makeListingFixture();
    const reversed = {
      byZipCode: Object.fromEntries(
        Object.entries(fullScan.byZipCode)
          .reverse()
          .map(([zipCode, entries]) => [zipCode, [...entries].reverse()]),
      ),
    };

    expect(buildListingDedupReport(reversed, detailPages)).toEqual(
      buildListingDedupReport(fullScan, detailPages),
    );
  });

  it('requires a page count for every listed BRN and positive page counts', () => {
    expect(() =>
      buildListingDedupReport(
        { byZipCode: { '10000': [{ brn: 'brn-missing', storeName: 'Lidl', validFrom: 'a', validUntil: 'b' }] } },
        {},
      ),
    ).toThrow('Missing detail page count for BRN brn-missing');
    expect(() => buildListingDedupReport({ byZipCode: {} }, { 'brn-a': 0 })).toThrow(
      'Detail page count for BRN brn-a must be a positive integer',
    );
  });

  it('uses listing-only input paths by default and accepts fixture overrides', () => {
    expect(parseListingDedupReportArguments([])).toEqual({
      inputPath: 'tools/crawler/data/listing-only/all-stores-full.json',
      detailPagesPath: 'tools/crawler/data/listing-only/detail-pages.json',
      outputPath: 'tools/crawler/data/listing-only/listing-dedup-report.json',
    });
    expect(
      parseListingDedupReportArguments([
        '--input=fixtures/full.json',
        '--details=fixtures/details.json',
        '--output=fixtures/report.json',
      ]),
    ).toEqual({
      inputPath: 'fixtures/full.json',
      detailPagesPath: 'fixtures/details.json',
      outputPath: 'fixtures/report.json',
    });
  });
});
