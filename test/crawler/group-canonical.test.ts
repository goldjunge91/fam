import { describe, expect, it } from '@jest/globals';
import {
  groupCanonicalBrochures,
  parseGroupCanonicalArguments,
} from '../../tools/crawler/brochures/listing-only/group-canonical';

describe('canonical brochure grouping', () => {
  it('groups sightings by store, validity window, and detail page count', () => {
    const result = groupCanonicalBrochures(
      {
        byZipCode: {
          '10115': [
            {
              brn: 'brn-a',
              storeName: 'Lidl',
              validFrom: '2026-10-01',
              validUntil: '2026-10-07',
            },
            {
              brn: 'brn-b',
              storeName: 'Lidl',
              validFrom: '2026-10-01',
              validUntil: '2026-10-07',
            },
            {
              brn: 'brn-c',
              storeName: 'REWE',
              validFrom: '2026-10-01',
              validUntil: '2026-10-07',
            },
            {
              brn: 'brn-d',
              storeName: 'Lidl',
              validFrom: '2026-10-02',
              validUntil: '2026-10-07',
            },
            {
              brn: 'brn-e',
              storeName: 'Lidl',
              validFrom: '2026-10-01',
              validUntil: '2026-10-08',
            },
            {
              brn: 'brn-f',
              storeName: 'Lidl',
              validFrom: '2026-10-01',
              validUntil: '2026-10-07',
            },
          ],
          '10117': [
            {
              brn: 'brn-a',
              storeName: 'Lidl',
              validFrom: '2026-10-01',
              validUntil: '2026-10-07',
            },
          ],
        },
      },
      {
        'brn-a': 8,
        'brn-b': 8,
        'brn-c': 8,
        'brn-d': 8,
        'brn-e': 8,
        'brn-f': 9,
      },
    );

    expect(result).toEqual({
      naiveSightingCount: 7,
      groupedSightingCount: 7,
      groups: [
        {
          storeName: 'Lidl',
          validFrom: '2026-10-01',
          validUntil: '2026-10-07',
          detailPageCount: 8,
          brns: ['brn-a', 'brn-b'],
          availableZipCodes: ['10115', '10117'],
          sightingCount: 3,
        },
        {
          storeName: 'Lidl',
          validFrom: '2026-10-01',
          validUntil: '2026-10-07',
          detailPageCount: 9,
          brns: ['brn-f'],
          availableZipCodes: ['10115'],
          sightingCount: 1,
        },
        {
          storeName: 'Lidl',
          validFrom: '2026-10-01',
          validUntil: '2026-10-08',
          detailPageCount: 8,
          brns: ['brn-e'],
          availableZipCodes: ['10115'],
          sightingCount: 1,
        },
        {
          storeName: 'Lidl',
          validFrom: '2026-10-02',
          validUntil: '2026-10-07',
          detailPageCount: 8,
          brns: ['brn-d'],
          availableZipCodes: ['10115'],
          sightingCount: 1,
        },
        {
          storeName: 'REWE',
          validFrom: '2026-10-01',
          validUntil: '2026-10-07',
          detailPageCount: 8,
          brns: ['brn-c'],
          availableZipCodes: ['10115'],
          sightingCount: 1,
        },
      ],
    });
  });

  it('fails with the missing BRN when detail page counts are incomplete', () => {
    expect(() =>
      groupCanonicalBrochures(
        {
          byZipCode: {
            '10115': [
              {
                brn: 'brn-missing',
                storeName: 'Lidl',
                validFrom: '2026-10-01',
                validUntil: '2026-10-07',
              },
            ],
          },
        },
        {},
      ),
    ).toThrow('Missing detail page count for BRN brn-missing');
  });

  it('rejects zero or invalid detail page counts', () => {
    expect(() => groupCanonicalBrochures({ byZipCode: {} }, { 'brn-a': 0 })).toThrow(
      'Detail page count for BRN brn-a must be a positive integer',
    );
  });

  it('uses the canonical input paths by default and accepts fixture paths', () => {
    expect(parseGroupCanonicalArguments([])).toEqual({
      inputPath: 'tools/crawler/data/listing-only/all-stores-full.json',
      detailPagesPath: 'tools/crawler/data/listing-only/detail-pages.json',
      outputPath: 'tools/crawler/data/listing-only/canonical-groups.json',
    });
    expect(
      parseGroupCanonicalArguments([
        '--input=fixture/full.json',
        '--details=fixture/details.json',
        '--output=fixture/groups.json',
      ]),
    ).toEqual({
      inputPath: 'fixture/full.json',
      detailPagesPath: 'fixture/details.json',
      outputPath: 'fixture/groups.json',
    });
  });
});
