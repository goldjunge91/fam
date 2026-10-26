#!/usr/bin/env bun

import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { CachedPageMetadata } from './fetch-detail-pages';
import { regionalReferenceKey } from './fetch-detail-pages';
import { bringImageUrl, requiredBringImageUrl } from '../bring-image-url';
import type { CrawlerHotspot, CrawlerPage } from '../types';

export type PersistedCanonicalBrochure = {
  canonicalBrn: string;
  sourceZipCode: string;
  storeName: string;
  storeId: string;
  title: string;
  validFrom: string;
  validUntil: string;
  pageCount: number;
  availableZipCodes: string[];
  coverImage: string;
  pageUrls: string[];
  pages: CrawlerPage[];
};

export type PersistCanonicalArguments = {
  inputPath: string;
  detailPageMetadataPath: string;
  outputPath: string;
};

const defaultArguments: PersistCanonicalArguments = {
  inputPath: 'tools/crawler/data/listing-only/all-stores-full.json',
  detailPageMetadataPath: 'tools/crawler/data/listing-only/detail-page-metadata.json',
  outputPath: 'tools/crawler/data/listing-only/canonical-brochures.json',
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requiredString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`${field} must be a non-empty string`);
  }
  return value;
}

function positiveInteger(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 1) {
    throw new Error(`${field} must be a positive safe integer`);
  }
  return value;
}

function isCrawlerHotspot(value: unknown): value is CrawlerHotspot {
  if (!isRecord(value)) return false;
  if (value.kind !== 'discount' && value.kind !== 'linkout' && value.kind !== 'unknown') return false;
  return typeof value.id === 'string' && typeof value.title === 'string' &&
    ['x', 'y', 'width', 'height'].every(
      (field) => typeof value[field] === 'number' && Number.isFinite(value[field]),
    );
}

function parsePages(value: unknown, label: string): CrawlerPage[] {
  if (!Array.isArray(value) || value.length === 0) throw new Error(`${label} must contain pages`);
  return value.map((entry, index) => {
    if (!isRecord(entry) || entry.number !== index + 1) {
      throw new Error(`${label} pages must be ordered from page 1`);
    }
    const imageUrl = requiredBringImageUrl(entry.imageUrl, `${label} page ${index + 1}`);
    if (!Array.isArray(entry.hotspots) || !entry.hotspots.every(isCrawlerHotspot)) {
      throw new Error(`${label} page ${index + 1} has invalid hotspots`);
    }
    return {
      number: index + 1,
      imageUrl,
      hotspots: entry.hotspots.map((hotspot) => ({
        ...hotspot,
        ...(hotspot.imageUrl
          ? { imageUrl: requiredBringImageUrl(hotspot.imageUrl, `${label} hotspot`) }
          : {}),
      })),
    };
  });
}

function parseMetadata(value: unknown): Record<string, CachedPageMetadata> {
  if (!isRecord(value)) throw new Error('Detail page metadata must be an object');
  const result: Record<string, CachedPageMetadata> = {};
  for (const [referenceKey, entry] of Object.entries(value)) {
    if (!isRecord(entry)) throw new Error(`Detail metadata ${referenceKey} must be an object`);
    const brn = requiredString(entry.brn, `${referenceKey} BRN`);
    const sourceZipCode = requiredString(entry.zipCode, `${referenceKey} ZIP code`);
    if (!/^\d{5}$/.test(sourceZipCode) || regionalReferenceKey(sourceZipCode, brn) !== referenceKey) {
      throw new Error(`Detail metadata ${referenceKey} has an invalid ZIP/BRN identity`);
    }
    const pages = parsePages(entry.pages, `Detail metadata ${referenceKey}`);
    const coverImage = requiredBringImageUrl(entry.coverImage, `${referenceKey} cover image`);
    const pageUrls = Array.isArray(entry.pageUrls)
      ? entry.pageUrls.map((url, index) => requiredBringImageUrl(url, `${referenceKey} page URL ${index + 1}`))
      : [];
    if (pageUrls.length !== pages.length || pageUrls.some((url, index) => url !== pages[index]?.imageUrl)) {
      throw new Error(`Detail metadata ${referenceKey} page URLs disagree with its pages`);
    }
    result[referenceKey] = {
      referenceKey,
      brn,
      zipCode: sourceZipCode,
      title: requiredString(entry.title, `${referenceKey} title`),
      storeId: requiredString(entry.storeId, `${referenceKey} storeId`),
      validFrom: requiredString(entry.validFrom, `${referenceKey} validFrom`),
      validUntil: requiredString(entry.validUntil, `${referenceKey} validUntil`),
      coverImage,
      pageUrls,
      pages,
    };
  }
  return result;
}

export function buildPersistedCanonicalBrochures(value: unknown): PersistedCanonicalBrochure[] {
  if (!isRecord(value) || !isRecord(value.fullScan) || !isRecord(value.detailPageMetadata)) {
    throw new Error('Persistence input must contain fullScan and detailPageMetadata');
  }
  const fullScan = value.fullScan;
  if (!isRecord(fullScan.byZipCode)) throw new Error('Full scan must contain a byZipCode object');
  const metadata = parseMetadata(value.detailPageMetadata);
  const listingByReference = new Map<string, {
    referenceKey: string;
    zipCode: string;
    brn: string;
    storeName: string;
    title: string;
    validFrom: string;
    validUntil: string;
    coverImage?: string;
  }>();

  for (const zipCode of Object.keys(fullScan.byZipCode).sort()) {
    if (!/^\d{5}$/.test(zipCode)) throw new Error(`Invalid full-scan ZIP code ${zipCode}`);
    const offers = fullScan.byZipCode[zipCode];
    if (!Array.isArray(offers)) throw new Error(`Offers for ZIP ${zipCode} must be an array`);
    for (const [index, rawOffer] of offers.entries()) {
      if (!isRecord(rawOffer)) throw new Error(`Offer ${index + 1} for ZIP ${zipCode} must be an object`);
      const brn = requiredString(rawOffer.brn, `BRN for ZIP ${zipCode}`);
      const referenceKey = regionalReferenceKey(zipCode, brn);
      const storeName = requiredString(rawOffer.storeName, `${referenceKey} storeName`);
      const title = requiredString(rawOffer.title, `${referenceKey} title`);
      const validFrom = requiredString(rawOffer.validFrom, `${referenceKey} validFrom`);
      const validUntil = requiredString(rawOffer.validUntil, `${referenceKey} validUntil`);
      const coverImage = typeof rawOffer.coverImage === 'string'
        ? bringImageUrl(rawOffer.coverImage)?.toString()
        : undefined;
      const existing = listingByReference.get(referenceKey);
      if (existing) {
        if (
          existing.storeName !== storeName ||
          existing.title !== title ||
          existing.validFrom !== validFrom ||
          existing.validUntil !== validUntil ||
          (existing.coverImage !== undefined && coverImage !== undefined && existing.coverImage !== coverImage)
        ) {
          throw new Error(`Bring-Listingmetadaten für ${referenceKey} unterscheiden sich innerhalb derselben PLZ`);
        }
        existing.coverImage ??= coverImage;
      } else {
        listingByReference.set(referenceKey, {
          referenceKey,
          zipCode,
          brn,
          storeName,
          title,
          validFrom,
          validUntil,
          ...(coverImage ? { coverImage } : {}),
        });
      }
    }
  }

  const brochures: PersistedCanonicalBrochure[] = [];
  for (const [referenceKey, listing] of [...listingByReference.entries()].sort(([left], [right]) => left.localeCompare(right))) {
    const detail = metadata[referenceKey];
    if (!detail) throw new Error(`Missing complete detail metadata for ${referenceKey}`);
    if (detail.zipCode !== listing.zipCode) {
      throw new Error(`Detail metadata ${referenceKey} was fetched for a different ZIP`);
    }
    if (detail.title !== listing.title) throw new Error(`Detail metadata ${referenceKey} title differs from listing`);
    if (detail.validFrom !== listing.validFrom || detail.validUntil !== listing.validUntil) {
      throw new Error(`Detail metadata ${referenceKey} validity differs from listing`);
    }
    if (listing.coverImage !== undefined && listing.coverImage !== detail.coverImage) {
      throw new Error(`Detail metadata ${referenceKey} cover differs from listing`);
    }

    const pages = detail.pages.map((page) => ({ ...page, hotspots: [...page.hotspots] }));
    brochures.push({
      canonicalBrn: listing.brn,
      sourceZipCode: listing.zipCode,
      storeName: listing.storeName,
      storeId: detail.storeId,
      title: listing.title,
      validFrom: listing.validFrom,
      validUntil: listing.validUntil,
      pageCount: pages.length,
      availableZipCodes: [listing.zipCode],
      coverImage: detail.coverImage,
      pageUrls: pages.map(({ imageUrl }) => imageUrl),
      pages,
    });
  }

  return brochures.sort(
    (left, right) => left.sourceZipCode.localeCompare(right.sourceZipCode) || left.canonicalBrn.localeCompare(right.canonicalBrn),
  );
}

export function parsePersistCanonicalArguments(args: readonly string[]): PersistCanonicalArguments {
  const result = { ...defaultArguments };
  const flags: Record<string, keyof PersistCanonicalArguments> = {
    '--input': 'inputPath',
    '--detail-page-metadata': 'detailPageMetadataPath',
    '--output': 'outputPath',
  };

  for (let index = 0; index < args.length; index++) {
    const argument = args[index];
    if (!argument) continue;
    const equalsIndex = argument.indexOf('=');
    const flag = equalsIndex < 0 ? argument : argument.slice(0, equalsIndex);
    const field = flags[flag];
    if (!field) throw new Error(`Unknown argument: ${argument}`);
    const path = equalsIndex < 0 ? args[++index] : argument.slice(equalsIndex + 1);
    if (!path || path.startsWith('--')) throw new Error(`Expected a path after ${flag}`);
    result[field] = path;
  }
  return result;
}

async function main(): Promise<void> {
  const args = parsePersistCanonicalArguments(process.argv.slice(2));
  const [fullScan, detailPageMetadata] = await Promise.all([
    readFile(args.inputPath, 'utf8').then((contents) => JSON.parse(contents) as unknown),
    readFile(args.detailPageMetadataPath, 'utf8').then((contents) => JSON.parse(contents) as unknown),
  ]);
  const brochures = buildPersistedCanonicalBrochures({ fullScan, detailPageMetadata });
  const output = { generatedAt: new Date().toISOString(), brochures };

  await mkdir(dirname(args.outputPath), { recursive: true });
  const temporaryPath = `${args.outputPath}.${process.pid}.tmp`;
  await writeFile(temporaryPath, JSON.stringify(output, null, 2), 'utf8');
  await rename(temporaryPath, args.outputPath);
    console.log(`Eindeutige BRNs: ${brochures.length} | Report: ${args.outputPath}`);
}

if (process.argv[1]?.endsWith('persist-canonical.ts')) {
  main().catch((error: unknown) => {
    console.error(`Fehler: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  });
}
