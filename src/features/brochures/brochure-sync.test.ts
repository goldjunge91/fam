import { createTestDatabase } from '../../../test/node-sqlite-adapter';
import { serializeDatabase } from '../../lib/db/serialize';
import { type BrochureDump, writeBrochureDump } from './brochure-sync';

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
