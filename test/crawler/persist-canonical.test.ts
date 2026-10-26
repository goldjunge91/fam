import { describe, expect, it } from '@jest/globals';
import {
  buildPersistedCanonicalBrochures,
  parsePersistCanonicalArguments,
} from '../../tools/crawler/brochures/listing-only/persist-canonical';

const pageUrl = 'https://cdn.bringapi.app/content/brn-a/page-1.jpg';
const fullScan = {
  totalLocations: 1,
  completedLocations: 1,
  byZipCode: {
    '10000': [{
      brn: 'brn-a',
      storeName: 'Lidl',
      title: 'Lidl Woche',
      validFrom: '2026-10-01',
      validUntil: '2026-10-07',
    }],
  },
};
const detailPageMetadata = {
  '10000:brn-a': {
    referenceKey: '10000:brn-a',
    brn: 'brn-a',
    zipCode: '10000',
    title: 'Lidl Woche',
    storeId: 'lidl',
    validFrom: '2026-10-01',
    validUntil: '2026-10-07',
    coverImage: 'https://cdn.bringapi.app/content/brn-a/cover.jpg',
    pageUrls: [pageUrl],
    pages: [{ number: 1, imageUrl: pageUrl, hotspots: [] }],
  },
};

describe('BRN-Prospektpersistenz', () => {
  it('persistiert eine vollständige Bring-Ausgabe mit Listing-Verfügbarkeit je PLZ', () => {
    expect(buildPersistedCanonicalBrochures({ fullScan, detailPageMetadata })).toEqual([
      {
        canonicalBrn: 'brn-a',
        sourceZipCode: '10000',
        storeName: 'Lidl',
        storeId: 'lidl',
        title: 'Lidl Woche',
        validFrom: '2026-10-01',
        validUntil: '2026-10-07',
        pageCount: 1,
        availableZipCodes: ['10000'],
        coverImage: 'https://cdn.bringapi.app/content/brn-a/cover.jpg',
        pageUrls: [pageUrl],
        pages: [{ number: 1, imageUrl: pageUrl, hotspots: [] }],
      },
    ]);
  });

  it('verhindert Veröffentlichung, wenn die Detailantwort für eine BRN fehlt', () => {
    expect(() => buildPersistedCanonicalBrochures({
      fullScan,
      detailPageMetadata: {},
    })).toThrow('Missing complete detail metadata for 10000:brn-a');
  });

  it('uses the complete page list from detail metadata when the listing contains only the cover', () => {
    const secondPageUrl = 'https://cdn.bringapi.app/content/brn-a/page-2.jpg';
    const partialListing = {
      ...fullScan,
      byZipCode: {
        '10000': [{ ...fullScan.byZipCode['10000']![0]!, pageCount: 1 }],
      },
    };
    const completeDetail = {
      ...detailPageMetadata,
      '10000:brn-a': {
        ...detailPageMetadata['10000:brn-a'],
        pageUrls: [pageUrl, secondPageUrl],
        pages: [
          { number: 1, imageUrl: pageUrl, hotspots: [] },
          { number: 2, imageUrl: secondPageUrl, hotspots: [] },
        ],
      },
    };

    const [brochure] = buildPersistedCanonicalBrochures({
      fullScan: partialListing,
      detailPageMetadata: completeDetail,
    });

    expect(brochure?.pages).toHaveLength(2);
    expect(brochure?.pageCount).toBe(2);
  });

  it('stores same BRN listings as separate regional detail records', () => {
    const secondZipScan = {
      ...fullScan,
      byZipCode: {
        ...fullScan.byZipCode,
        '20000': [{ ...fullScan.byZipCode['10000']![0]! }],
      },
    };

    const secondRegionPageUrl = 'https://cdn.bringapi.app/content/brn-a-20000/page-1.jpg';
    const regionalMetadata = {
      ...detailPageMetadata,
      '20000:brn-a': {
        ...detailPageMetadata['10000:brn-a'],
        referenceKey: '20000:brn-a',
        zipCode: '20000',
        coverImage: 'https://cdn.bringapi.app/content/brn-a-20000/cover.jpg',
        pageUrls: [secondRegionPageUrl],
        pages: [{ number: 1, imageUrl: secondRegionPageUrl, hotspots: [] }],
      },
    };

    expect(buildPersistedCanonicalBrochures({
      fullScan: secondZipScan,
      detailPageMetadata: regionalMetadata,
    })).toMatchObject([
      { canonicalBrn: 'brn-a', sourceZipCode: '10000', availableZipCodes: ['10000'], pages: [{ imageUrl: pageUrl }] },
      { canonicalBrn: 'brn-a', sourceZipCode: '20000', availableZipCodes: ['20000'], pages: [{ imageUrl: secondRegionPageUrl }] },
    ]);
  });

  it('rejects listing metadata conflicts for one BRN instead of combining editions', () => {
    const conflictingScan = {
      ...fullScan,
      byZipCode: {
        '10000': [
          ...fullScan.byZipCode['10000']!,
          { ...fullScan.byZipCode['10000']![0]!, title: 'Other edition' },
        ],
      },
    };

    expect(() => buildPersistedCanonicalBrochures({
      fullScan: conflictingScan,
      detailPageMetadata,
    })).toThrow('Bring-Listingmetadaten für 10000:brn-a unterscheiden sich');
  });

  it('weist nicht erlaubte Quell-URLs vor der Persistenz zurück', () => {
    expect(() => buildPersistedCanonicalBrochures({
      fullScan,
      detailPageMetadata: {
        ...detailPageMetadata,
        '10000:brn-a': {
          ...detailPageMetadata['10000:brn-a'],
          pageUrls: ['https://images.example.test/page.jpg'],
          pages: [{ number: 1, imageUrl: 'https://images.example.test/page.jpg', hotspots: [] }],
        },
      },
    })).toThrow('not an allowed Bring image URL');
  });

  it('verwendet regionale Eingabepfade als Standard', () => {
    expect(parsePersistCanonicalArguments([])).toEqual({
      inputPath: 'tools/crawler/data/listing-only/all-stores-full.json',
      detailPageMetadataPath: 'tools/crawler/data/listing-only/detail-page-metadata.json',
      outputPath: 'tools/crawler/data/listing-only/canonical-brochures.json',
    });
  });
});
