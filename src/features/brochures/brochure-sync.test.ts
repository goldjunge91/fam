import { createTestDatabase } from '../../../test/node-sqlite-adapter';
import { serializeDatabase } from '../../lib/db/serialize';
import {
  type BrochureDump,
  brochureZipScanIsPending,
  mapRegionalAvailabilityRows,
  type RegionalAvailabilityRow,
  writeBrochureDump,
} from './brochure-sync';

const SCHEMA = `
  CREATE TABLE local_brochure_stores (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    logo_url TEXT,
    active INTEGER NOT NULL DEFAULT 1
  );
  CREATE TABLE local_brochures (
    id TEXT PRIMARY KEY NOT NULL,
    store_id TEXT NOT NULL,
    title TEXT NOT NULL,
    valid_from TEXT NOT NULL,
    valid_until TEXT NOT NULL,
    cover_image TEXT NOT NULL
  );
  CREATE TABLE local_brochure_pages (
    id TEXT PRIMARY KEY NOT NULL,
    brochure_id TEXT NOT NULL,
    page_number INTEGER NOT NULL,
    image_url TEXT NOT NULL,
    hotspots_json TEXT NOT NULL DEFAULT '[]'
  );
  CREATE TABLE local_brochure_cache (
    id INTEGER PRIMARY KEY NOT NULL CHECK (id = 1),
    zip_code TEXT NOT NULL,
    updated_at INTEGER NOT NULL
  );
`;

describe('brochureZipScanIsPending', () => {
  it('returns true until the requested PLZ has a newer successful scan', () => {
    expect(
      brochureZipScanIsPending({
        requested_at: '2026-10-26T10:00:00Z',
        last_successful_at: null,
        next_attempt_at: '2026-10-26T10:00:00Z',
        last_error: null,
      }),
    ).toBe(true);
    expect(
      brochureZipScanIsPending({
        requested_at: '2026-10-26T10:00:00Z',
        last_successful_at: '2026-10-26T10:01:00Z',
        next_attempt_at: '2026-10-26T10:01:00Z',
        last_error: null,
      }),
    ).toBe(false);
  });
});

function dump(id: string): BrochureDump {
  return {
    stores: [{ id: `store-${id}`, name: `Store ${id}` }],
    brochures: [
      {
        id: `brochure-${id}`,
        storeId: `store-${id}`,
        title: `Brochure ${id}`,
        validFrom: '2026-09-01',
        validUntil: '2026-09-07',
        coverImage: `https://example.com/${id}.jpg`,
        pages: [{ number: 1, imageUrl: `https://example.com/${id}-1.jpg` }],
      },
    ],
  };
}

describe('writeBrochureDump', () => {
  it('serializes overlapping writes without starting a nested transaction', async () => {
    const rawDb = createTestDatabase();
    const db = serializeDatabase(rawDb);
    await db.execAsync(SCHEMA);

    try {
      await Promise.all([
        writeBrochureDump(db, '10000', dump('first')),
        writeBrochureDump(db, '20000', dump('second')),
      ]);

      await expect(
        db.getFirstAsync<{ zip_code: string }>(
          'SELECT zip_code FROM local_brochure_cache WHERE id = 1',
        ),
      ).resolves.toEqual({ zip_code: '20000' });
      await expect(
        db.getFirstAsync<{ id: string }>('SELECT id FROM local_brochures'),
      ).resolves.toEqual({ id: 'brochure-second' });
      await expect(
        db.getFirstAsync<{ id: string }>('SELECT id FROM local_brochure_pages'),
      ).resolves.toEqual({ id: 'brochure-second_1' });
    } finally {
      rawDb.close();
    }
  });
});

function regionalRow(
  zipCode: string,
  brochureId: string,
  overrides: Partial<RegionalAvailabilityRow['brochure']> = {},
): RegionalAvailabilityRow {
  return {
    zip_code: zipCode,
    brochure: {
      id: `kaufda:${zipCode}:store-1:content-${brochureId}`,
      source_content_id: `content-${brochureId}`,
      source_zip_code: zipCode,
      store_id: 'store-1',
      title: `Brochure ${brochureId}`,
      valid_from: '2026-10-01T00:00:00.000Z',
      valid_until: '2026-10-07T23:59:59.000Z',
      page_count: 2,
      cover_image: `https://content-media.bonial.biz/${brochureId}/1.jpg`,
      pages: [
        {
          page_number: 1,
          image_url: `https://content-media.bonial.biz/${brochureId}/1.jpg`,
          hotspots: [],
        },
        {
          page_number: 2,
          image_url: `https://content-media.bonial.biz/${brochureId}/2.jpg`,
          hotspots: [],
        },
      ],
      store: {
        id: 'store-1',
        name: 'Fresh Market',
        logo_url: 'https://content-media.bonial.biz/store/logo.png',
      },
      ...overrides,
    },
  };
}

describe('mapRegionalAvailabilityRows', () => {
  it('maps a regional brochure row to the local SQLite dump shape', () => {
    const dump = mapRegionalAvailabilityRows([regionalRow('10000', 'local')], '10000');

    expect(dump.brochures?.map(({ id }) => id)).toEqual(['kaufda:10000:store-1:content-local']);
    expect(dump.stores).toEqual([
      {
        id: 'store-1',
        name: 'Fresh Market',
        logoUrl: 'https://content-media.bonial.biz/store/logo.png',
      },
    ]);
  });

  it('rejects rows from another ZIP instead of mixing regional content', () => {
    const row = regionalRow('20000', 'regional');

    expect(() => mapRegionalAvailabilityRows([row], '10000')).toThrow(
      'Invalid brochure availability ZIP code',
    );
  });

  it('preserves every page and its full hotspot data', () => {
    const hotspot = {
      kind: 'discount',
      id: 'offer-1',
      x: 12,
      y: 18,
      width: 35,
      height: 24,
      title: 'Apples',
      description: 'Regional harvest',
      discount: '20%',
      priceLabel: '€1.99',
      priceCents: 199,
      oldPriceCents: 249,
      currency: 'EUR',
      imageUrl: 'https://content-media.bonial.biz/offer/apple.jpg',
      linkoutUrl: 'https://example.com/apples',
    };
    const row = regionalRow('10000', 'full', {
      cover_image: 'https://content-media.bonial.biz/full/1.jpg',
      pages: [
        {
          page_number: 1,
          image_url: 'https://content-media.bonial.biz/full/1.jpg',
          hotspots: [hotspot],
        },
        {
          page_number: 2,
          image_url: 'https://content-media.bonial.biz/full/2.jpg',
          hotspots: [{ ...hotspot, id: 'offer-2' }],
        },
      ],
    });

    const dump = mapRegionalAvailabilityRows([row], '10000');

    expect(dump.brochures?.[0]).toMatchObject({
      id: 'kaufda:10000:store-1:content-full',
      coverImage: 'https://content-media.bonial.biz/full/1.jpg',
      pages: [
        { number: 1, imageUrl: 'https://content-media.bonial.biz/full/1.jpg', hotspots: [hotspot] },
        {
          number: 2,
          imageUrl: 'https://content-media.bonial.biz/full/2.jpg',
          hotspots: [{ ...hotspot, id: 'offer-2' }],
        },
      ],
    });
  });

  it('deduplicates a store shared by multiple brochure rows', () => {
    const dump = mapRegionalAvailabilityRows(
      [
        regionalRow('10000', 'one', {
          title: 'Brochure One',
        }),
        regionalRow('10000', 'two', {
          title: 'Brochure Two',
        }),
      ],
      '10000',
    );

    expect(dump.stores).toHaveLength(1);
    expect(dump.brochures).toHaveLength(2);
  });

  it('rejects malformed page payloads instead of silently dropping pages', () => {
    const row = regionalRow('10000', 'bad-pages', {
      page_count: 1,
      cover_image: 'https://content-media.bonial.biz/bad-pages/1.jpg',
      pages: [{ page_number: 1, image_url: 'https://content-media.bonial.biz/bad-pages/1.jpg' }],
    });

    expect(() => mapRegionalAvailabilityRows([row], '10000')).toThrow('Invalid brochure pages');
  });
});
