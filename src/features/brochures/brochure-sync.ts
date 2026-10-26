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

export type BrochureZipScanStatus = {
  requested_at: string;
  last_successful_at: string | null;
  next_attempt_at: string;
  last_error: string | null;
};

export function brochureZipScanIsPending(
  status: BrochureZipScanStatus | null | undefined,
): boolean {
  if (!status) return false;
  if (status.last_successful_at === null) return true;
  const requestedAt = Date.parse(status.requested_at);
  const lastSuccessfulAt = Date.parse(status.last_successful_at);
  return (
    !Number.isFinite(requestedAt) ||
    !Number.isFinite(lastSuccessfulAt) ||
    lastSuccessfulAt < requestedAt
  );
}

type RegionalBrochureRow = {
  id: string;
  source_content_id: string;
  source_zip_code: string;
  store_id: string;
  title: string;
  valid_from: string;
  valid_until: string;
  page_count: number;
  cover_image: string;
  pages: unknown;
  store: { id: string; name: string; logo_url: string | null };
};

type NormalizedRegionalBrochure = Omit<RegionalBrochureRow, 'pages'> & {
  pages: BrochurePage[];
};

export type RegionalAvailabilityRow = {
  zip_code: string;
  brochure: RegionalBrochureRow;
};

type BrochurePage = {
  page_number: number;
  image_url: string;
  hotspots: unknown[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requiredString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`Invalid brochure ${field}`);
  }
  return value.trim();
}

function bonialImageUrl(value: unknown, field: string): string {
  const source = requiredString(value, field);
  let url: URL;
  try {
    url = new URL(source);
  } catch {
    throw new Error(`Invalid brochure ${field}`);
  }
  if (url.protocol !== 'https:' || url.hostname !== 'content-media.bonial.biz') {
    throw new Error(`Invalid brochure ${field}`);
  }
  return url.toString();
}

function brochurePages(value: unknown, expectedCount: number): BrochurePage[] {
  if (!Array.isArray(value) || value.length !== expectedCount) {
    throw new Error('Invalid brochure pages');
  }
  const pages = value.map((page): BrochurePage => {
    if (!isRecord(page) || !Array.isArray(page.hotspots)) {
      throw new Error('Invalid brochure pages');
    }
    const pageNumber = page.page_number;
    if (typeof pageNumber !== 'number' || !Number.isInteger(pageNumber)) {
      throw new Error('Invalid brochure pages');
    }
    return {
      page_number: pageNumber,
      image_url: bonialImageUrl(page.image_url, 'page image URL'),
      hotspots: page.hotspots,
    };
  });
  pages.sort((left, right) => left.page_number - right.page_number);
  if (pages.some((page, index) => page.page_number !== index + 1)) {
    throw new Error('Invalid brochure pages');
  }
  return pages;
}

function regionalBrochure(value: unknown, zipCode: string): NormalizedRegionalBrochure {
  if (!isRecord(value)) throw new Error('Invalid brochure row');
  const id = requiredString(value.id, 'id');
  const sourceContentId = requiredString(value.source_content_id, 'source_content_id');
  const sourceZipCode = requiredString(value.source_zip_code, 'source_zip_code');
  const storeId = requiredString(value.store_id, 'store_id');
  if (sourceZipCode !== zipCode || id !== `kaufda:${zipCode}:${storeId}:${sourceContentId}`) {
    throw new Error(`Invalid regional brochure identity for ${id}`);
  }

  const store = value.store;
  if (!isRecord(store)) throw new Error('Invalid brochure store');
  if (store.id !== storeId) throw new Error('Invalid brochure store');
  const storeName = requiredString(store.name, 'store name');
  const logoUrl = store.logo_url === null ? null : requiredString(store.logo_url, 'store logo URL');
  if (logoUrl !== null) {
    let url: URL;
    try {
      url = new URL(logoUrl);
    } catch {
      throw new Error('Invalid brochure store logo URL');
    }
    if (url.protocol !== 'https:') throw new Error('Invalid brochure store logo URL');
  }

  const title = requiredString(value.title, 'title');
  const validFrom = requiredString(value.valid_from, 'valid_from');
  const validUntil = requiredString(value.valid_until, 'valid_until');
  const validFromTime = Date.parse(validFrom);
  const validUntilTime = Date.parse(validUntil);
  if (
    !Number.isFinite(validFromTime) ||
    !Number.isFinite(validUntilTime) ||
    validUntilTime < validFromTime
  ) {
    throw new Error('Invalid brochure validity');
  }

  const pageCount = value.page_count;
  if (typeof pageCount !== 'number' || !Number.isInteger(pageCount) || pageCount < 1) {
    throw new Error('Invalid brochure page_count');
  }
  const pages = brochurePages(value.pages, pageCount);
  const coverImage = bonialImageUrl(value.cover_image, 'cover image URL');
  if (pages[0]?.image_url !== coverImage) throw new Error('Invalid brochure cover page');

  return {
    id,
    source_content_id: sourceContentId,
    source_zip_code: sourceZipCode,
    store_id: storeId,
    title,
    valid_from: validFrom,
    valid_until: validUntil,
    page_count: pageCount,
    cover_image: coverImage,
    pages,
    store: {
      id: storeId,
      name: storeName,
      logo_url: logoUrl,
    },
  };
}

/** Converts the regional Supabase rows into the existing local SQLite snapshot shape. */
export function mapRegionalAvailabilityRows(value: unknown, zipCode: string): BrochureDump {
  if (!/^\d{5}$/.test(zipCode)) throw new Error('Invalid brochure ZIP code');
  if (!Array.isArray(value)) throw new Error('Invalid brochure availability rows');

  const stores = new Map<string, { id: string; name: string; logoUrl?: string }>();
  const brochures: NonNullable<BrochureDump['brochures']> = [];

  for (const row of value) {
    if (!isRecord(row) || row.zip_code !== zipCode) {
      throw new Error('Invalid brochure availability ZIP code');
    }
    const brochure = regionalBrochure(row.brochure, zipCode);
    const store = brochure.store;
    if (!stores.has(store.id)) {
      stores.set(store.id, {
        id: store.id,
        name: store.name,
        ...(store.logo_url ? { logoUrl: store.logo_url } : {}),
      });
    }
    brochures.push({
      id: brochure.id,
      storeId: brochure.store_id,
      title: brochure.title,
      validFrom: brochure.valid_from,
      validUntil: brochure.valid_until,
      coverImage: brochure.cover_image,
      pages: brochure.pages.map((page) => ({
        number: page.page_number,
        imageUrl: page.image_url,
        hotspots: page.hotspots,
      })),
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
