import { describe, expect, it, jest } from '@jest/globals';
import type { SupabaseClient } from '@supabase/supabase-js';
import { publishCanonicalCatalog } from '../../tools/crawler/brochures/uploader';
import type { CanonicalCatalogRecord } from '../../tools/crawler/brochures/listing-only/canonical-catalog';

const record: CanonicalCatalogRecord = {
  id: 'canonical:brn-1',
  canonicalBrn: 'brn-1',
  sourceZipCode: '10000',
  storeId: 'lidl',
  title: 'Lidl Woche',
  validFrom: '2026-10-01T00:00:00Z',
  validUntil: '2026-10-07T23:59:59Z',
  pageCount: 1,
  coverImage: 'https://cdn.bringapi.app/content/brn-1/cover.jpg',
  pages: [
    {
      number: 1,
      imageUrl: 'https://cdn.bringapi.app/content/brn-1/page-1.jpg',
      hotspots: [{ kind: 'discount', id: 'offer-1', x: 1, y: 2, width: 3, height: 4, title: 'Kaffee' }],
    },
  ],
  availableZipCodes: ['10000'],
};

describe('canonical brochure publication', () => {
  it('upserts store metadata then atomically replaces the complete catalog', async () => {
    const storeUpsert = jest.fn(async () => ({ error: null }));
    const from = jest.fn(() => ({ upsert: storeUpsert }));
    const rpc = jest.fn(async () => ({ data: null, error: null }));
    const client = { from, rpc } as unknown as SupabaseClient;

    await expect(
      publishCanonicalCatalog(
        client,
        [record],
        [{ id: 'lidl', name: 'Lidl', logoUrl: null }],
        ['10000', '10100'],
      ),
    ).resolves.toEqual({ uploadedCount: 1, storesCount: 1 });

    expect(from).toHaveBeenCalledWith('brochure_stores');
    expect(storeUpsert).toHaveBeenCalledWith(
      [{ id: 'lidl', name: 'Lidl', active: true }],
      { onConflict: 'id' },
    );
    expect(rpc).toHaveBeenCalledWith('replace_canonical_brochure_catalog', {
      p_records: [
        {
        id: 'canonical:brn-1',
          canonical_brn: 'brn-1',
          source_zip_code: '10000',
          store_id: 'lidl',
          title: 'Lidl Woche',
          valid_from: '2026-10-01T00:00:00Z',
          valid_until: '2026-10-07T23:59:59Z',
          page_count: 1,
          cover_image: 'https://cdn.bringapi.app/content/brn-1/cover.jpg',
          pages: record.pages,
          available_zip_codes: ['10000'],
        },
      ],
      p_scoped_zip_codes: ['10000', '10100'],
    });
  });

  it('does not publish when store metadata fails', async () => {
    const from = jest.fn(() => ({ upsert: async () => ({ error: { message: 'store write failed' } }) }));
    const rpc = jest.fn(async () => ({ data: null, error: null }));

    await expect(
      publishCanonicalCatalog(
        { from, rpc } as unknown as SupabaseClient,
        [record],
        [{ id: 'lidl', name: 'Lidl' }],
        ['10000', '10100'],
      ),
    ).rejects.toThrow('brochure_stores konnten nicht aktualisiert werden');
    expect(rpc).not.toHaveBeenCalled();
  });

  it('does not overwrite a store logo when a scan has no logo value', async () => {
    const storeUpsert = jest.fn(async () => ({ error: null }));
    const from = jest.fn(() => ({ upsert: storeUpsert }));
    const rpc = jest.fn(async () => ({ data: null, error: null }));

    await publishCanonicalCatalog(
      { from, rpc } as unknown as SupabaseClient,
      [record],
      [{ id: 'lidl', name: 'Lidl' }],
      ['10000', '10100'],
    );

    expect(storeUpsert).toHaveBeenCalledWith(
      [{ id: 'lidl', name: 'Lidl', active: true }],
      { onConflict: 'id' },
    );
  });

  it('propagates catalog replacement errors so a failed transaction is visible', async () => {
    const from = jest.fn(() => ({ upsert: async () => ({ error: null }) }));
    const rpc = jest.fn(async () => ({ data: null, error: { message: 'constraint failed' } }));

    await expect(
      publishCanonicalCatalog(
        { from, rpc } as unknown as SupabaseClient,
        [record],
        [{ id: 'lidl', name: 'Lidl' }],
        ['10000', '10100'],
      ),
    ).rejects.toThrow('Prospektkatalog konnte nicht ersetzt werden');
  });

  it('rejects availability that includes a ZIP outside the completed scan scope', async () => {
    const from = jest.fn(() => ({ upsert: async () => ({ error: null }) }));
    const rpc = jest.fn(async () => ({ data: null, error: null }));

    await expect(
      publishCanonicalCatalog(
        { from, rpc } as unknown as SupabaseClient,
        [{ ...record, availableZipCodes: ['10000', '10100'] }],
        [{ id: 'lidl', name: 'Lidl' }],
        ['10000'],
      ),
    ).rejects.toThrow('enthält ungültige oder nicht belegte PLZ-Verfügbarkeit');
    expect(rpc).not.toHaveBeenCalled();
  });
});
