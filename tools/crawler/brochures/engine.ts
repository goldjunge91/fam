import { mkdir, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { mirrorBrochureImagesToLocal, type LocalStorageConfig } from './local-storage';
import { mirrorBrochureImagesToR2, type R2Config } from './r2-storage';
import type {
  BrochureLocation,
  BrochureSource,
  CrawlerBrochure,
  CrawlerStore,
  LocationDump,
  ScraperResult,
} from './types';

export type CrawlEngineOptions = {
  concurrency?: number;
  sources: BrochureSource[];
  r2Config?: R2Config;
  localStorage?: LocalStorageConfig;
  onProgress?: (processed: number, total: number, uniqueBrochuresCount: number) => void;
  onChunkDone?: (chunkDumps: LocationDump[]) => Promise<void> | void;
  backupPath?: string | null;
};

/**
 * Entfernt rekursiv alle ungültigen Null-Bytes (\u0000 oder \0), die Postgres JSONB zum Absturz bringen.
 */
export function cleanNullBytes<T>(value: T): T {
  if (typeof value === 'string') {
    return value
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F\u0000]/g, '')
      .replace(/\\u0000/gi, '') as unknown as T;
  }
  if (Array.isArray(value)) {
    return value.map(cleanNullBytes) as unknown as T;
  }
  if (typeof value === 'object' && value !== null) {
    const cleaned: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      const cleanKey = k
        .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F\u0000]/g, '')
        .replace(/\\u0000/gi, '');
      cleaned[cleanKey] = cleanNullBytes(v);
    }
    return cleaned as unknown as T;
  }
  return value;
}

/**
 * Validiert und repariert ein Prospekt-Objekt, um 100%ige Konformität mit dem SQLite-Schema
 * der Fam-App zu garantieren (keine NULL-Werte bei validFrom, validUntil, coverImage, etc.).
 */
export function sanitizeBrochure(
  brochure: CrawlerBrochure,
  defaultStoreId: string,
  now = new Date(),
): CrawlerBrochure {
  const validFrom =
    brochure.validFrom && !Number.isNaN(Date.parse(brochure.validFrom))
      ? brochure.validFrom
      : now.toISOString();

  const validUntil =
    brochure.validUntil && !Number.isNaN(Date.parse(brochure.validUntil))
      ? brochure.validUntil
      : new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();

  const pages = (brochure.pages || []).map((page, index) => ({
    number: typeof page.number === 'number' ? page.number : index + 1,
    imageUrl: typeof page.imageUrl === 'string' && page.imageUrl ? cleanNullBytes(page.imageUrl) : '',
    hotspots: Array.isArray(page.hotspots)
      ? page.hotspots.map((h, hIndex) => ({
          kind: h.kind ?? 'unknown',
          id: cleanNullBytes(h.id || `h-${index + 1}-${hIndex + 1}`),
          x: typeof h.x === 'number' ? h.x : 0,
          y: typeof h.y === 'number' ? h.y : 0,
          width: typeof h.width === 'number' ? h.width : 20,
          height: typeof h.height === 'number' ? h.height : 20,
          title: cleanNullBytes(h.title || 'Angebot'),
          description: h.description ? cleanNullBytes(h.description) : undefined,
          discount: h.discount ? cleanNullBytes(h.discount) : undefined,
          priceLabel: h.priceLabel ? cleanNullBytes(h.priceLabel) : undefined,
          priceCents: typeof h.priceCents === 'number' ? h.priceCents : undefined,
          oldPriceCents: typeof h.oldPriceCents === 'number' ? h.oldPriceCents : undefined,
          currency: h.currency ? cleanNullBytes(h.currency) : 'EUR',
          imageUrl: h.imageUrl ? cleanNullBytes(h.imageUrl) : undefined,
          linkoutUrl: h.linkoutUrl ? cleanNullBytes(h.linkoutUrl) : undefined,
        }))
      : [],
  }));

  const coverImage =
    brochure.coverImage ||
    (pages.length > 0 && pages[0].imageUrl ? pages[0].imageUrl : 'https://placehold.co/600x800.png');

  return {
    id: cleanNullBytes(brochure.id || `b-${Math.random().toString(36).slice(2, 9)}`),
    storeId: cleanNullBytes(brochure.storeId || defaultStoreId),
    title: cleanNullBytes(brochure.title || 'Prospekt der Woche'),
    validFrom,
    validUntil,
    coverImage: cleanNullBytes(coverImage),
    pages,
  };
}

/**
 * Führt das Crawling für einen einzelnen Standort über alle aktiven Quellen aus,
 * spiegelt Bilder bei Bedarf nach R2 und nutzt den Deduplikations-Cache.
 */
export async function crawlLocation(
  location: BrochureLocation,
  sources: BrochureSource[],
  brochureCache: Map<string, CrawlerBrochure>,
  r2Config?: R2Config,
  localStorage?: LocalStorageConfig,
  r2UrlCache?: Map<string, string | Promise<string>>,
): Promise<LocationDump> {
  const stores = new Map<string, CrawlerStore>();
  const locationBrochures: CrawlerBrochure[] = [];
  const sourceErrors: unknown[] = [];
  let successfulSources = 0;

  for (const source of sources) {
    try {
      const results: ScraperResult[] = await source.fetchBrochuresForLocation(location);
      successfulSources += 1;

      for (const res of results) {
        stores.set(res.store.id, {
          id: cleanNullBytes(res.store.id),
          name: cleanNullBytes(res.store.name),
          logoUrl: res.store.logoUrl ? cleanNullBytes(res.store.logoUrl) : null,
        });

        for (const b of res.brochures) {
          let sanitized = brochureCache.get(b.id);
          if (!sanitized) {
            sanitized = sanitizeBrochure(b, res.store.id);

            // Wenn R2 aktiv ist: Bilder nach R2 spiegeln
            if (r2Config && r2UrlCache) {
              sanitized = await mirrorBrochureImagesToR2(sanitized, r2Config, r2UrlCache);
            } else if (localStorage && r2UrlCache) {
              sanitized = await mirrorBrochureImagesToLocal(sanitized, localStorage, r2UrlCache);
            }

            brochureCache.set(b.id, sanitized);
          }
          locationBrochures.push(sanitized);
        }
      }
    } catch (sourceErr) {
      sourceErrors.push(sourceErr);
      console.warn(`Fehler bei Quelle ${source.name} für PLZ ${location.zipCode}:`, sourceErr);
    }
  }

  if (successfulSources === 0) {
    throw new AggregateError(
      sourceErrors,
      `Alle Prospektquellen für PLZ ${location.zipCode} sind fehlgeschlagen.`,
    );
  }

  return cleanNullBytes({
    location,
    stores: [...stores.values()],
    brochures: locationBrochures,
  });
}

/**
 * Sichert Dumps atomar auf Festplatte.
 */
async function saveBackupToDisk(dumps: LocationDump[], backupPath: string | null): Promise<void> {
  if (!backupPath) return;

  try {
    const outDir = join(backupPath, '..');
    await mkdir(outDir, { recursive: true });
    const temporaryPath = `${backupPath}.tmp`;
    await writeFile(temporaryPath, JSON.stringify(dumps, null, 2), 'utf8');
    await rename(temporaryPath, backupPath);
  } catch {
    // Ignorieren
  }
}

/**
 * Führt das parallele Crawling über alle angegebenen Standorte aus, streamt Ergebnisse
 * per Callback und sichert Zwischenstände auf der Festplatte.
 */
export async function crawlAllLocations(
  locations: BrochureLocation[],
  options: CrawlEngineOptions,
): Promise<{ dumps: LocationDump[]; uniqueBrochuresCount: number }> {
  const concurrency = options.concurrency ?? 12;
  const brochureCache = new Map<string, CrawlerBrochure>();
  const r2UrlCache = new Map<string, string | Promise<string>>();
  const dumps: LocationDump[] = [];
  const backupPath =
    options.backupPath === undefined
      ? join(process.cwd(), 'tools', 'crawler', 'data', 'last_crawl_backup.json')
      : options.backupPath;
  let processed = 0;

  for (let i = 0; i < locations.length; i += concurrency) {
    const chunk = locations.slice(i, i + concurrency);
    const results = await Promise.allSettled(
      chunk.map((loc) =>
        crawlLocation(
          loc,
          options.sources,
          brochureCache,
          options.r2Config,
          options.localStorage,
          r2UrlCache,
        ),
      ),
    );

    const chunkDumps: LocationDump[] = [];
    const crawlErrors: unknown[] = [];
    for (const res of results) {
      if (res.status === 'fulfilled') {
        dumps.push(res.value);
        chunkDumps.push(res.value);
      } else {
        crawlErrors.push(res.reason);
      }
    }

    if (crawlErrors.length > 0) {
      await saveBackupToDisk(dumps, backupPath);
      throw new AggregateError(crawlErrors, `${crawlErrors.length} Standort-Crawls fehlgeschlagen.`);
    }

    processed += chunk.length;
    options.onProgress?.(processed, locations.length, brochureCache.size);

    // Leere Dumps werden nicht veröffentlicht. Ein bestehender gültiger Dump
    // bleibt dadurch bis zu seinem regulären Ablauf verfügbar.
    const publishableDumps = chunkDumps.filter((dump) => dump.brochures.length > 0);
    if (publishableDumps.length > 0 && options.onChunkDone) {
      await options.onChunkDone(publishableDumps);
    }

    // Alle 50 Standorte oder am Ende Zwischenstand auf Festplatte sichern
    if (processed % 50 === 0 || processed >= locations.length) {
      await saveBackupToDisk(dumps, backupPath);
    }
  }

  await saveBackupToDisk(dumps, backupPath);

  return {
    dumps,
    uniqueBrochuresCount: brochureCache.size,
  };
}
