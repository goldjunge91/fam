#!/usr/bin/env bun

import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { buildCanonicalReport } from './canonical-report';
import { hashOrderedPageSet, type PageContentHash } from './full-brochure-signature';
import { buildPersistedCanonicalBrochures } from './persist-canonical';
import { validatePublicationHandoff } from './publication-handoff';
import {
  downloadOriginalImageBytes,
  ensureR2StorageBudget,
  loadR2Config,
  optimizeImage,
  uploadToR2,
} from '../r2-storage';
import { uploadCanonicalCatalog } from '../uploader';
import { decimalGbToBytes, type StorageReservation } from '../storage-policy';
import type { CanonicalCatalogRecord } from './canonical-catalog';
import type { CrawlerStore } from '../types';
import type { PersistedCanonicalBrochure } from './persist-canonical';

const DEFAULT_BUDGET_GB = 7;
const ASSET_PREFIX = 'brochures/dumps/assets/sha256/';
const SHA256_PATTERN = /^[a-f0-9]{64}$/;
const ASSET_PREPARATION_CONCURRENCY = 8;
const R2_UPLOAD_CONCURRENCY = 8;

export type FullPagePublicationInput = {
  fullScan: unknown;
  verification: unknown;
  persisted: unknown;
};

export type FullPagePublication = {
  catalog: CanonicalCatalogRecord[];
  stores: CrawlerStore[];
  scopedZipCodes: string[];
  uniquePageHashes: string[];
  pageSourcesByHash: Record<string, string[]>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requiredString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`${field} must be a non-empty string`);
  }
  return value;
}

function completeFullScanZipCodes(value: unknown): string[] {
  if (!isRecord(value) || !isRecord(value.byZipCode)) {
    throw new Error('Full scan must contain a byZipCode object');
  }
  if (
    !Number.isSafeInteger(value.totalLocations) ||
    !Number.isSafeInteger(value.completedLocations) ||
    value.totalLocations !== value.completedLocations ||
    value.completedLocations !== Object.keys(value.byZipCode).length
  ) {
    throw new Error('Full scan did not complete every postal code; publication is blocked.');
  }

  const zipCodes = Object.keys(value.byZipCode).sort();
  if (zipCodes.length === 0 || zipCodes.some((zipCode) => !/^\d{5}$/.test(zipCode))) {
    throw new Error('Full scan must contain a non-empty complete set of five-digit ZIP codes');
  }
  return zipCodes;
}

function brochureId(brochure: PersistedCanonicalBrochure): string {
  const groupKey = JSON.stringify([
    brochure.storeName,
    brochure.validFrom,
    brochure.validUntil,
    brochure.pageCount,
    ['content', brochure.verifiedSha256],
  ]);
  return `canonical:${groupKey}`;
}

function addVerifiedReportPageSources(
  verification: unknown,
  allowedHashes: ReadonlySet<string>,
  pageSourcesByHash: Map<string, Set<string>>,
): void {
  if (!isRecord(verification) || !isRecord(verification.byBrn)) {
    throw new Error('Full-page verification must contain per-BRN page sources');
  }

  for (const [brn, value] of Object.entries(verification.byBrn)) {
    if (!isRecord(value) || !Array.isArray(value.pageUrls) || !Array.isArray(value.pageHashes)) {
      throw new Error(`Verification BRN ${brn} must contain page URLs and hashes`);
    }
    if (value.pageUrls.length === 0 || value.pageUrls.length !== value.pageHashes.length) {
      throw new Error(`Verification BRN ${brn} has an incomplete page source vector`);
    }

    const pageHashes: PageContentHash[] = value.pageHashes.map((entry, index) => {
      if (!isRecord(entry) || entry.pageNumber !== index + 1 ||
        typeof entry.sha256 !== 'string' || !allowedHashes.has(entry.sha256)) {
        throw new Error(`Verification BRN ${brn} has an invalid page source hash`);
      }
      return { pageNumber: index + 1, sha256: entry.sha256 };
    });
    if (
      typeof value.brochureSha256 !== 'string' ||
      hashOrderedPageSet(pageHashes, pageHashes.length) !== value.brochureSha256
    ) {
      throw new Error(`Verification BRN ${brn} has an invalid brochure source hash`);
    }

    value.pageUrls.forEach((sourceUrl, index) => {
      const sha256 = pageHashes[index]!.sha256;
      const url = requiredString(sourceUrl, `Verification BRN ${brn} page URL ${index + 1}`);
      const sourceUrls = pageSourcesByHash.get(sha256) ?? new Set<string>();
      sourceUrls.add(url);
      pageSourcesByHash.set(sha256, sourceUrls);
    });
  }
}

export function buildFullPagePublication(input: FullPagePublicationInput): FullPagePublication {
  const scopedZipCodes = completeFullScanZipCodes(input.fullScan);
  const brochures = buildPersistedCanonicalBrochures(input.verification);

  // Reuses the production report's checks for full-scan coverage, variant partitions,
  // ZIP availability, and the separately persisted catalog matching verification.
  buildCanonicalReport({
    fullScan: input.fullScan,
    verification: input.verification,
    persistedBrochures: input.persisted,
  });

  const storesById = new Map<string, CrawlerStore>();
  const pageSourcesByHash = new Map<string, Set<string>>();
  const catalog: CanonicalCatalogRecord[] = brochures.map((brochure) => {
    const hashesByPage = new Map(
      brochure.verifiedPageHashes.map(({ pageNumber, sha256 }) => [pageNumber, sha256]),
    );
    const pages = brochure.pages.map((page, index) => {
      const expectedPageNumber = index + 1;
      const sha256 = hashesByPage.get(expectedPageNumber);
      if (page.number !== expectedPageNumber || !sha256 || !SHA256_PATTERN.test(sha256)) {
        throw new Error(`Brochure ${brochure.canonicalBrn} has an invalid ordered page vector`);
      }
      const sourceUrls = pageSourcesByHash.get(sha256) ?? new Set<string>();
      sourceUrls.add(page.imageUrl);
      pageSourcesByHash.set(sha256, sourceUrls);
      return { ...page, imageUrl: `${ASSET_PREFIX}${sha256}.jpg` };
    });

    if (pages.length !== brochure.pageCount || pages.length === 0) {
      throw new Error(`Brochure ${brochure.canonicalBrn} has an incomplete page set`);
    }
    if (pages[0]?.imageUrl !== `${ASSET_PREFIX}${brochure.verifiedPageHashes[0]?.sha256}.jpg`) {
      throw new Error(`Brochure ${brochure.canonicalBrn} has no verified page-one image`);
    }

    storesById.set(brochure.storeId, {
      id: brochure.storeId,
      name: brochure.storeName,
    });

    return {
      id: brochureId(brochure),
      canonicalBrn: brochure.canonicalBrn,
      storeId: brochure.storeId,
      title: brochure.title,
      validFrom: brochure.validFrom,
      validUntil: brochure.validUntil,
      pageCount: brochure.pageCount,
      coverImage: pages[0]!.imageUrl,
      pages,
      verifiedSha256: brochure.verifiedSha256,
      verifiedPageHashes: brochure.verifiedPageHashes,
      availableZipCodes: brochure.availableZipCodes,
    };
  });

  const uniquePageHashes = [...pageSourcesByHash.keys()].sort();
  addVerifiedReportPageSources(input.verification, new Set(uniquePageHashes), pageSourcesByHash);
  return {
    catalog,
    stores: [...storesById.values()].sort((left, right) => left.id.localeCompare(right.id)),
    scopedZipCodes,
    uniquePageHashes,
    pageSourcesByHash: Object.fromEntries(
      uniquePageHashes.map((sha256) => [sha256, [...pageSourcesByHash.get(sha256)!].sort()]),
    ),
  };
}

async function readJson(path: string): Promise<unknown> {
  return JSON.parse(await readFile(path, 'utf8')) as unknown;
}

function assetKey(sha256: string): string {
  if (!SHA256_PATTERN.test(sha256)) throw new Error('Page asset key needs a SHA-256 digest');
  return `${ASSET_PREFIX}${sha256}.jpg`;
}

function asUint8Array(bytes: ArrayBuffer | Uint8Array): Uint8Array {
  return bytes instanceof Uint8Array ? new Uint8Array(bytes) : new Uint8Array(bytes.slice(0));
}

function matchesSha256(bytes: Uint8Array, expected: string): boolean {
  return createHash('sha256').update(bytes).digest('hex') === expected;
}

export async function resolveVerifiedPageAsset(options: {
  bundleDir: string;
  sha256: string;
  sourceUrls: readonly string[];
  fetchOriginalBytes?: (url: string) => Promise<ArrayBuffer | Uint8Array>;
}): Promise<Uint8Array> {
  if (!SHA256_PATTERN.test(options.sha256)) {
    throw new Error('Page asset needs a valid verified SHA-256 digest');
  }

  const localPath = join(options.bundleDir, 'page-assets', `${options.sha256}.bin`);
  try {
    const localBytes = asUint8Array(await readFile(localPath));
    if (!matchesSha256(localBytes, options.sha256)) {
      throw new Error(`Local original page asset ${options.sha256}.bin failed verified SHA-256 validation`);
    }
    return localBytes;
  } catch (error) {
    if (!isRecord(error) || error.code !== 'ENOENT') throw error;
  }

  const fetchOriginalBytes = options.fetchOriginalBytes ?? downloadOriginalImageBytes;
  const sourceUrls = [...new Set(options.sourceUrls)].sort();
  for (const sourceUrl of sourceUrls) {
    try {
      const bytes = asUint8Array(await fetchOriginalBytes(sourceUrl));
      if (matchesSha256(bytes, options.sha256)) return bytes;
    } catch {
      // Another URL bound to the same verified hash may still be available.
    }
  }

  throw new Error(`No bound page source produced verified SHA-256 ${options.sha256}`);
}

type PageAssetUploadDependencies = {
  loadR2Config: typeof loadR2Config;
  ensureR2StorageBudget: typeof ensureR2StorageBudget;
  optimizeImage: typeof optimizeImage;
  uploadToR2: typeof uploadToR2;
  resolveVerifiedPageAsset: typeof resolveVerifiedPageAsset;
};

const pageAssetUploadDependencies: PageAssetUploadDependencies = {
  loadR2Config,
  ensureR2StorageBudget,
  optimizeImage,
  uploadToR2,
  resolveVerifiedPageAsset,
};

type PreparedPageAsset = {
  key: string;
  path: string;
  bytes: number;
  sha256: string;
  reservation: StorageReservation;
};

export async function uploadPageAssets(
  publication: FullPagePublication,
  bundleDir: string,
  storageBudgetBytes: number,
  dependencies: PageAssetUploadDependencies = pageAssetUploadDependencies,
): Promise<void> {
  const r2 = dependencies.loadR2Config({ storageBudgetBytes });
  if (!r2) throw new Error('R2 credentials and bucket are required for brochure publication.');
  const budget = await dependencies.ensureR2StorageBudget(r2);
  if (!budget) throw new Error('Unable to read the current R2 storage budget.');

  const missingHashes = publication.uniquePageHashes.filter(
    (sha256) => !budget.hasExistingAsset(assetKey(sha256)),
  );
  const preparedDir = join(bundleDir, '.prepared-page-assets');
  await mkdir(preparedDir, { recursive: true });
  const prepared: PreparedPageAsset[] = [];

  // Resolve, hash-check, optimize, and reserve every missing page before the first PUT.
  for (let start = 0; start < missingHashes.length; start += ASSET_PREPARATION_CONCURRENCY) {
    const batch = missingHashes.slice(start, start + ASSET_PREPARATION_CONCURRENCY);
    const results = await Promise.allSettled(batch.map(async (sha256): Promise<PreparedPageAsset> => {
      const sourceUrls = publication.pageSourcesByHash[sha256];
      if (!sourceUrls || sourceUrls.length === 0) {
        throw new Error(`No verified source URLs are bound to page hash ${sha256}`);
      }
      const originalBytes = await dependencies.resolveVerifiedPageAsset({
        bundleDir,
        sha256,
        sourceUrls,
      });
      if (!matchesSha256(originalBytes, sha256)) {
        throw new Error(`Resolved page asset ${sha256} failed verified SHA-256 validation`);
      }
      const originalBuffer = originalBytes.buffer.slice(
        originalBytes.byteOffset,
        originalBytes.byteOffset + originalBytes.byteLength,
      ) as ArrayBuffer;
      const storedImage = await dependencies.optimizeImage(originalBuffer);
      const key = assetKey(sha256);
      const reservation = budget.reserve(key, storedImage.byteLength);
      const path = join(preparedDir, `${sha256}.jpg`);
      try {
        await writeFile(path, new Uint8Array(storedImage));
      } catch (error) {
        reservation.release();
        throw error;
      }
      return {
        key,
        path,
        bytes: storedImage.byteLength,
        sha256: createHash('sha256').update(new Uint8Array(storedImage)).digest('hex'),
        reservation,
      };
    }));

    const failed = results.find(
      (result): result is PromiseRejectedResult => result.status === 'rejected',
    );
    for (const result of results) {
      if (result.status === 'fulfilled') prepared.push(result.value);
    }
    if (failed) {
      for (const asset of prepared) asset.reservation.release();
      throw failed.reason;
    }
  }

  for (let start = 0; start < prepared.length; start += R2_UPLOAD_CONCURRENCY) {
    const batch = prepared.slice(start, start + R2_UPLOAD_CONCURRENCY);
    const results = await Promise.allSettled(batch.map(async (asset) => {
      const storedImage = await readFile(asset.path);
      if (
        storedImage.byteLength !== asset.bytes ||
        createHash('sha256').update(storedImage).digest('hex') !== asset.sha256
      ) {
        throw new Error(`Prepared R2 asset ${asset.key} changed before upload`);
      }
      const body = storedImage.buffer.slice(
        storedImage.byteOffset,
        storedImage.byteOffset + storedImage.byteLength,
      ) as ArrayBuffer;
      const result = await dependencies.uploadToR2(r2, asset.key, body, 'image/jpeg');
      if (result === 'already-existed') {
        asset.reservation.release();
        throw new Error(
          `R2 asset ${asset.key} appeared after the storage snapshot; rerun to refresh the budget.`,
        );
      }
      asset.reservation.commit(asset.bytes);
    }));

    const failed = results.find(
      (result): result is PromiseRejectedResult => result.status === 'rejected',
    );
    if (failed) {
      for (const asset of prepared.slice(start + batch.length)) asset.reservation.release();
      throw failed.reason;
    }
  }
}

function argumentValue(args: readonly string[], flag: string): string | undefined {
  const index = args.indexOf(flag);
  if (index >= 0) return args[index + 1];
  const prefixed = args.find((argument) => argument.startsWith(`${flag}=`));
  return prefixed?.slice(flag.length + 1);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const bundleDir = argumentValue(args, '--bundle-dir');
  const manifestSha256 = argumentValue(args, '--manifest-sha256');
  if (!bundleDir || !manifestSha256) {
    throw new Error('--bundle-dir and --manifest-sha256 are required');
  }
  const expectedBudgetBytes = Number(process.env.BROCHURE_VERIFY_BUDGET_BYTES ?? '');
  if (!Number.isSafeInteger(expectedBudgetBytes) || expectedBudgetBytes < 1) {
    throw new Error('BROCHURE_VERIFY_BUDGET_BYTES must be a positive safe integer');
  }

  const handoff = await validatePublicationHandoff({
    bundleDir,
    manifestSha256,
    expectedBudgetBytes,
    binding: {
      repository: requiredString(process.env.GITHUB_REPOSITORY, 'GITHUB_REPOSITORY'),
      runId: requiredString(process.env.GITHUB_RUN_ID, 'GITHUB_RUN_ID'),
      commitSha: requiredString(process.env.GITHUB_SHA, 'GITHUB_SHA'),
    },
  });

  const [fullScan, verification, persisted] = await Promise.all([
    readJson(handoff.paths['all-stores-full.json']),
    readJson(handoff.paths['canonical-page-verification.json']),
    readJson(handoff.paths['canonical-brochures.json']),
  ]);
  const publication = buildFullPagePublication({ fullScan, verification, persisted });

  const budgetGb = Number(process.env.BROCHURE_R2_STORAGE_BUDGET_GB ?? DEFAULT_BUDGET_GB);
  if (!Number.isFinite(budgetGb) || budgetGb <= 0) {
    throw new Error('BROCHURE_R2_STORAGE_BUDGET_GB must be positive');
  }
  const supabaseUrl = requiredString(process.env.SUPABASE_URL, 'SUPABASE_URL');
  const supabaseSecretKey = requiredString(process.env.SUPABASE_SECRET_KEY, 'SUPABASE_SECRET_KEY');

  await uploadPageAssets(publication, bundleDir, decimalGbToBytes(budgetGb));

  const result = await uploadCanonicalCatalog(
    publication.catalog,
    publication.stores,
    publication.scopedZipCodes,
    { supabaseUrl, supabaseSecretKey },
  );
  console.log(
    `Published ${result.uploadedCount} verified brochures, ${publication.uniquePageHashes.length} unique page assets, and availability for ${publication.scopedZipCodes.length} ZIP codes.`,
  );
}

if (process.argv[1]?.endsWith('publish-full-canonical.ts')) {
  main().catch((error: unknown) => {
    console.error(`Brochure publication failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  });
}
