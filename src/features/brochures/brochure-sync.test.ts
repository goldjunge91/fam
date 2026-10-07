import { createTestDatabase } from '../../../test/node-sqlite-adapter';
import { serializeDatabase } from '../../lib/db/serialize';
import {
  type BrochureDump,
  type CanonicalAvailabilityRow,
  mapCanonicalAvailabilityRows,
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

function canonicalRow(
  zipCode: string,
  brochureId: string,
  overrides: Partial<CanonicalAvailabilityRow['brochure']> = {},
): CanonicalAvailabilityRow {
  return {
    zip_code: zipCode,
    brochure: {
      id: brochureId,
      canonical_brn: `brn-${brochureId}`,
      store_id: 'store-1',
      title: `Brochure ${brochureId}`,
      valid_from: '2026-10-01T00:00:00.000Z',
      valid_until: '2026-10-07T23:59:59.000Z',
      page_count: 2,
      cover_image: `brochures/${brochureId}/cover.jpg`,
      pages: [
        {
          number: 1,
          imageUrl: `brochures/${brochureId}/1.jpg`,
          hotspots: [],
        },
        {
          number: 2,
          imageUrl: `brochures/${brochureId}/2.jpg`,
          hotspots: [],
        },
      ],
      verified_sha256: 'a'.repeat(64),
      store: { id: 'store-1', name: 'Fresh Market', logo_url: 'brochures/store/logo.png' },
      ...overrides,
    },
  };
}

describe('mapCanonicalAvailabilityRows', () => {
  it('maps only rows available for the requested ZIP code', () => {
    const dump = mapCanonicalAvailabilityRows(
      [canonicalRow('10000', 'local'), canonicalRow('20000', 'other')],
      '10000',
    );

    expect(dump.brochures?.map(({ id }) => id)).toEqual(['local']);
    expect(dump.stores).toEqual([
      { id: 'store-1', name: 'Fresh Market', logoUrl: 'brochures/store/logo.png' },
    ]);
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
      imageUrl: 'brochures/offer/apple.jpg',
      linkoutUrl: 'https://example.com/apples',
    };
    const row = canonicalRow('10000', 'full', {
      pages: [
        { number: 1, imageUrl: 'brochures/full/1.jpg', hotspots: [hotspot] },
        { number: 2, imageUrl: 'brochures/full/2.jpg', hotspots: [{ ...hotspot, id: 'offer-2' }] },
      ],
    });

    const dump = mapCanonicalAvailabilityRows([row], '10000');

    expect(dump.brochures?.[0]).toMatchObject({
      id: 'full',
      coverImage: 'brochures/full/cover.jpg',
      pages: [
        { number: 1, imageUrl: 'brochures/full/1.jpg', hotspots: [hotspot] },
        {
          number: 2,
          imageUrl: 'brochures/full/2.jpg',
          hotspots: [{ ...hotspot, id: 'offer-2' }],
        },
      ],
    });
  });

  it('deduplicates a store shared by multiple brochure rows', () => {
    const dump = mapCanonicalAvailabilityRows(
      [canonicalRow('10000', 'one'), canonicalRow('10000', 'two')],
      '10000',
    );

    expect(dump.stores).toHaveLength(1);
    expect(dump.brochures).toHaveLength(2);
  });

  it('rejects malformed page payloads instead of silently dropping pages', () => {
    const row = canonicalRow('10000', 'bad-pages', {
      pages: [{ number: 1, imageUrl: 'brochures/bad-pages/1.jpg' }],
    });

    expect(() => mapCanonicalAvailabilityRows([row], '10000')).toThrow(
      'Invalid canonical brochure pages',
    );
  });
});
