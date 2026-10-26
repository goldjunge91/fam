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

describe('BRN-Prospektkatalog', () => {
  it('speichert eine BRN-Ausgabe und verknüpft jede gelistete PLZ', () => {
    const catalog = buildCanonicalCatalog([
      dump('10000', [brochure('brn-a')]),
      dump('20000', [brochure('brn-a')]),
    ]);

    expect(catalog).toHaveLength(1);
    expect(catalog[0]).toMatchObject({
      id: 'canonical:brn-a',
      canonicalBrn: 'brn-a',
      sourceZipCode: '10000',
      availableZipCodes: ['10000', '20000'],
    });
  });

  it('dedupliziert identische Wiederholungen innerhalb und zwischen ZIPs', () => {
    const catalog = buildCanonicalCatalog([dump('10000', [brochure('brn-a'), brochure('brn-a')])]);

    expect(catalog).toHaveLength(1);
  });

  it('verhindert widersprüchliche Detaildaten derselben BRN in verschiedenen ZIPs', () => {
    expect(() =>
      buildCanonicalCatalog([
        dump('10000', [brochure('brn-a')]),
        dump('20000', [brochure('brn-a', 'Andere Ausgabe')]),
      ]),
    ).toThrow('conflicting detail metadata across ZIP codes');
  });

  it('akzeptiert nur die validierten Bring-Quell-URLs', () => {
    expect(() => buildCanonicalCatalog([dump('10000', [{
      ...brochure('brn-a'),
      coverImage: 'https://images.example.test/cover.jpg',
    }])])).toThrow('not an allowed Bring image URL');
  });
});
