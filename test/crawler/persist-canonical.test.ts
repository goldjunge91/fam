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

describe('regionale Prospektpersistenz', () => {
  it('persistiert vollständige Details mit Original-URLs und regionaler Verfügbarkeit', () => {
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

  it('verhindert Veröffentlichung, wenn eine regionale Detailantwort fehlt', () => {
    expect(() => buildPersistedCanonicalBrochures({
      fullScan,
      detailPageMetadata: {},
    })).toThrow('Missing complete detail metadata for 10000:brn-a');
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
