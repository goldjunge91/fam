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
      title: 'October offers',
      validFrom: '2026-10-20',
      validUntil: '2026-10-27',
    }],
    '20095': [{
      brn: 'shared-brn',
      storeName: 'Fresh Market',
      title: 'October offers',
      validFrom: '2026-10-20',
      validUntil: '2026-10-27',
    }],
  },
};

const source = (name: string) => `https://offerscdn.bringapi.app/content/${name}.jpg`;

function persistedBrochure(): PersistedCanonicalBrochure {
  return {
    canonicalBrn: 'shared-brn',
    sourceZipCode: '10115',
    storeName: 'Fresh Market',
    storeId: 'fresh-market',
    title: 'October offers',
    validFrom: '2026-10-20',
    validUntil: '2026-10-27',
    pageCount: 1,
    availableZipCodes: ['10115', '20095'],
    coverImage: source('shared-cover'),
    pageUrls: [source('shared-page-1')],
    pages: [{ number: 1, imageUrl: source('shared-page-1'), hotspots: [] }],
  };
}

const persisted = { brochures: [persistedBrochure()] };

describe('unique BRN publication', () => {
  it('publishes one BRN while preserving each ZIP association from the scan', () => {
    const publication = buildFullPagePublication({ fullScan, persisted });

    expect(publication.scopedZipCodes).toEqual(['10115', '20095']);
    expect(publication.catalog).toHaveLength(1);
    expect(publication.catalog.map(({ id }) => id)).toEqual(['canonical:shared-brn']);
    expect(publication.catalog[0]?.availableZipCodes).toEqual(['10115', '20095']);
    expect(publication.catalog[0]).toMatchObject({
      coverImage: source('shared-cover'),
      pages: [{ number: 1, imageUrl: source('shared-page-1') }],
    });
  });

  it('rejects incomplete national coverage and availability outside the listing scan', () => {
    expect(() => buildFullPagePublication({
      fullScan: { ...fullScan, completedLocations: 1 },
      persisted,
    })).toThrow('Full scan did not complete every postal code');

    const invalid = { brochures: [{ ...persistedBrochure(), availableZipCodes: ['10115', '50667'] }] };
    expect(() => buildFullPagePublication({ fullScan, persisted: invalid }))
      .toThrow('ungültige oder nicht belegte PLZ-Verfügbarkeit');
  });

  it('publishes metadata through Supabase without uploading image bytes', async () => {
    const publication = buildFullPagePublication({ fullScan, persisted });
    const uploadCanonicalCatalog = jest.fn(async () => ({ uploadedCount: 1, storesCount: 1 }));
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
      catalogResult: { uploadedCount: 1, storesCount: 1 },
    });
  });
});
