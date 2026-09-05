import type { SqlDatabase } from '@/lib/db/types';

export type BrochureDump = {
  stores?: Array<{ id: string; name: string; logoUrl?: string }>;
  brochures?: Array<{
    id: string;
    storeId: string;
    title: string;
    validFrom: string;
    validUntil: string;
    coverImage: string;
    pages?: Array<{
      number: number;
      imageUrl: string;
      hotspots?: unknown[];
    }>;
  }>;
};

export type BrochureSyncStats = {
  brochureCount: number;
  pageCount: number;
  hotspotCount: number;
};

/** Replaces the local brochure snapshot atomically. */
export async function writeBrochureDump(
  db: SqlDatabase,
  zipCode: string,
  payload: BrochureDump,
): Promise<BrochureSyncStats> {
  const stores = Array.isArray(payload.stores) ? payload.stores : [];
  const brochures = Array.isArray(payload.brochures) ? payload.brochures : [];
  const pageCount = brochures.reduce(
    (total, brochure) => total + (Array.isArray(brochure.pages) ? brochure.pages.length : 0),
    0,
  );
  const hotspotCount = brochures.reduce(
    (total, brochure) =>
      total +
      (Array.isArray(brochure.pages)
        ? brochure.pages.reduce(
            (pageTotal, page) =>
              pageTotal + (Array.isArray(page.hotspots) ? page.hotspots.length : 0),
            0,
          )
        : 0),
    0,
  );

  await db.withExclusiveTransactionAsync(async (txn) => {
    await txn.execAsync('DELETE FROM local_brochure_pages');
    await txn.execAsync('DELETE FROM local_brochures');
    await txn.execAsync('DELETE FROM local_brochure_stores');

    for (const store of stores) {
      await txn.runAsync(
        'INSERT INTO local_brochure_stores (id, name, logo_url, active) VALUES (?, ?, ?, 1)',
        [store.id, store.name, store.logoUrl || null],
      );
    }

    for (const brochure of brochures) {
      await txn.runAsync(
        'INSERT INTO local_brochures (id, store_id, title, valid_from, valid_until, cover_image) VALUES (?, ?, ?, ?, ?, ?)',
        [
          brochure.id,
          brochure.storeId,
          brochure.title,
          brochure.validFrom,
          brochure.validUntil,
          brochure.coverImage,
        ],
      );

      if (!Array.isArray(brochure.pages)) continue;

      for (const page of brochure.pages) {
        await txn.runAsync(
          'INSERT INTO local_brochure_pages (id, brochure_id, page_number, image_url, hotspots_json) VALUES (?, ?, ?, ?, ?)',
          [
            `${brochure.id}_${page.number}`,
            brochure.id,
            page.number,
            page.imageUrl,
            JSON.stringify(page.hotspots || []),
          ],
        );
      }
    }

    await txn.runAsync(
      `INSERT INTO local_brochure_cache (id, zip_code, updated_at)
       VALUES (1, ?, ?)
       ON CONFLICT(id) DO UPDATE SET zip_code = excluded.zip_code, updated_at = excluded.updated_at`,
      [zipCode, Date.now()],
    );
  });

  return { brochureCount: brochures.length, pageCount, hotspotCount };
}
