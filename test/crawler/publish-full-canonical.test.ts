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

function persistedBrochure(sourceZipCode: string, imagePrefix: string): PersistedCanonicalBrochure {
  return {
    canonicalBrn: 'shared-brn',
    sourceZipCode,
    storeName: 'Fresh Market',
    storeId: 'fresh-market',
    title: 'October offers',
    validFrom: '2026-10-20',
    validUntil: '2026-10-27',
    pageCount: 1,
    availableZipCodes: [sourceZipCode],
    coverImage: source(`${imagePrefix}-cover`),
    pageUrls: [source(`${imagePrefix}-page-1`)],
    pages: [{ number: 1, imageUrl: source(`${imagePrefix}-page-1`), hotspots: [] }],
  };
}

const persisted = { brochures: [persistedBrochure('10115', 'berlin'), persistedBrochure('20095', 'hamburg')] };

describe('regional BRN publication', () => {
  it('publishes one regional row per listed ZIP/BRN pair', () => {
    const publication = buildFullPagePublication({ fullScan, persisted });

    expect(publication.scopedZipCodes).toEqual(['10115', '20095']);
    expect(publication.catalog).toHaveLength(2);
    expect(publication.catalog.map(({ id }) => id)).toEqual([
      'canonical:10115:shared-brn',
      'canonical:20095:shared-brn',
    ]);
    expect(publication.catalog.map(({ availableZipCodes }) => availableZipCodes)).toEqual([['10115'], ['20095']]);
    expect(publication.catalog[0]).toMatchObject({
      coverImage: source('berlin-cover'),
      pages: [{ number: 1, imageUrl: source('berlin-page-1') }],
    });
  });

  it('rejects incomplete national coverage and availability outside the listing scan', () => {
    expect(() => buildFullPagePublication({
      fullScan: { ...fullScan, completedLocations: 1 },
      persisted,
    })).toThrow('Full scan did not complete every postal code');

    const invalid = { brochures: [{ ...persistedBrochure('10115', 'berlin'), availableZipCodes: ['10115', '50667'] }] };
    expect(() => buildFullPagePublication({ fullScan, persisted: invalid }))
      .toThrow('ungültige oder nicht belegte PLZ-Verfügbarkeit');
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
