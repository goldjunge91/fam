import { appendFile } from 'node:fs/promises';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database, Json } from '../../src/lib/database.types';
import { type ScrapedBrochure, scrapeKaufdaZip } from './kaufda';
import { loadPostalCodes, type ScrapeLocation } from './locations';

type PublishedBrochure = {
  id: string;
  source_content_id: string;
  source_zip_code: string;
  store_id: string;
  store_name: string;
  title: string;
  valid_from: string;
  valid_until: string;
  cover_image: string;
  page_count: number;
  pages: Array<{
    page_number: number;
    image_url: string;
    thumbnail_url?: string;
    hotspots: ScrapedBrochure['pages'][number]['hotspots'];
  }>;
  available_zip_codes: string[];
};

type Publisher = Pick<SupabaseClient<Database>, 'rpc'>;

type ScanDependencies = {
  scrape: typeof scrapeKaufdaZip;
  publish: (zipCode: string, records: PublishedBrochure[]) => Promise<void>;
  dryRun: boolean;
};

type StoreScanResult = {
  storeId: string;
  storeName: string;
  brochureCount: number;
  pageCount: number;
  hotspotCount: number;
};

type LocationScanResult = {
  brochureCount: number;
  pageCount: number;
  hotspotCount: number;
  stores: StoreScanResult[];
};

function argumentValue(args: readonly string[], name: string): string | undefined {
  const value = args.find((argument) => argument.startsWith(`${name}=`));
  if (value) return value.slice(name.length + 1);
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

function requiredEnvironment(name: string, value: string | undefined): string {
  if (!value?.trim()) throw new Error(`Missing required environment variable ${name}.`);
  return value.trim();
}

function publisherFromEnvironment(): Publisher {
  const url = requiredEnvironment(
    'SUPABASE_URL',
    process.env.SUPABASE_URL ?? process.env.EXPO_PUBLIC_SUPABASE_URL,
  );
  const key = requiredEnvironment(
    'SUPABASE_SERVICE_ROLE_KEY',
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY,
  );
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function toPublishedBrochure(brochure: ScrapedBrochure): PublishedBrochure {
  return {
    id: brochure.id,
    source_content_id: brochure.content_id,
    source_zip_code: brochure.source_zip_code,
    store_id: brochure.store_id,
    store_name: brochure.store_name,
    title: brochure.title,
    valid_from: brochure.valid_from,
    valid_until: brochure.valid_until,
    cover_image: brochure.cover_image_url,
    page_count: brochure.page_count,
    pages: brochure.pages.map((page) => ({
      page_number: page.page_number,
      image_url: page.image_url,
      ...(page.thumbnail_url ? { thumbnail_url: page.thumbnail_url } : {}),
      hotspots: page.hotspots,
    })),
    available_zip_codes: brochure.available_zip_codes,
  };
}

async function publishZip(publisher: Publisher, zipCode: string, records: PublishedBrochure[]) {
  const jsonRecords = JSON.parse(JSON.stringify(records)) as Json;
  const { error } = await publisher.rpc('replace_brochure_zip', {
    p_zip_code: zipCode,
    p_records: jsonRecords,
  });
  if (error) throw error;
}

export async function scanAndPublishLocation(
  location: ScrapeLocation,
  dependencies: ScanDependencies,
): Promise<LocationScanResult> {
  let brochures: ScrapedBrochure[];
  try {
    brochures = await dependencies.scrape(location);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`PLZ ${location.zipCode}: ${message}`, { cause: error });
  }

  const storesById = new Map<string, StoreScanResult>();
  for (const brochure of brochures) {
    let store = storesById.get(brochure.store_id);
    if (!store) {
      store = {
        storeId: brochure.store_id,
        storeName: brochure.store_name,
        brochureCount: 0,
        pageCount: 0,
        hotspotCount: 0,
      };
      storesById.set(brochure.store_id, store);
    } else if (store.storeName !== brochure.store_name) {
      throw new Error(
        `KaufDA returned conflicting names for publisher ${brochure.store_id} in PLZ ${location.zipCode}.`,
      );
    }
    store.brochureCount += 1;
    store.pageCount += brochure.page_count;
    store.hotspotCount += brochure.pages.reduce((total, page) => total + page.hotspots.length, 0);
  }
  const records = brochures.map(toPublishedBrochure);
  if (!dependencies.dryRun) await dependencies.publish(location.zipCode, records);
  return {
    brochureCount: brochures.length,
    pageCount: brochures.reduce((total, brochure) => total + brochure.page_count, 0),
    hotspotCount: brochures.reduce(
      (total, brochure) =>
        total + brochure.pages.reduce((pageTotal, page) => pageTotal + page.hotspots.length, 0),
      0,
    ),
    stores: [...storesById.values()].sort((left, right) =>
      left.storeName.localeCompare(right.storeName, 'de'),
    ),
  };
}

async function recordScanFailure(
  publisher: Publisher,
  zipCode: string,
  message: string,
): Promise<void> {
  const { error } = await publisher.rpc('record_brochure_zip_scan_failure', {
    p_zip_code: zipCode,
    p_error: message,
  });
  if (error) process.stderr.write(`Could not defer retry for ${zipCode}: ${String(error)}\n`);
}

function selectedLocation(
  allLocations: readonly ScrapeLocation[],
  zipCode: string | undefined,
): ScrapeLocation {
  if (!zipCode || !/^\d{5}$/.test(zipCode)) throw new Error('--zip must contain five digits.');
  const locationsByZip = new Map(allLocations.map((location) => [location.zipCode, location]));
  const location = locationsByZip.get(zipCode);
  if (!location) throw new Error(`No location data found for postal code ${zipCode}.`);
  return location;
}

async function writeStepSummary(summary: string): Promise<void> {
  const path = process.env.GITHUB_STEP_SUMMARY;
  if (path) await appendFile(path, `${summary}\n`, 'utf8');
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const zipCode = argumentValue(args, '--zip');
  const dryRun = args.includes('--dry-run');
  if (!zipCode || !/^\d{5}$/.test(zipCode)) throw new Error('--zip must contain five digits.');
  const publisher = dryRun ? null : publisherFromEnvironment();
  const dependencies: ScanDependencies = {
    scrape: scrapeKaufdaZip,
    publish: (targetZip, records) => publishZip(publisher as Publisher, targetZip, records),
    dryRun,
  };
  const startedAt = Date.now();
  const failures: Array<{ zipCode: string; message: string }> = [];
  let totalBrochures = 0;
  let totalPages = 0;
  let totalHotspots = 0;
  let completed = 0;
  const totalsByStore = new Map<string, StoreScanResult>();

  process.stdout.write(
    `KaufDA scan started: PLZ ${zipCode}, ${dryRun ? 'dry run' : 'publishing'}.\n`,
  );

  try {
    const location = selectedLocation(await loadPostalCodes(), zipCode);
    const result = await scanAndPublishLocation(location, dependencies);
    totalBrochures += result.brochureCount;
    totalPages += result.pageCount;
    totalHotspots += result.hotspotCount;
    for (const storeResult of result.stores) {
      totalsByStore.set(storeResult.storeId, storeResult);
    }
    completed = 1;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    failures.push({ zipCode, message });
    if (publisher) await recordScanFailure(publisher, zipCode, message);
    process.stderr.write(`Failed ${zipCode}: ${message}\n`);
  }

  const elapsedSeconds = Math.round((Date.now() - startedAt) / 1000);
  const summary = [
    '## KaufDA brochure scan',
    '',
    `- Target: PLZ ${zipCode}`,
    `- Completed: ${completed}/1`,
    `- Brochures: ${totalBrochures}`,
    `- Pages: ${totalPages}`,
    `- Hotspots: ${totalHotspots}`,
    `- Failed PLZ: ${failures.length}`,
    `- Duration: ${elapsedSeconds}s`,
    `- Mode: ${dryRun ? 'dry run (no database writes)' : 'published per PLZ'}`,
    '',
    '### Per publisher (successfully scanned postal codes)',
    ...[...totalsByStore.values()].map(
      (store) =>
        `- ${store.storeName}: ${store.brochureCount} brochures, ${store.pageCount} pages, ${store.hotspotCount} hotspots`,
    ),
    ...(failures.length > 0
      ? [
          '',
          '### Failed scopes',
          ...failures.slice(0, 20).map((failure) => `- ${failure.zipCode}: ${failure.message}`),
        ]
      : []),
  ].join('\n');
  await writeStepSummary(summary);
  process.stdout.write(`${summary}\n`);
  if (failures.length > 0) {
    throw new Error(`${failures.length} postal-code scope(s) failed.`);
  }
}

if (import.meta.main) {
  main().catch((error: unknown) => {
    process.stderr.write(
      `KaufDA runner failed: ${error instanceof Error ? error.message : String(error)}\n`,
    );
    process.exitCode = 1;
  });
}
