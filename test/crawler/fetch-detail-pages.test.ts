import { describe, expect, it } from '@jest/globals';
import {
  buildBrnReferences,
  pageCountFromDetail,
  summarizeDetailPages,
} from '../../tools/crawler/brochures/listing-only/fetch-detail-pages';

describe('fetch-detail-pages', () => {
  it('schedules one deterministic detail request per BRN', () => {
    const references = buildBrnReferences(
      {
        byZipCode: {
          '22222': [{ brn: 'brn-b' }, { brn: 'brn-a' }],
          '11111': [{ brn: 'brn-a' }],
        },
      },
      [
        { zipCode: '22222', latitude: 2, longitude: 2 },
        { zipCode: '11111', latitude: 1, longitude: 1 },
      ],
    );

    expect(references).toEqual([
      { brn: 'brn-a', zipCode: '11111', latitude: 1, longitude: 1 },
      { brn: 'brn-b', zipCode: '22222', latitude: 2, longitude: 2 },
    ]);
  });

  it('rejects an offer location with no matching coordinates', () => {
    expect(() =>
      buildBrnReferences(
        { byZipCode: { '11111': [{ brn: 'brn-a' }] } },
        [],
      ),
    ).toThrow('Keine Koordinaten für PLZ 11111');
  });

  it('counts detail pages only from a usable Bring detail response', () => {
    expect(pageCountFromDetail({ pages: [{}, {}, {}] })).toBe(3);
    expect(() => pageCountFromDetail({ pages: [] })).toThrow('keine Seiten');
  });

  it('summarizes the fraction of BRNs with multiple detail pages', () => {
    expect(summarizeDetailPages({ 'brn-a': 8, 'brn-b': 1, 'brn-c': 4 })).toEqual({
      totalBrns: 3,
      multiplePageBrns: 2,
      multiplePagePercent: 66.7,
    });
  });
});
