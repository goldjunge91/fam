import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { CanonicalCatalogRecord } from './listing-only/canonical-catalog';
import type { CrawlerStore } from './types';

export type UploaderConfig = {
  supabaseUrl: string;
  supabaseSecretKey: string;
  dryRun?: boolean;
};

type CanonicalCatalogRpcRecord = {
  id: string;
  canonical_brn: string;
  store_id: string;
  title: string;
  valid_from: string;
  valid_until: string;
  page_count: number;
  cover_image: string;
  pages: CanonicalCatalogRecord['pages'];
  verified_sha256: string;
  available_zip_codes: string[];
};

type CanonicalCatalogRpcClient = {
  rpc(
    functionName: 'replace_canonical_brochure_catalog',
    args: { p_records: CanonicalCatalogRpcRecord[]; p_scoped_zip_codes: string[] },
  ): Promise<{ error: { message: string } | null }>;
};

export function sanitizeJsonForPostgres<T>(value: T): T {
  const raw = JSON.stringify(value);
  if (raw === undefined) return value;
  const sanitized = raw
    .replace(/\\u0000/gi, '')
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');
  return JSON.parse(sanitized) as T;
}

export function createSupabaseUploaderClient(config: UploaderConfig): SupabaseClient | null {
  if (config.dryRun) return null;
  if (!config.supabaseUrl || !config.supabaseSecretKey) {
    throw new Error('SUPABASE_URL oder SUPABASE_SECRET_KEY fehlt für den Upload.');
  }
  return createClient(config.supabaseUrl, config.supabaseSecretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Writes store metadata, then atomically replaces availability within the completed ZIP scope. */
export async function publishCanonicalCatalog(
  supabase: SupabaseClient,
  catalog: readonly CanonicalCatalogRecord[],
  stores: readonly CrawlerStore[],
  scopedZipCodes: readonly string[],
): Promise<{ uploadedCount: number; storesCount: number }> {
  const zipScope = [...new Set(scopedZipCodes)].sort();
  if (zipScope.some((zipCode) => zipCode.length === 0)) {
    throw new Error('Katalog-Scope enthält eine leere PLZ.');
  }
  if (zipScope.length === 0) return { uploadedCount: 0, storesCount: 0 };

  const zipScopeSet = new Set(zipScope);
  for (const record of catalog) {
    if (record.availableZipCodes.some((zipCode) => !zipScopeSet.has(zipCode))) {
      throw new Error(`Prospekt ${record.id} enthält PLZ außerhalb des Crawl-Scopes.`);
    }
  }

  const storeById = new Map<string, CrawlerStore>();
  for (const store of stores) storeById.set(store.id, store);
  for (const record of catalog) {
    if (!storeById.has(record.storeId)) {
      throw new Error(`Für Prospekt ${record.id} fehlt Store ${record.storeId}.`);
    }
  }

  const cleanStores = sanitizeJsonForPostgres(
    [...storeById.values()]
      .sort((left, right) => left.id.localeCompare(right.id))
      .map((store) => ({
        id: store.id,
        name: store.name,
        ...(store.logoUrl === undefined ? {} : { logo_url: store.logoUrl }),
        active: true,
      })),
  );

  if (cleanStores.length > 0) {
    const { error: storeError } = await supabase
      .from('brochure_stores')
      .upsert(cleanStores, { onConflict: 'id' });
    if (storeError) {
      throw new Error(`brochure_stores konnten nicht aktualisiert werden: ${storeError.message}`);
    }
  }

  const records: CanonicalCatalogRpcRecord[] = catalog.map((record) => ({
    id: record.id,
    canonical_brn: record.canonicalBrn,
    store_id: record.storeId,
    title: record.title,
    valid_from: record.validFrom,
    valid_until: record.validUntil,
    page_count: record.pageCount,
    cover_image: record.coverImage,
    pages: record.pages,
    verified_sha256: record.verifiedSha256,
    available_zip_codes: record.availableZipCodes,
  }));
  const { error } = await (supabase as unknown as CanonicalCatalogRpcClient).rpc(
    'replace_canonical_brochure_catalog',
    { p_records: sanitizeJsonForPostgres(records), p_scoped_zip_codes: zipScope },
  );
  if (error) {
    throw new Error(`Kanonischer Prospektkatalog konnte nicht ersetzt werden: ${error.message}`);
  }

  return { uploadedCount: catalog.length, storesCount: storeById.size };
}

export async function uploadCanonicalCatalog(
  catalog: readonly CanonicalCatalogRecord[],
  stores: readonly CrawlerStore[],
  scopedZipCodes: readonly string[],
  config: UploaderConfig,
): Promise<{ uploadedCount: number; storesCount: number }> {
  if (config.dryRun) return { uploadedCount: catalog.length, storesCount: 0 };
  const supabase = createSupabaseUploaderClient(config);
  if (!supabase) throw new Error('Supabase Client nicht initialisiert.');
  return publishCanonicalCatalog(supabase, catalog, stores, scopedZipCodes);
}
