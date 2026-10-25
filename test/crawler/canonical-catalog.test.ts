import { describe, expect, it } from '@jest/globals';
import { buildCanonicalCatalog } from '../../tools/crawler/brochures/listing-only/canonical-catalog';

const validFrom = '2026-10-01T00:00:00.000Z';
const validUntil = '2026-10-07T23:59:59.000Z';

function brochure(id: string, title = 'Lidl Woche') {
  const pageUrl = `https://cdn.bringapi.app/content/${id}/page-1.jpg`;
  return {
    id,
    storeId: 'lidl',
    title,
    validFrom,
    validUntil,
    coverImage: `https://cdn.bringapi.app/content/${id}/cover.jpg`,
    pages: [{ number: 1, imageUrl: pageUrl, hotspots: [] }],
  };
}

function dump(zipCode: string, brochures: ReturnType<typeof brochure>[]) {
  return {
    location: { zipCode, latitude: 52, longitude: 13 },
    stores: [{ id: 'lidl', name: 'Lidl' }],
    brochures,
  };
}

describe('regionaler Prospektkatalog', () => {
  it('hält dieselbe BRN in unterschiedlichen PLZ als getrennte Ausgaben', () => {
    const catalog = buildCanonicalCatalog([
      dump('10000', [brochure('brn-a', 'Lidl Nord')]),
      dump('20000', [brochure('brn-a', 'Lidl Süd')]),
    ]);

    expect(catalog).toHaveLength(2);
    expect(catalog.map(({ canonicalBrn }) => canonicalBrn)).toEqual(['brn-a', 'brn-a']);
    expect(catalog.map(({ sourceZipCode }) => sourceZipCode)).toEqual(['10000', '20000']);
    expect(catalog.map(({ availableZipCodes }) => availableZipCodes)).toEqual([
      ['10000'],
      ['20000'],
    ]);
    expect(catalog[0]?.id).toBe(`canonical:${JSON.stringify(['10000', 'brn-a'])}`);
  });

  it('dedupliziert identische Wiederholungen innerhalb derselben regionalen Referenz', () => {
    const catalog = buildCanonicalCatalog([dump('10000', [brochure('brn-a'), brochure('brn-a')])]);

    expect(catalog).toHaveLength(1);
  });

  it('verhindert widersprüchliche Detaildaten derselben regionalen Referenz', () => {
    expect(() =>
      buildCanonicalCatalog([dump('10000', [brochure('brn-a'), brochure('brn-a', 'Andere Ausgabe')])]),
    ).toThrow('conflicting detail metadata');
  });

  it('akzeptiert nur die validierten Bring-Quell-URLs', () => {
    expect(() => buildCanonicalCatalog([dump('10000', [{
      ...brochure('brn-a'),
      coverImage: 'https://images.example.test/cover.jpg',
    }])])).toThrow('not an allowed Bring image URL');
  });
});
