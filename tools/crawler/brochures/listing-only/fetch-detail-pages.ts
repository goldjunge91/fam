#!/usr/bin/env bun

import { existsSync, readFileSync } from 'node:fs';
import { appendFile, mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { loadTargetLocations } from '../locations';
import { bringImageUrl, requiredBringImageUrl } from '../bring-image-url';
import { transformLiveBrochure } from '../sources/live-offers';
import type { BrochureLocation, CrawlerPage } from '../types';

const inputPath = 'tools/crawler/data/listing-only/all-stores-full.json';
const outputPath = 'tools/crawler/data/listing-only/detail-pages.json';
const pageMetadataOutputPath = 'tools/crawler/data/listing-only/detail-page-metadata.json';
const progressPath = 'tools/crawler/data/listing-only/.detail-pages-progress.json';
const pageMetadataProgressPath = 'tools/crawler/data/listing-only/.detail-page-metadata-progress.jsonl';
const concurrency = 8;

type FullScanOffer = {
  brn: string;
  storeName?: string;
  title?: string;
  validFrom?: string;
  validUntil?: string;
  pageCount?: number;
  coverImage?: string;
};
type OfferMetadata = Required<Pick<FullScanOffer, 'brn' | 'storeName' | 'title' | 'validFrom' | 'validUntil'>> &
  Pick<FullScanOffer, 'pageCount' | 'coverImage'>;

export type FullScan = {
  byZipCode: Record<string, FullScanOffer[]>;
};

/** Stable identity for a Bring request before a location-independent identity is proven. */
export function regionalReferenceKey(zipCode: string, brn: string): string {
  return `${zipCode}:${encodeURIComponent(brn)}`;
}

export type BrnReference = Pick<BrochureLocation, 'zipCode' | 'latitude' | 'longitude'> & {
  brn: string;
  referenceKey: string;
};

export type BringTokens = { authToken: string; apiKey: string; userUuid: string };

type Progress = {
  completed: Record<string, number>;
  legacyMetadata?: Record<string, CachedPageMetadata>;
  failures: Record<string, string>;
};

export type CachedPageMetadata = {
  referenceKey: string;
  brn: string;
  zipCode: string;
  title: string;
  storeId: string;
  validFrom: string;
  validUntil: string;
  coverImage: string;
  pageUrls: string[];
  pages: CrawlerPage[];
};

export function buildBrnReferences(
  fullScan: FullScan,
  locations: BrochureLocation[],
): BrnReference[] {
  const locationsByZipCode = new Map(locations.map((location) => [location.zipCode, location]));
  const references = new Map<string, BrnReference>();

  for (const zipCode of Object.keys(fullScan.byZipCode).sort()) {
    const offers = fullScan.byZipCode[zipCode] ?? [];
    if (offers.length === 0) continue;

    const location = locationsByZipCode.get(zipCode);
    if (!location) throw new Error(`Keine Koordinaten für PLZ ${zipCode}`);

    for (const offer of offers) {
      if (!offer.brn) continue;
      const referenceKey = regionalReferenceKey(zipCode, offer.brn);
      if (references.has(referenceKey)) continue;
      references.set(referenceKey, {
        brn: offer.brn,
        referenceKey,
        zipCode,
        latitude: location.latitude,
        longitude: location.longitude,
      });
    }
  }

  return [...references.values()].sort(
    (left, right) => left.zipCode.localeCompare(right.zipCode) || left.brn.localeCompare(right.brn),
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isBringImageUrl(value: unknown): value is string {
  return typeof value === 'string' && bringImageUrl(value) !== null;
}

function sameTimestamp(left: unknown, right: unknown): boolean {
  if (typeof left !== 'string' || typeof right !== 'string') return false;
  const leftTime = Date.parse(left);
  const rightTime = Date.parse(right);
  return Number.isFinite(leftTime) && leftTime === rightTime;
}

export function pageCountFromDetail(value: unknown): number {
  if (typeof value !== 'object' || value === null || !('pages' in value)) {
    throw new Error('Bring-Detailantwort enthält keine Seiten.');
  }

  const pages = value.pages;
  if (!Array.isArray(pages) || pages.length === 0) {
    throw new Error('Bring-Detailantwort enthält keine Seiten.');
  }

  return pages.length;
}

function pageMetadataFromDetail(
  reference: BrnReference,
  offer: OfferMetadata,
  detail: unknown,
): CachedPageMetadata {
  const transformed = transformLiveBrochure({
    brn: offer.brn,
    title: offer.title,
    company: { title: offer.storeName },
    activeFrom: offer.validFrom,
    activeTo: offer.validUntil,
    ...(offer.coverImage ? { pages: [{ image: offer.coverImage }] } : {}),
  }, detail);
  const pageCount = pageCountFromDetail(detail);
  if (!transformed) throw new Error('Bring-Detailantwort enthält keine nutzbaren Prospektseiten.');
  if (offer.pageCount !== undefined && offer.pageCount !== pageCount) {
    throw new Error(`Erwartet wurden ${offer.pageCount} Seiten aus dem Listing; Bring lieferte ${pageCount}.`);
  }

  const pages = [...transformed.brochure.pages].sort((left, right) => left.number - right.number);
  if (pages.length !== pageCount || pages.some((page, index) => page.number !== index + 1)) {
    throw new Error(`Erwartet wurden ${pageCount} geordnete Seiten; Bring lieferte ${pages.length}.`);
  }
  if (pages.some((page) => page.imageUrl.trim().length === 0)) {
    throw new Error('Bring-Detailantwort enthält eine Seite ohne Bild-URL.');
  }

  const validatedPages = pages.map((page) => ({
    ...page,
    imageUrl: requiredBringImageUrl(page.imageUrl, `Seite ${page.number}`),
    hotspots: page.hotspots.map((hotspot) => ({
      ...hotspot,
      ...(hotspot.imageUrl
        ? { imageUrl: requiredBringImageUrl(hotspot.imageUrl, `Hotspot ${hotspot.id}`) }
        : {}),
    })),
  }));

  return {
    referenceKey: reference.referenceKey,
    brn: reference.brn,
    zipCode: reference.zipCode,
    title: offer.title,
    storeId: transformed.brochure.storeId,
    validFrom: offer.validFrom,
    validUntil: offer.validUntil,
    coverImage: requiredBringImageUrl(transformed.brochure.coverImage, 'Prospektcover'),
    pageUrls: validatedPages.map((page) => page.imageUrl),
    pages: validatedPages,
  };
}

export function summarizeDetailPages(detailPages: Record<string, number>) {
  const pageCounts = Object.values(detailPages);
  const multiplePageBrns = pageCounts.filter((pageCount) => pageCount > 1).length;

  return {
    totalBrns: pageCounts.length,
    multiplePageBrns,
    multiplePagePercent:
      pageCounts.length === 0 ? 0 : Math.round((multiplePageBrns / pageCounts.length) * 1000) / 10,
  };
}

export function loadBringTokens(): BringTokens {
  let authToken = process.env.BRING_AUTH_TOKEN?.trim();
  let apiKey = process.env.BRING_API_KEY?.trim();
  let userUuid = process.env.BRING_USER_UUID?.trim();

  if (existsSync('tokens_backup.env')) {
    const content = readFileSync('tokens_backup.env', 'utf8');
    const get = (key: string): string | undefined => {
      for (const line of content.split(/\r?\n/)) {
        const match = line.match(/^([^=]+)=(.*)$/);
        if (match?.[1]?.trim() === key) {
          return match[2]?.trim().replace(/^["]|["]$/g, '');
        }
      }
      return undefined;
    };
    authToken ??= get('BRING_AUTH_TOKEN');
    apiKey ??= get('BRING_API_KEY');
    userUuid ??= get('BRING_USER_UUID');
  }

  if (!authToken || !apiKey || !userUuid) {
    throw new Error('BRING_AUTH_TOKEN, BRING_API_KEY und BRING_USER_UUID erforderlich.');
  }

  return { authToken, apiKey, userUuid };
}

export function buildBringHeaders(tokens: BringTokens): Record<string, string> {
  return {
    Authorization: `Bearer ${tokens.authToken}`,
    'X-BRING-API-KEY': tokens.apiKey,
    'X-BRING-CLIENT': 'iOS',
    'X-BRING-COUNTRY': 'DE',
    'X-BRING-VERSION': '4.110.0',
    'X-BRING-USER-UUID': tokens.userUuid,
    'Accept-Language': 'de-DE',
    Accept: 'application/json',
  };
}

export function buildDetailUrl(reference: BrnReference): string {
  const params = new URLSearchParams({
    brochureId: reference.brn,
    lat: String(reference.latitude),
    long: String(reference.longitude),
    providerId: 'bring-de',
    zipCode: reference.zipCode,
  });
  return `https://production.bringapi.app/offers/rest/v1/offers/brochures/${encodeURIComponent(reference.brn)}?${params}`;
}

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export async function fetchJsonWithRetry(
  url: string,
  headers: Record<string, string>,
): Promise<unknown> {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers,
        signal: AbortSignal.timeout(30_000),
      });
      if (response.ok) return await response.json();

      const retryable = response.status === 429 || response.status >= 500;
      if (!retryable || attempt === 3) {
        throw new Error(`Bring API ${response.status} fuer ${new URL(url).pathname}`);
      }

      const retryAfter = Number(response.headers.get('retry-after'));
      const delay = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 2 ** attempt * 1000;
      await wait(Math.min(delay, 30_000));
    } catch (error) {
      if (attempt === 3 || (error instanceof Error && error.message.startsWith('Bring API 4'))) {
        throw error;
      }
      await wait(2 ** attempt * 1000);
    }
  }

  throw new Error('Bring API konnte nicht erreicht werden.');
}

async function writeJsonAtomic(path: string, value: unknown): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const temporaryPath = `${path}.${process.pid}.tmp`;
  await writeFile(temporaryPath, JSON.stringify(value, null, 2), 'utf8');
  await rename(temporaryPath, path);
}

function asPageCounts(value: unknown): Record<string, number> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value).filter(
      ([brn, pageCount]) => brn.length > 0 && Number.isInteger(pageCount) && (pageCount as number) > 0,
    ),
  ) as Record<string, number>;
}

function asPageMetadata(value: unknown): Record<string, CachedPageMetadata> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => {
      if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) return false;
      const candidate = entry as Partial<CachedPageMetadata>;
      return Boolean(
        typeof candidate.referenceKey === 'string' &&
        typeof candidate.brn === 'string' &&
        typeof candidate.zipCode === 'string' &&
        /^\d{5}$/.test(candidate.zipCode) &&
        candidate.referenceKey === regionalReferenceKey(candidate.zipCode, candidate.brn) &&
        typeof candidate.title === 'string' &&
        candidate.title.length > 0 &&
        typeof candidate.storeId === 'string' &&
        candidate.storeId.length > 0 &&
        typeof candidate.validFrom === 'string' &&
        typeof candidate.validUntil === 'string' &&
        isBringImageUrl(candidate.coverImage) &&
        Array.isArray(candidate.pageUrls) &&
        Array.isArray(candidate.pages) &&
        candidate.pageUrls.length === candidate.pages.length &&
        candidate.pages.every((page, index) =>
          page?.number === index + 1 &&
          typeof page.imageUrl === 'string' &&
          page.imageUrl === candidate.pageUrls?.[index] &&
          Array.isArray(page.hotspots),
        ),
      );
    }),
  ) as Record<string, CachedPageMetadata>;
}

async function readProgress(path: string): Promise<Progress> {
  try {
    const parsed = JSON.parse(await readFile(path, 'utf8')) as Partial<Progress> & { metadata?: unknown };
    return {
      completed: asPageCounts(parsed.completed),
      legacyMetadata: asPageMetadata(parsed.metadata),
      failures:
        typeof parsed.failures === 'object' && parsed.failures !== null
          ? (parsed.failures as Record<string, string>)
          : {},
    };
  } catch {
    return { completed: {}, failures: {} };
  }
}

async function readPageMetadataProgress(path: string): Promise<Record<string, CachedPageMetadata>> {
  try {
    const content = await readFile(path, 'utf8');
    const metadata: Record<string, CachedPageMetadata> = {};
    for (const line of content.split(/\r?\n/)) {
      if (!line) continue;
      try {
        const entry = JSON.parse(line) as unknown;
        if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) continue;
        const record = entry as { referenceKey?: unknown; metadata?: unknown };
        if (typeof record.referenceKey !== 'string' || !record.referenceKey) continue;
        const parsed = asPageMetadata({ [record.referenceKey]: record.metadata });
        if (parsed[record.referenceKey]) metadata[record.referenceKey] = parsed[record.referenceKey]!;
      } catch {
        // An interrupted append can leave one incomplete trailing line; missing entries are refetched.
      }
    }
    return metadata;
  } catch {
    return {};
  }
}

export function reusableDetailMetadataFromCatalog(options: {
  reference: BrnReference;
  offer: OfferMetadata;
  row: unknown;
  now?: Date;
}): CachedPageMetadata | undefined {
  if (!isRecord(options.row)) return undefined;
  if (
    options.row.canonical_brn !== options.reference.brn ||
    options.row.source_zip_code !== options.reference.zipCode ||
    options.row.title !== options.offer.title ||
    !sameTimestamp(options.row.valid_from, options.offer.validFrom) ||
    !sameTimestamp(options.row.valid_until, options.offer.validUntil) ||
    typeof options.row.store_id !== 'string'
  ) return undefined;
  if (
    isRecord(options.row.store) &&
    typeof options.row.store.name === 'string' &&
    options.row.store.name !== options.offer.storeName
  ) return undefined;

  const validUntil = Date.parse(String(options.row.valid_until));
  if (!Number.isFinite(validUntil) || validUntil < (options.now ?? new Date()).getTime()) return undefined;

  const pageCount = options.row.page_count;
  if (
    typeof pageCount !== 'number' || !Number.isSafeInteger(pageCount) || pageCount < 1 ||
    (options.offer.pageCount !== undefined && options.offer.pageCount > 0 && options.offer.pageCount !== pageCount)
  ) return undefined;
  if (!Array.isArray(options.row.pages) || options.row.pages.length !== pageCount) return undefined;

  try {
    const pages = options.row.pages.map((value, index): CrawlerPage => {
      if (!isRecord(value) || value.number !== index + 1 || !Array.isArray(value.hotspots)) {
        throw new Error('invalid pages');
      }
      return {
        number: index + 1,
        imageUrl: requiredBringImageUrl(value.imageUrl, `Katalogseite ${index + 1}`),
        hotspots: value.hotspots.map((hotspot) => {
          if (!isRecord(hotspot)) throw new Error('invalid hotspot');
          return {
            ...hotspot,
            ...(hotspot.imageUrl
              ? { imageUrl: requiredBringImageUrl(hotspot.imageUrl, 'Katalog-Hotspot') }
              : {}),
          } as CrawlerPage['hotspots'][number];
        }),
      };
    });
    const coverImage = requiredBringImageUrl(options.row.cover_image, 'Katalogcover');
    if (options.offer.coverImage && coverImage !== requiredBringImageUrl(options.offer.coverImage, 'Listingcover')) return undefined;
    return {
      referenceKey: options.reference.referenceKey,
      brn: options.reference.brn,
      zipCode: options.reference.zipCode,
      title: options.offer.title,
      storeId: options.row.store_id,
      validFrom: options.offer.validFrom,
      validUntil: options.offer.validUntil,
      coverImage,
      pageUrls: pages.map((page) => page.imageUrl),
      pages,
    };
  } catch {
    return undefined;
  }
}

export async function loadReusableDetailMetadata(options: {
  references: readonly BrnReference[];
  offersByReference: ReadonlyMap<string, FullScanOffer>;
  supabaseUrl?: string;
  supabaseSecretKey?: string;
  fetcher?: typeof fetch;
  now?: Date;
}): Promise<Record<string, CachedPageMetadata>> {
  const supabaseUrl = options.supabaseUrl?.trim();
  const supabaseSecretKey = options.supabaseSecretKey?.trim();
  if (!supabaseUrl || !supabaseSecretKey) return {};

  const fetcher = options.fetcher ?? fetch;
  const reusable: Record<string, CachedPageMetadata> = {};
  const referencesByZip = new Map<string, BrnReference[]>();
  for (const reference of options.references) {
    const references = referencesByZip.get(reference.zipCode) ?? [];
    references.push(reference);
    referencesByZip.set(reference.zipCode, references);
  }

  const referenceBatches = [...referencesByZip.entries()].flatMap(([zipCode, references]) =>
    Array.from({ length: Math.ceil(references.length / 100) }, (_, batchIndex) => ({
      zipCode,
      references: references.slice(batchIndex * 100, (batchIndex + 1) * 100),
    })),
  );

  for (const batch of referenceBatches) {
    const query = new URLSearchParams({
      select: 'canonical_brn,source_zip_code,title,store_id,valid_from,valid_until,page_count,cover_image,pages,store:brochure_stores!inner(name)',
      canonical_brn: `in.(${batch.references.map(({ brn }) => `"${brn.replaceAll('\\', '\\\\').replaceAll('"', '\\"')}"`).join(',')})`,
      source_zip_code: `eq.${batch.zipCode}`,
      valid_until: `gte.${(options.now ?? new Date()).toISOString()}`,
      limit: '100',
    });
    const response = await fetcher(
      `${supabaseUrl.replace(/\/+$/, '')}/rest/v1/canonical_brochures?${query.toString()}`,
      {
        headers: {
          apikey: supabaseSecretKey,
          Accept: 'application/json',
        },
      },
    );
    if (!response.ok) throw new Error(`Katalogdetails konnten nicht gelesen werden (${response.status}).`);
    const rows = await response.json() as unknown;
    if (!Array.isArray(rows)) throw new Error('Katalogdetails haben kein gültiges Listenformat.');

    const rowsByBrn = new Map<string, unknown[]>();
    for (const row of rows) {
      if (!isRecord(row) || typeof row.canonical_brn !== 'string') continue;
      const matchingRows = rowsByBrn.get(row.canonical_brn) ?? [];
      matchingRows.push(row);
      rowsByBrn.set(row.canonical_brn, matchingRows);
    }

    for (const reference of batch.references) {
      const offer = options.offersByReference.get(reference.referenceKey);
      const matchingRows = rowsByBrn.get(reference.brn);
      if (!offer || !offer.title || !offer.validFrom || !offer.validUntil || matchingRows?.length !== 1) continue;
      const metadata = reusableDetailMetadataFromCatalog({
        reference,
        offer: {
          brn: reference.brn,
          title: offer.title,
          storeName: offer.storeName ?? '',
          validFrom: offer.validFrom,
          validUntil: offer.validUntil,
          pageCount: offer.pageCount,
          coverImage: offer.coverImage,
        },
        row: matchingRows[0],
        now: options.now,
      });
      if (metadata) reusable[reference.referenceKey] = metadata;
    }
  }
  return reusable;
}

async function main(): Promise<void> {
  const fullScan = JSON.parse(await readFile(inputPath, 'utf8')) as FullScan;
  const locations = await loadTargetLocations({ all: true });
  const references = buildBrnReferences(fullScan, locations);
  if (references.length === 0) throw new Error('Im Voll-Scan wurden keine BRNs gefunden.');

  const offersByReference = new Map<string, FullScanOffer>();
  for (const [zipCode, offers] of Object.entries(fullScan.byZipCode)) {
    for (const offer of offers) {
      const referenceKey = regionalReferenceKey(zipCode, offer.brn);
      if (!offersByReference.has(referenceKey)) offersByReference.set(referenceKey, offer);
    }
  }

  const headers = buildBringHeaders(loadBringTokens());
  const progress = await readProgress(progressPath);
  const reusableCatalogMetadata = await loadReusableDetailMetadata({
    references,
    offersByReference,
    supabaseUrl: process.env.SUPABASE_URL,
    supabaseSecretKey: process.env.SUPABASE_SECRET_KEY,
  });
  const pageMetadata = {
    ...reusableCatalogMetadata,
    ...progress.legacyMetadata,
    ...(await readPageMetadataProgress(pageMetadataProgressPath)),
  };
  delete progress.legacyMetadata;
  for (const reference of references) {
    const offer = offersByReference.get(reference.referenceKey);
    const cached = pageMetadata[reference.referenceKey];
    if (!cached) continue;
    const listingCover = offer?.coverImage
      ? requiredBringImageUrl(offer.coverImage, `Listingcover ${reference.referenceKey}`)
      : undefined;
    if (
      !offer ||
      cached.title !== offer.title ||
      cached.validFrom !== offer.validFrom ||
      cached.validUntil !== offer.validUntil ||
      (offer.pageCount !== undefined && offer.pageCount > 0 && cached.pages.length !== offer.pageCount) ||
      (listingCover !== undefined && cached.coverImage !== listingCover)
    ) {
      delete pageMetadata[reference.referenceKey];
      delete progress.completed[reference.referenceKey];
    }
  }
  for (const [referenceKey, metadata] of Object.entries(pageMetadata)) {
    progress.completed[referenceKey] = metadata.pages.length;
  }
  try {
    Object.assign(progress.completed, asPageCounts(JSON.parse(await readFile(outputPath, 'utf8'))));
  } catch {
    // The final output is optional while an interrupted run resumes from progress.
  }

  const pending = references.filter(({ referenceKey }) => pageMetadata[referenceKey] === undefined);
  console.log(
    `Detail-Seitenzahlen: ${pending.length} von ${references.length} regionalen Referenzen ausstehend | Concurrency: ${concurrency}`,
  );

  for (let index = 0; index < pending.length; index += concurrency) {
    const batch = pending.slice(index, index + concurrency);
    const newMetadata: Array<{ referenceKey: string; metadata: CachedPageMetadata }> = [];
    await Promise.all(
      batch.map(async (reference) => {
        try {
          const detail = await fetchJsonWithRetry(buildDetailUrl(reference), headers);
          const offer = offersByReference.get(reference.referenceKey);
          if (
            !offer || !offer.storeName || !offer.title || !offer.validFrom || !offer.validUntil
          ) {
            throw new Error(`Voll-Scan-Metadaten für ${reference.referenceKey} fehlen.`);
          }
          const metadata = pageMetadataFromDetail(reference, {
            brn: offer.brn,
            storeName: offer.storeName,
            title: offer.title,
            validFrom: offer.validFrom,
            validUntil: offer.validUntil,
            pageCount: offer.pageCount,
            coverImage: offer.coverImage,
          }, detail);
          progress.completed[reference.referenceKey] = metadata.pages.length;
          pageMetadata[reference.referenceKey] = metadata;
          newMetadata.push({ referenceKey: reference.referenceKey, metadata });
          delete progress.failures[reference.referenceKey];
        } catch (error) {
          progress.failures[reference.referenceKey] = error instanceof Error ? error.message : String(error);
        }
      }),
    );

    if (newMetadata.length > 0) {
      await appendFile(
        pageMetadataProgressPath,
        `${newMetadata.map((entry) => JSON.stringify(entry)).join('\n')}\n`,
        'utf8',
      );
    }
    await writeJsonAtomic(progressPath, progress);
    if (index % (concurrency * 10) === 0 || index + batch.length === pending.length) {
      console.log(
        `${Math.min(index + batch.length, pending.length)}/${pending.length} Referenzen verarbeitet | ${Object.keys(progress.failures).length} Hard-Failures`,
      );
    }
  }

  const missingReferences = references.filter(({ referenceKey }) => pageMetadata[referenceKey] === undefined);
  const failures = missingReferences.map(({ referenceKey }) => `${referenceKey}: ${progress.failures[referenceKey] ?? 'keine Detailantwort'}`);
  if (failures.length > 0) {
    console.error(`${failures.length} regionale Referenzen ohne Detail-Seitenzahl; Fortschritt bleibt in ${progressPath}.`);
    for (const failure of failures) console.error(failure);
    process.exitCode = 1;
    return;
  }

  const detailPages = Object.fromEntries(
    references.map(({ referenceKey }) => [referenceKey, progress.completed[referenceKey]!]),
  );
  const summary = summarizeDetailPages(detailPages);
  await writeJsonAtomic(outputPath, detailPages);
  await writeJsonAtomic(pageMetadataOutputPath, pageMetadata);
  await unlink(progressPath).catch(() => undefined);
  await unlink(pageMetadataProgressPath).catch(() => undefined);
  console.log(
    `Fertig: ${summary.totalBrns} regionale Referenzen, ${summary.multiplePageBrns} mit mehr als einer Seite (${summary.multiplePagePercent} %), 0 Hard-Failures.`,
  );
  console.log(`Report: ${outputPath}`);
}

if (process.argv[1]?.endsWith('fetch-detail-pages.ts')) {
  main().catch((error: unknown) => {
    console.error(`Fehler: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  });
}
