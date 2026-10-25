import { describe, expect, it } from '@jest/globals';
import {
  groupCanonicalBrochures,
  parseGroupCanonicalArguments,
} from '../../tools/crawler/brochures/listing-only/group-canonical';

describe('regionale Prospektgruppierung', () => {
  it('trennt dieselbe BRN in zwei PLZ trotz gleicher Metadaten', () => {
    const result = groupCanonicalBrochures(
      {
        byZipCode: {
          '10115': [{ brn: 'brn-a', storeName: 'Lidl', validFrom: '2026-10-01', validUntil: '2026-10-07' }],
          '10117': [{ brn: 'brn-a', storeName: 'Lidl', validFrom: '2026-10-01', validUntil: '2026-10-07' }],
        },
      },
      { '10115:brn-a': 8, '10117:brn-a': 8 },
    );

    expect(result.naiveSightingCount).toBe(2);
    expect(result.groups).toHaveLength(2);
    expect(result.groups.map(({ availableZipCodes, brns }) => [availableZipCodes, brns])).toEqual([
      [['10115'], ['brn-a']],
      [['10117'], ['brn-a']],
    ]);
  });

  it('meldet fehlende regionale Detaildaten mit dem vollständigen Schlüssel', () => {
    expect(() => groupCanonicalBrochures(
      {
        byZipCode: {
          '10115': [{ brn: 'brn-missing', storeName: 'Lidl', validFrom: '2026-10-01', validUntil: '2026-10-07' }],
        },
      },
      {},
    )).toThrow('Missing detail page count for regional reference 10115:brn-missing');
  });

  it('verwendet die regionalen Eingabepfade als Standard', () => {
    expect(parseGroupCanonicalArguments([])).toEqual({
      inputPath: 'tools/crawler/data/listing-only/all-stores-full.json',
      detailPagesPath: 'tools/crawler/data/listing-only/detail-pages.json',
      outputPath: 'tools/crawler/data/listing-only/canonical-groups.json',
    });
  });
});
