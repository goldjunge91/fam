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

export type CanonicalAvailabilityRow = {
  zip_code: string;
  brochure: {
    id: string;
    canonical_brn: string;
    store_id: string;
    title: string;
    valid_from: string;
    valid_until: string;
    page_count: number;
    cover_image: string;
    pages: unknown;
    verified_sha256: string;
    store: { id: string; name: string; logo_url: string | null };
  };
};

export type CanonicalAvailabilityQueryClient = {
  from: (table: 'brochure_availability') => {
    select: (columns: string) => {
      eq: (column: 'zip_code', value: string) => PromiseLike<{ data: unknown; error: unknown }>;
    };
  };
};

type CanonicalBrochurePage = {
  number: number;
  imageUrl: string;
  hotspots: unknown[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requiredString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`Invalid canonical brochure ${field}`);
  }

  return value;
}

function privateImageKey(value: unknown, field: string): string {
  const key = requiredString(value, field);
  if (!key.startsWith('brochures/') || key.length === 'brochures/'.length) {
    throw new Error(`Invalid canonical brochure ${field}`);
  }

  return key;
}

function canonicalPages(value: unknown, expectedCount: number): CanonicalBrochurePage[] {
  if (!Array.isArray(value) || value.length !== expectedCount) {
    throw new Error('Invalid canonical brochure pages');
  }

  const pageNumbers = new Set<number>();
  return value.map((page): CanonicalBrochurePage => {
    if (!isRecord(page)) throw new Error('Invalid canonical brochure pages');

    const number = page.number;
    if (
      typeof number !== 'number' ||
      !Number.isInteger(number) ||
      number < 1 ||
      number > expectedCount ||
      pageNumbers.has(number) ||
      !Array.isArray(page.hotspots)
    ) {
      throw new Error('Invalid canonical brochure pages');
    }
    pageNumbers.add(number);

    return {
      number,
      imageUrl: privateImageKey(page.imageUrl, 'pages'),
      hotspots: page.hotspots,
    };
  });
}

/** Converts ZIP-scoped canonical rows into the existing local snapshot shape. */
export function mapCanonicalAvailabilityRows(value: unknown, zipCode: string): BrochureDump {
  if (!/^\d{5}$/.test(zipCode)) throw new Error('Invalid brochure ZIP code');
  if (!Array.isArray(value)) throw new Error('Invalid brochure availability rows');

  const stores = new Map<string, { id: string; name: string; logoUrl?: string }>();
  const brochures: NonNullable<BrochureDump['brochures']> = [];

  for (const row of value) {
    if (!isRecord(row) || typeof row.zip_code !== 'string' || !/^\d{5}$/.test(row.zip_code)) {
      throw new Error('Invalid brochure availability ZIP code');
    }
    if (row.zip_code !== zipCode) continue;

    const brochure = row.brochure;
    if (!isRecord(brochure)) throw new Error('Invalid canonical brochure row');

    const id = requiredString(brochure.id, 'id');
    requiredString(brochure.canonical_brn, 'canonical_brn');
    const storeId = requiredString(brochure.store_id, 'store_id');
    const store = brochure.store;
    if (!isRecord(store)) throw new Error('Invalid canonical brochure store');

    let logoUrl: string | undefined;
    if (store.logo_url === null) {
      logoUrl = undefined;
    } else if (typeof store.logo_url === 'string') {
      logoUrl = store.logo_url.trim().length > 0 ? store.logo_url : undefined;
    } else {
      throw new Error('Invalid canonical brochure store logo_url');
    }

    const storeRecord = {
      id: requiredString(store.id, 'store id'),
      name: requiredString(store.name, 'store name'),
      ...(logoUrl ? { logoUrl } : {}),
    };
    if (storeRecord.id !== storeId) throw new Error('Invalid canonical brochure store');
    if (!stores.has(storeId)) stores.set(storeId, storeRecord);

    const title = requiredString(brochure.title, 'title');
    const validFrom = requiredString(brochure.valid_from, 'valid_from');
    const validUntil = requiredString(brochure.valid_until, 'valid_until');
    const validFromTime = Date.parse(validFrom);
    const validUntilTime = Date.parse(validUntil);
    if (
      !Number.isFinite(validFromTime) ||
      !Number.isFinite(validUntilTime) ||
      validUntilTime < validFromTime
    ) {
      throw new Error('Invalid canonical brochure validity');
    }

    const pageCount = brochure.page_count;
    if (typeof pageCount !== 'number' || !Number.isInteger(pageCount) || pageCount < 1) {
      throw new Error('Invalid canonical brochure page_count');
    }
    if (!/^[a-f0-9]{64}$/.test(requiredString(brochure.verified_sha256, 'verified_sha256'))) {
      throw new Error('Invalid canonical brochure verified_sha256');
    }

    brochures.push({
      id,
      storeId,
      title,
      validFrom,
      validUntil,
      coverImage: privateImageKey(brochure.cover_image, 'cover_image'),
      pages: canonicalPages(brochure.pages, pageCount),
    });
  }

  return { stores: [...stores.values()], brochures };
}

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
