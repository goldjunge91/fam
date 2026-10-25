import { describe, expect, it, jest } from '@jest/globals';
import {
  buildFullPagePublication,
  publishCanonicalPublication,
} from '../../tools/crawler/brochures/listing-only/publish-full-canonical';
import type { PersistedCanonicalBrochure } from '../../tools/crawler/brochures/listing-only/persist-canonical';

const fullScan = {
  totalLocations: 2,
  completedLocations: 2,
  byZipCode: {
    '10115': [{
      brn: 'shared-brn',
      storeName: 'Fresh Market',
      title: 'Berlin Angebote',
      validFrom: '2026-10-20',
      validUntil: '2026-10-27',
    }],
    '20095': [{
      brn: 'shared-brn',
      storeName: 'Fresh Market',
      title: 'Hamburg Angebote',
      validFrom: '2026-10-20',
      validUntil: '2026-10-27',
    }],
  },
};

const source = (name: string) => `https://offerscdn.bringapi.app/content/${name}.jpg`;

function persistedBrochure(zipCode: string, title: string): PersistedCanonicalBrochure {
  return {
    canonicalBrn: 'shared-brn',
    sourceZipCode: zipCode,
    storeName: 'Fresh Market',
    storeId: 'fresh-market',
    title,
    validFrom: '2026-10-20',
    validUntil: '2026-10-27',
    pageCount: 1,
    availableZipCodes: [zipCode],
    coverImage: source(`${zipCode}-cover`),
    pageUrls: [source(`${zipCode}-page-1`)],
    pages: [{ number: 1, imageUrl: source(`${zipCode}-page-1`), hotspots: [] }],
  };
}

const persisted = {
  brochures: [persistedBrochure('10115', 'Berlin Angebote'), persistedBrochure('20095', 'Hamburg Angebote')],
};

describe('regional brochure publication', () => {
  it('keeps the same BRN separate by source ZIP and preserves the independent cover URL', () => {
    const publication = buildFullPagePublication({ fullScan, persisted });

    expect(publication.scopedZipCodes).toEqual(['10115', '20095']);
    expect(publication.catalog).toHaveLength(2);
    expect(publication.catalog.map(({ id }) => id)).toEqual([
      'canonical:["10115","shared-brn"]',
      'canonical:["20095","shared-brn"]',
    ]);
    expect(publication.catalog.map(({ availableZipCodes }) => availableZipCodes)).toEqual([
      ['10115'],
      ['20095'],
    ]);
    expect(publication.catalog[0]).toMatchObject({
      coverImage: source('10115-cover'),
      pages: [{ number: 1, imageUrl: source('10115-page-1') }],
    });
  });

  it('rejects incomplete national coverage and availability outside the source ZIP', () => {
    expect(() => buildFullPagePublication({
      fullScan: { ...fullScan, completedLocations: 1 },
      persisted,
    })).toThrow('Full scan did not complete every postal code');

    const invalid = {
      brochures: [
        { ...persistedBrochure('10115', 'Berlin Angebote'), availableZipCodes: ['10115', '20095'] },
        persistedBrochure('20095', 'Hamburg Angebote'),
      ],
    };
    expect(() => buildFullPagePublication({ fullScan, persisted: invalid }))
      .toThrow('contains availability outside its source region');
  });

  it('publishes metadata through Supabase without uploading image bytes', async () => {
    const publication = buildFullPagePublication({ fullScan, persisted });
    const uploadCanonicalCatalog = jest.fn(async () => ({ uploadedCount: 2, storesCount: 1 }));
    const config = { supabaseUrl: 'https://example.supabase.co', supabaseSecretKey: 'secret' };

    const result = await publishCanonicalPublication(publication, config, { uploadCanonicalCatalog });

    expect(uploadCanonicalCatalog).toHaveBeenCalledWith(
      publication.catalog,
      publication.stores,
      ['10115', '20095'],
      config,
    );
    expect(result).toMatchObject({
      status: 'COMPLETE',
      uploadedAssetCount: 0,
      reusedAssetCount: 0,
      catalogResult: { uploadedCount: 2, storesCount: 1 },
    });
  });
});
