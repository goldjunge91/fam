import { describe, expect, it, jest } from '@jest/globals';
import {
  buildBrnReferences,
  loadReusableDetailMetadata,
  pageCountFromDetail,
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

  it('rejects an offer location with no matching coordinates', () => {
    expect(() =>
      buildBrnReferences(
        { byZipCode: { '11111': [{ brn: 'brn-a' }] } },
        [],
      ),
    ).toThrow('Keine Koordinaten für PLZ 11111');
  });

  it('reuses valid catalog details only for the same regional reference', async () => {
    const reference = buildBrnReferences(
      {
        byZipCode: {
          '10115': [{
            brn: 'brn-a', title: 'Lidl Woche', storeName: 'Lidl',
            validFrom: '2026-10-01', validUntil: '2099-10-07',
            pageCount: 1,
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
      page_count: 1,
      cover_image: 'https://cdn.bringapi.app/content/brn-a/cover.jpg',
      pages: [{ number: 1, imageUrl: 'https://cdn.bringapi.app/content/brn-a/page-1.jpg', hotspots: [] }],
      store: { name: 'Lidl' },
    }]), { status: 200 }));

    const reusable = await loadReusableDetailMetadata({
      references: [reference],
      offersByReference: new Map([[reference.referenceKey, {
        brn: 'brn-a', title: 'Lidl Woche', storeName: 'Lidl',
        validFrom: '2026-10-01', validUntil: '2099-10-07',
        pageCount: 1,
        coverImage: 'https://cdn.bringapi.app/content/brn-a/cover.jpg',
      }]]),
      supabaseUrl: 'https://supabase.example',
      supabaseSecretKey: 'service-key',
      fetcher,
      now: new Date('2026-10-25T00:00:00Z'),
    });

    expect(reusable[reference.referenceKey]?.pages).toHaveLength(1);
    expect(reusable[reference.referenceKey]?.coverImage).toBe('https://cdn.bringapi.app/content/brn-a/cover.jpg');
    expect(fetcher).toHaveBeenCalledWith(
      expect.stringContaining('source_zip_code=eq.10115'),
      expect.objectContaining({
        headers: expect.objectContaining({ apikey: 'service-key' }),
      }),
    );
  });

  it('skips per-region catalog reads when no brochure metadata is cached yet', async () => {
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

  it('summarizes the fraction of regional references with multiple detail pages', () => {
    expect(summarizeDetailPages({ '10115:brn-a': 8, '10115:brn-b': 1, '20095:brn-a': 4 })).toEqual({
      totalBrns: 3,
      multiplePageBrns: 2,
      multiplePagePercent: 66.7,
    });
  });
});
