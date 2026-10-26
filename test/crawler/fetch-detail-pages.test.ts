import { describe, expect, it, jest } from '@jest/globals';
import {
  buildBrnReferences,
  buildOffersByBrn,
  loadReusableDetailMetadata,
  pageMetadataFromDetail,
  pageCountFromDetail,
  summarizeDetailPages,
} from '../../tools/crawler/brochures/listing-only/fetch-detail-pages';

describe('fetch-detail-pages', () => {
  it('schedules one deterministic detail request per unique BRN', () => {
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
      { brn: 'brn-a', referenceKey: 'brn-a', zipCode: '11111', latitude: 1, longitude: 1 },
      { brn: 'brn-b', referenceKey: 'brn-b', zipCode: '22222', latitude: 2, longitude: 2 },
    ]);
  });

  it('rejects conflicting listing metadata for one BRN before reusing one detail response', () => {
    expect(() => buildOffersByBrn({
      byZipCode: {
        '11111': [{ brn: 'brn-a', title: 'Edition one' }],
        '22222': [{ brn: 'brn-a', title: 'Edition two' }],
      },
    })).toThrow('Bring-Listingmetadaten für brn-a unterscheiden sich');
  });

  it('rejects an offer location with no matching coordinates', () => {
    expect(() =>
      buildBrnReferences(
        { byZipCode: { '11111': [{ brn: 'brn-a' }] } },
        [],
      ),
    ).toThrow('Keine Koordinaten für PLZ 11111');
  });

  it('reuses valid catalog details by BRN without requiring a source ZIP match', async () => {
    const reference = buildBrnReferences(
      {
        byZipCode: {
          '10115': [{
            brn: 'brn-a', title: 'Lidl Woche', storeName: 'Lidl',
            validFrom: '2026-10-01', validUntil: '2099-10-07',
            coverImage: 'https://cdn.bringapi.app/content/brn-a/cover.jpg',
          }],
        },
      },
      [{ zipCode: '10115', latitude: 1, longitude: 2 }],
    )[0]!;
    const fetcher = jest.fn(async () => new Response(JSON.stringify([{
      canonical_brn: 'brn-a',
      title: 'Lidl Woche',
      store_id: 'lidl',
      valid_from: '2026-10-01T00:00:00.000Z',
      valid_until: '2099-10-07T00:00:00.000Z',
      page_count: 2,
      cover_image: 'https://cdn.bringapi.app/content/brn-a/cover.jpg',
      pages: [
        { number: 1, imageUrl: 'https://cdn.bringapi.app/content/brn-a/page-1.jpg', hotspots: [] },
        { number: 2, imageUrl: 'https://cdn.bringapi.app/content/brn-a/page-2.jpg', hotspots: [] },
      ],
      store: { name: 'Lidl' },
    }]), { status: 200 }));

    const reusable = await loadReusableDetailMetadata({
      references: [reference],
      offersByBrn: new Map([[reference.brn, {
        brn: 'brn-a', title: 'Lidl Woche', storeName: 'Lidl',
        validFrom: '2026-10-01', validUntil: '2099-10-07',
        coverImage: 'https://cdn.bringapi.app/content/brn-a/cover.jpg',
      }]]),
      supabaseUrl: 'https://supabase.example',
      supabaseSecretKey: 'service-key',
      fetcher,
      now: new Date('2026-10-25T00:00:00Z'),
    });

    expect(reusable[reference.referenceKey]?.pages).toHaveLength(2);
    expect(reusable[reference.referenceKey]?.coverImage).toBe('https://cdn.bringapi.app/content/brn-a/cover.jpg');
    expect(fetcher).toHaveBeenCalledWith(
      expect.stringContaining('canonical_brn=in.'),
      expect.objectContaining({
        headers: expect.objectContaining({ apikey: 'service-key' }),
      }),
    );
  });

  it('skips detail cache reads when no brochure metadata is published yet', async () => {
    const reference = buildBrnReferences(
      { byZipCode: { '10115': [{ brn: 'brn-a' }] } },
      [{ zipCode: '10115', latitude: 1, longitude: 2 }],
    )[0]!;
    const fetcher = jest.fn(async () => new Response('[]', { status: 200 }));

    const reusable = await loadReusableDetailMetadata({
      references: [reference],
      offersByBrn: new Map([[reference.brn, { brn: 'brn-a' }]]),
      supabaseUrl: 'https://supabase.example',
      supabaseSecretKey: 'service-key',
      fetcher,
    });

    expect(reusable).toEqual({});
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('counts detail pages only from a usable Bring detail response', () => {
    expect(pageCountFromDetail({ pages: [{}, {}, {}] })).toBe(3);
    expect(() => pageCountFromDetail({ pages: [] })).toThrow('keine Seiten');
  });

  it('uses full page URLs from detail JSON when the listing contains only the cover', () => {
    const reference = buildBrnReferences(
      { byZipCode: { '10115': [{ brn: 'brn-a' }] } },
      [{ zipCode: '10115', latitude: 1, longitude: 2 }],
    )[0]!;
    const pageUrls = [
      'https://cdn.bringapi.app/content/brn-a/page-1.jpg',
      'https://cdn.bringapi.app/content/brn-a/page-2.jpg',
    ];

    const metadata = pageMetadataFromDetail(
      reference,
      {
        brn: 'brn-a',
        storeName: 'Lidl',
        title: 'Lidl Woche',
        validFrom: '2026-10-01',
        validUntil: '2026-10-07',
        coverImage: 'https://cdn.bringapi.app/content/brn-a/cover.jpg',
      },
      { pages: pageUrls.map((url) => ({ image: url })) },
    );

    expect(metadata.pages.map(({ imageUrl }) => imageUrl)).toEqual(pageUrls);
  });

  it('summarizes the fraction of unique BRNs with multiple detail pages', () => {
    expect(summarizeDetailPages({ 'brn-a': 8, 'brn-b': 1, 'brn-c': 4 })).toEqual({
      totalBrns: 3,
      multiplePageBrns: 2,
      multiplePagePercent: 66.7,
    });
  });
});
