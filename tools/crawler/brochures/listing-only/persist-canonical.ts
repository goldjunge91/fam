#!/usr/bin/env bun

import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { hashOrderedPageSet, type PageContentHash } from './full-brochure-signature';
import type { CrawlerHotspot, CrawlerPage } from '../types';

export type PersistedCanonicalBrochure = {
  canonicalBrn: string;
  storeName: string;
  storeId: string;
  title: string;
  validFrom: string;
  validUntil: string;
  pageCount: number;
  availableZipCodes: string[];
  verifiedSha256: string;
  verifiedPageHashes: PageContentHash[];
  coverImage: string;
  pageUrls: string[];
  pages: CrawlerPage[];
};

export type PersistCanonicalArguments = {
  verificationPath: string;
  outputPath: string;
};

const defaultArguments: PersistCanonicalArguments = {
  verificationPath: 'tools/crawler/data/listing-only/canonical-page-verification.json',
  outputPath: 'tools/crawler/data/listing-only/canonical-brochures.json',
};

const SHA256_PATTERN = /^[a-f0-9]{64}$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requiredString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.length === 0) {
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

function stringArray(value: unknown, field: string, allowDuplicates = false): string[] {
  if (!Array.isArray(value)) throw new Error(`${field} must be an array`);
  const values = value.map((entry) => requiredString(entry, field));
  if (!allowDuplicates && new Set(values).size !== values.length) {
    throw new Error(`${field} must not contain duplicates`);
  }
  return values;
}

function isOptionalString(record: Record<string, unknown>, field: string): boolean {
  return record[field] === undefined || typeof record[field] === 'string';
}

function isOptionalFiniteNumber(record: Record<string, unknown>, field: string): boolean {
  return record[field] === undefined ||
    (typeof record[field] === 'number' && Number.isFinite(record[field]));
}

function isCrawlerHotspot(value: unknown): value is CrawlerHotspot {
  if (!isRecord(value)) return false;
  if (value.kind !== 'discount' && value.kind !== 'linkout' && value.kind !== 'unknown') {
    return false;
  }
  if (
    typeof value.id !== 'string' ||
    typeof value.title !== 'string' ||
    !['x', 'y', 'width', 'height'].every(
      (field) => typeof value[field] === 'number' && Number.isFinite(value[field]),
    )
  ) {
    return false;
  }

  return [
    'description',
    'discount',
    'priceLabel',
    'currency',
    'imageUrl',
    'linkoutUrl',
  ].every((field) => isOptionalString(value, field)) &&
    ['priceCents', 'oldPriceCents'].every((field) => isOptionalFiniteNumber(value, field));
}

function parsePageHashes(value: unknown, pageCount: number, variantLabel: string): PageContentHash[] {
  if (!Array.isArray(value)) throw new Error(`${variantLabel} pageHashes must be an array`);
  if (value.length !== pageCount) {
    throw new Error(`${variantLabel} expected ${pageCount} page hashes, received ${value.length}`);
  }

  const pageHashes = value.map((entry, index) => {
    if (!isRecord(entry)) throw new Error(`${variantLabel} page hash ${index + 1} must be an object`);
    const pageNumber = positiveInteger(entry.pageNumber, `${variantLabel} page hash number`);
    if (pageNumber !== index + 1) {
      throw new Error(`${variantLabel} page hashes must be ordered from page 1 to ${pageCount}`);
    }
    const sha256 = requiredString(entry.sha256, `${variantLabel} page hash`);
    if (!SHA256_PATTERN.test(sha256)) {
      throw new Error(`${variantLabel} page ${pageNumber} has an invalid SHA-256 hash`);
    }
    return { pageNumber, sha256 };
  });

  return pageHashes;
}

function parsePages(
  value: unknown,
  pageUrls: string[],
  pageCount: number,
  variantLabel: string,
): CrawlerPage[] {
  if (!Array.isArray(value)) throw new Error(`${variantLabel} pages must be an array`);
  if (value.length !== pageCount) {
    throw new Error(`${variantLabel} expected ${pageCount} pages, received ${value.length}`);
  }

  return value.map((entry, index) => {
    if (!isRecord(entry)) throw new Error(`${variantLabel} page ${index + 1} must be an object`);
    const number = positiveInteger(entry.number, `${variantLabel} page number`);
    const imageUrl = requiredString(entry.imageUrl, `${variantLabel} page image URL`);
    if (number !== index + 1 || imageUrl !== pageUrls[index]) {
      throw new Error(`${variantLabel} pages must match the ordered page URLs from page 1`);
    }
    if (!Array.isArray(entry.hotspots) || !entry.hotspots.every(isCrawlerHotspot)) {
      throw new Error(`${variantLabel} page ${number} has invalid hotspots`);
    }
    return { number, imageUrl, hotspots: entry.hotspots };
  });
}

function parseVariant(
  value: unknown,
  group: Record<string, unknown>,
  groupIndex: number,
  variantIndex: number,
): PersistedCanonicalBrochure {
  const label = `Group ${groupIndex + 1} variant ${variantIndex + 1}`;
  if (!isRecord(value)) throw new Error(`${label} must be an object`);

  const canonicalBrn = requiredString(value.canonicalBrn, `${label} canonicalBrn`);
  const storeName = requiredString(group.storeName, `Group ${groupIndex + 1} storeName`);
  const validFrom = requiredString(group.validFrom, `Group ${groupIndex + 1} validFrom`);
  const validUntil = requiredString(group.validUntil, `Group ${groupIndex + 1} validUntil`);
  const storeId = requiredString(value.storeId, `${label} storeId`);
  const title = requiredString(value.title, `${label} title`);
  const pageCount = positiveInteger(value.pageCount, `${label} pageCount`);
  const groupPageCount = positiveInteger(group.detailPageCount, `Group ${groupIndex + 1} detailPageCount`);
  if (pageCount !== groupPageCount) {
    throw new Error(`${label} pageCount does not match its metadata group`);
  }

  const availableZipCodes = stringArray(value.availableZipCodes, `${label} availableZipCodes`);
  const pageUrls = stringArray(value.pageUrls, `${label} pageUrls`, true);
  if (pageUrls.length !== pageCount) {
    throw new Error(`${label} expected ${pageCount} page URLs, received ${pageUrls.length}`);
  }

  const pages = parsePages(value.pages, pageUrls, pageCount, label);
  const pageHashes = parsePageHashes(value.pageHashes, pageCount, label);
  const brochureSha256 = requiredString(value.brochureSha256, `${label} brochureSha256`);
  if (!SHA256_PATTERN.test(brochureSha256)) {
    throw new Error(`${label} brochureSha256 must be a valid SHA-256 hash`);
  }
  if (hashOrderedPageSet(pageHashes, pageCount) !== brochureSha256) {
    throw new Error(`${label} brochureSha256 does not match its ordered page hashes`);
  }

  const coverImage = pages[0]?.imageUrl;
  if (!coverImage) throw new Error(`${label} has no page 1 image URL`);

  return {
    canonicalBrn,
    storeName,
    storeId,
    title,
    validFrom,
    validUntil,
    pageCount,
    availableZipCodes,
    verifiedSha256: brochureSha256,
    verifiedPageHashes: pageHashes,
    coverImage,
    pageUrls,
    pages,
  };
}

export function buildPersistedCanonicalBrochures(value: unknown): PersistedCanonicalBrochure[] {
  if (!isRecord(value) || value.version !== 1 || !Array.isArray(value.groups)) {
    throw new Error('Canonical page verification must contain version 1 and a groups array');
  }

  const brochures: PersistedCanonicalBrochure[] = [];
  const canonicalBrns = new Set<string>();
  for (const [groupIndex, group] of value.groups.entries()) {
    if (!isRecord(group) || !Array.isArray(group.variants)) {
      throw new Error(`Verification group ${groupIndex + 1} must contain a variants array`);
    }
    for (const [variantIndex, variant] of group.variants.entries()) {
      const brochure = parseVariant(variant, group, groupIndex, variantIndex);
      if (canonicalBrns.has(brochure.canonicalBrn)) {
        throw new Error(`Canonical BRN ${brochure.canonicalBrn} appears more than once`);
      }
      canonicalBrns.add(brochure.canonicalBrn);
      brochures.push(brochure);
    }
  }
  return brochures;
}

export function parsePersistCanonicalArguments(args: readonly string[]): PersistCanonicalArguments {
  const result = { ...defaultArguments };
  const flags: Record<string, keyof PersistCanonicalArguments> = {
    '--verification': 'verificationPath',
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
  const verification = JSON.parse(await readFile(args.verificationPath, 'utf8')) as unknown;
  const brochures = buildPersistedCanonicalBrochures(verification);
  const output = { generatedAt: new Date().toISOString(), brochures };

  await mkdir(dirname(args.outputPath), { recursive: true });
  const temporaryPath = `${args.outputPath}.${process.pid}.tmp`;
  await writeFile(temporaryPath, JSON.stringify(output, null, 2), 'utf8');
  await rename(temporaryPath, args.outputPath);
  console.log(`Einträge: ${brochures.length} | Report: ${args.outputPath}`);
}

if (process.argv[1]?.endsWith('persist-canonical.ts')) {
  main().catch((error: unknown) => {
    console.error(`Fehler: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  });
}
