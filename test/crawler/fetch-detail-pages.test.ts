import { describe, expect, it, jest } from '@jest/globals';
import {
  buildBrnReferences,
  buildOffersByRegionalReference,
  fetchJsonWithRetry,
  loadReusableDetailMetadata,
  pageMetadataFromDetail,
  pageCountFromDetail,
  reusableDetailMetadataFromCatalog,
  summarizeDetailPages,
} from '../../tools/crawler/brochures/listing-only/fetch-detail-pages';

describe('fetch-detail-pages', () => {
  it('schedules one deterministic detail request per regional BRN reference', () => {
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
      { brn: 'brn-a', referenceKey: '11111:brn-a', zipCode: '11111', latitude: 1, longitude: 1 },
      { brn: 'brn-a', referenceKey: '22222:brn-a', zipCode: '22222', latitude: 2, longitude: 2 },
      { brn: 'brn-b', referenceKey: '22222:brn-b', zipCode: '22222', latitude: 2, longitude: 2 },
    ]);
  });

  it('keeps region-specific listing metadata for the same BRN separate', () => {
    expect([...buildOffersByRegionalReference({
      byZipCode: {
        '11111': [{ brn: 'brn-a', title: 'Edition one' }],
        '22222': [{ brn: 'brn-a', title: 'Edition two' }],
      },
    })]).toEqual([
      ['11111:brn-a', { brn: 'brn-a', title: 'Edition one' }],
      ['22222:brn-a', { brn: 'brn-a', title: 'Edition two' }],
    ]);
  });

  it('rejects conflicting repeated listings for the same ZIP and BRN', () => {
    expect(() => buildOffersByRegionalReference({
      byZipCode: {
        '11111': [{ brn: 'brn-a', title: 'Edition one' }, { brn: 'brn-a', title: 'Edition two' }],
      },
    })).toThrow('Bring-Listingmetadaten für 11111:brn-a unterscheiden sich');
  });

  it('rejects an offer location with no matching coordinates', () => {
    expect(() =>
      buildBrnReferences(
        { byZipCode: { '11111': [{ brn: 'brn-a' }] } },
        [],
      ),
    ).toThrow('Keine Koordinaten für PLZ 11111');
  });

  it('reuses valid catalog details only for the matching source ZIP and BRN', async () => {
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
      source_zip_code: '10115',
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
      offersByReference: new Map([[reference.referenceKey, {
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
      expect.stringContaining('or=%28and%28canonical_brn.eq.'),
      expect.objectContaining({
        headers: expect.objectContaining({ apikey: 'service-key' }),
      }),
    );
  });

  it('does not reuse catalog detail metadata from a different ZIP', () => {
    const reference = buildBrnReferences(
      { byZipCode: { '10115': [{ brn: 'brn-a' }] } },
      [{ zipCode: '10115', latitude: 1, longitude: 2 }],
    )[0]!;
    expect(reusableDetailMetadataFromCatalog({
      reference,
      offer: {
        brn: 'brn-a', title: 'Lidl Woche', storeName: 'Lidl',
        validFrom: '2026-10-01', validUntil: '2099-10-07',
      },
      row: {
        canonical_brn: 'brn-a', source_zip_code: '20095', title: 'Lidl Woche', store_id: 'lidl',
        valid_from: '2026-10-01T00:00:00.000Z', valid_until: '2099-10-07T00:00:00.000Z',
        page_count: 1, cover_image: 'https://cdn.bringapi.app/content/brn-a/page-1.jpg',
        pages: [{ number: 1, imageUrl: 'https://cdn.bringapi.app/content/brn-a/page-1.jpg', hotspots: [] }],
      },
    })).toBeUndefined();
  });

  it('reuses a valid page-one cover when the listing cover is outside the Bring CDN', () => {
    const reference = buildBrnReferences(
      { byZipCode: { '10115': [{ brn: 'brn-a' }] } },
      [{ zipCode: '10115', latitude: 1, longitude: 2 }],
    )[0]!;
    const coverImage = 'https://cdn.bringapi.app/content/brn-a/page-1.jpg';
    const metadata = reusableDetailMetadataFromCatalog({
      reference,
      offer: {
        brn: 'brn-a',
        title: 'Lidl Woche',
        storeName: 'Lidl',
        validFrom: '2026-10-01',
        validUntil: '2099-10-07',
        coverImage: 'https://images.example.com/cover.jpg',
      },
      row: {
        canonical_brn: 'brn-a',
        source_zip_code: '10115',
        title: 'Lidl Woche',
        store_id: 'lidl',
        valid_from: '2026-10-01T00:00:00.000Z',
        valid_until: '2099-10-07T00:00:00.000Z',
        page_count: 1,
        cover_image: coverImage,
        pages: [{ number: 1, imageUrl: coverImage, hotspots: [] }],
        store: { name: 'Lidl' },
      },
      now: new Date('2026-10-25T00:00:00Z'),
    });

    expect(metadata?.coverImage).toBe(coverImage);
  });

  it('skips detail cache reads when no brochure metadata is published yet', async () => {
    const reference = buildBrnReferences(
      { byZipCode: { '10115': [{ brn: 'brn-a' }] } },
      [{ zipCode: '10115', latitude: 1, longitude: 2 }],
    )[0]!;
    const fetcher = jest.fn(async () => new Response('[]', { status: 200 }));

    const reusable = await loadReusableDetailMetadata({
      references: [reference],
      offersByReference: new Map([[reference.referenceKey, { brn: 'brn-a' }]]),
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

  it('uses the first page as cover when Bring listing cover is outside the allowed CDN', () => {
    const reference = buildBrnReferences(
      { byZipCode: { '10115': [{ brn: 'brn-a' }] } },
      [{ zipCode: '10115', latitude: 1, longitude: 2 }],
    )[0]!;
    const firstPageUrl = 'https://cdn.bringapi.app/content/brn-a/page-1.jpg';

    const metadata = pageMetadataFromDetail(
      reference,
      {
        brn: 'brn-a',
        storeName: 'Lidl',
        title: 'Lidl Woche',
        validFrom: '2026-10-01',
        validUntil: '2026-10-07',
        coverImage: 'https://images.example.com/cover.jpg',
      },
      { pages: [{ image: firstPageUrl }, { image: 'https://cdn.bringapi.app/content/brn-a/page-2.jpg' }] },
    );

    expect(metadata.coverImage).toBe(firstPageUrl);
  });

  it('summarizes the fraction of regional references with multiple detail pages', () => {
    expect(summarizeDetailPages({ '11111:brn-a': 8, '11111:brn-b': 1, '22222:brn-a': 4 })).toEqual({
      totalRegionalReferences: 3,
      multiplePageReferences: 2,
      multiplePagePercent: 66.7,
    });
  });

  it('retries a temporarily forbidden detail response after a cooldown', async () => {
    const fetchMock = jest.spyOn(global, 'fetch')
      .mockResolvedValueOnce(new Response('Forbidden', { status: 403 }))
      .mockResolvedValueOnce(new Response('{"pages":[]}', { status: 200 }));
    jest.useFakeTimers();

    try {
      const response = fetchJsonWithRetry('https://bring.example/brochure', {});
      await Promise.resolve();
      await jest.advanceTimersByTimeAsync(5_000);

      await expect(response).resolves.toEqual({ pages: [] });
      expect(fetchMock).toHaveBeenCalledTimes(2);
    } finally {
      fetchMock.mockRestore();
      jest.useRealTimers();
    }
  });
});
