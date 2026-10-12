#!/usr/bin/env bun

import { existsSync, readFileSync } from 'node:fs';
import { mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { loadTargetLocations } from '../locations';
import { transformLiveBrochure } from '../sources/live-offers';
import type { BrochureLocation, CrawlerPage } from '../types';

const inputPath = 'tools/crawler/data/listing-only/all-stores-full.json';
const outputPath = 'tools/crawler/data/listing-only/detail-pages.json';
const pageMetadataOutputPath = 'tools/crawler/data/listing-only/detail-page-metadata.json';
const progressPath = 'tools/crawler/data/listing-only/.detail-pages-progress.json';
const concurrency = 8;

type FullScanOffer = {
  brn: string;
  storeName?: string;
  title?: string;
  validFrom?: string;
  validUntil?: string;
};
type OfferMetadata = Required<FullScanOffer>;

export type FullScan = {
  byZipCode: Record<string, FullScanOffer[]>;
};

export type BrnReference = Pick<BrochureLocation, 'zipCode' | 'latitude' | 'longitude'> & {
  brn: string;
};

export type BringTokens = { authToken: string; apiKey: string; userUuid: string };

type Progress = {
  completed: Record<string, number>;
  metadata: Record<string, CachedPageMetadata>;
  failures: Record<string, string>;
};

export type CachedPageMetadata = {
  title: string;
  storeId: string;
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
      if (!offer.brn || references.has(offer.brn)) continue;
      references.set(offer.brn, {
        brn: offer.brn,
        zipCode,
        latitude: location.latitude,
        longitude: location.longitude,
      });
    }
  }

  return [...references.values()].sort((left, right) => left.brn.localeCompare(right.brn));
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

function pageMetadataFromDetail(offer: OfferMetadata, detail: unknown): CachedPageMetadata {
  const transformed = transformLiveBrochure({
    brn: offer.brn,
    title: offer.title,
    company: { title: offer.storeName },
    activeFrom: offer.validFrom,
    activeTo: offer.validUntil,
  }, detail);
  const pageCount = pageCountFromDetail(detail);
  if (!transformed) throw new Error('Bring-Detailantwort enthält keine nutzbaren Prospektseiten.');

  const pages = [...transformed.brochure.pages].sort((left, right) => left.number - right.number);
  if (pages.length !== pageCount || pages.some((page, index) => page.number !== index + 1)) {
    throw new Error(`Erwartet wurden ${pageCount} geordnete Seiten; Bring lieferte ${pages.length}.`);
  }
  if (pages.some((page) => page.imageUrl.trim().length === 0)) {
    throw new Error('Bring-Detailantwort enthält eine Seite ohne Bild-URL.');
  }

  return {
    title: offer.title,
    storeId: transformed.brochure.storeId,
    pageUrls: pages.map((page) => page.imageUrl),
    pages,
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
        typeof candidate.title === 'string' &&
        candidate.title.length > 0 &&
        typeof candidate.storeId === 'string' &&
        candidate.storeId.length > 0 &&
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
    const parsed = JSON.parse(await readFile(path, 'utf8')) as Partial<Progress>;
    return {
      completed: asPageCounts(parsed.completed),
      metadata: asPageMetadata(parsed.metadata),
      failures:
        typeof parsed.failures === 'object' && parsed.failures !== null
          ? (parsed.failures as Record<string, string>)
          : {},
    };
  } catch {
    return { completed: {}, metadata: {}, failures: {} };
  }
}

async function main(): Promise<void> {
  const fullScan = JSON.parse(await readFile(inputPath, 'utf8')) as FullScan;
  const locations = await loadTargetLocations({ all: true });
  const references = buildBrnReferences(fullScan, locations);
  if (references.length === 0) throw new Error('Im Voll-Scan wurden keine BRNs gefunden.');
  const offersByBrn = new Map<string, FullScanOffer>();
  for (const offers of Object.values(fullScan.byZipCode)) {
    for (const offer of offers) {
      if (!offersByBrn.has(offer.brn)) offersByBrn.set(offer.brn, offer);
    }
  }

  const headers = buildBringHeaders(loadBringTokens());
  const progress = await readProgress(progressPath);
  try {
    Object.assign(progress.completed, asPageCounts(JSON.parse(await readFile(outputPath, 'utf8'))));
  } catch {
    // The final output is optional while an interrupted run resumes from progress.
  }

  const pending = references.filter(({ brn }) => progress.metadata[brn] === undefined);
  console.log(
    `Detail-Seitenzahlen: ${pending.length} von ${references.length} BRNs ausstehend | Concurrency: ${concurrency}`,
  );

  for (let index = 0; index < pending.length; index += concurrency) {
    const batch = pending.slice(index, index + concurrency);
    await Promise.all(
      batch.map(async (reference) => {
        try {
          const detail = await fetchJsonWithRetry(buildDetailUrl(reference), headers);
          const offer = offersByBrn.get(reference.brn);
          if (
            !offer || !offer.storeName || !offer.title || !offer.validFrom || !offer.validUntil
          ) {
            throw new Error(`Voll-Scan-Metadaten für ${reference.brn} fehlen.`);
          }
          const metadata = pageMetadataFromDetail({
            brn: offer.brn,
            storeName: offer.storeName,
            title: offer.title,
            validFrom: offer.validFrom,
            validUntil: offer.validUntil,
          }, detail);
          progress.completed[reference.brn] = metadata.pages.length;
          progress.metadata[reference.brn] = metadata;
          delete progress.failures[reference.brn];
        } catch (error) {
          progress.failures[reference.brn] = error instanceof Error ? error.message : String(error);
        }
      }),
    );

    await writeJsonAtomic(progressPath, progress);
    if (index % (concurrency * 10) === 0 || index + batch.length === pending.length) {
      console.log(
        `${Math.min(index + batch.length, pending.length)}/${pending.length} BRNs verarbeitet | ${Object.keys(progress.failures).length} Hard-Failures`,
      );
    }
  }

  const missingBrns = references.filter(({ brn }) => progress.completed[brn] === undefined);
  const failures = missingBrns.map(({ brn }) => `${brn}: ${progress.failures[brn] ?? 'keine Detailantwort'}`);
  if (failures.length > 0) {
    console.error(`${failures.length} BRNs ohne Detail-Seitenzahl; Fortschritt bleibt in ${progressPath}.`);
    for (const failure of failures) console.error(failure);
    process.exitCode = 1;
    return;
  }

  const detailPages = Object.fromEntries(references.map(({ brn }) => [brn, progress.completed[brn]!]));
  const summary = summarizeDetailPages(detailPages);
  await writeJsonAtomic(outputPath, detailPages);
  await writeJsonAtomic(pageMetadataOutputPath, progress.metadata);
  await unlink(progressPath).catch(() => undefined);
  console.log(
    `Fertig: ${summary.totalBrns} BRNs, ${summary.multiplePageBrns} mit mehr als einer Seite (${summary.multiplePagePercent} %), 0 Hard-Failures.`,
  );
  console.log(`Report: ${outputPath}`);
}

if (process.argv[1]?.endsWith('fetch-detail-pages.ts')) {
  main().catch((error: unknown) => {
    console.error(`Fehler: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  });
}
