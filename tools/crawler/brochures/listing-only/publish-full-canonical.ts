#!/usr/bin/env bun

import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { buildCanonicalReport } from './canonical-report';
import { buildPersistedCanonicalBrochures } from './persist-canonical';
import { ensureR2StorageBudget, loadR2Config, optimizeImage, uploadToR2 } from '../r2-storage';
import { uploadCanonicalCatalog } from '../uploader';
import { decimalGbToBytes } from '../storage-policy';
import type { CanonicalCatalogRecord } from './canonical-catalog';
import type { CrawlerStore } from '../types';
import type { PersistedCanonicalBrochure } from './persist-canonical';

const DATA_DIR = 'tools/crawler/data/listing-only';
const DEFAULT_BUDGET_GB = 7;
const ASSET_PREFIX = 'brochures/dumps/assets/sha256/';
const SHA256_PATTERN = /^[a-f0-9]{64}$/;
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
  const uniquePageHashes = new Set<string>();
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
      uniquePageHashes.add(sha256);
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

  return {
    catalog,
    stores: [...storesById.values()].sort((left, right) => left.id.localeCompare(right.id)),
    scopedZipCodes,
    uniquePageHashes: [...uniquePageHashes].sort(),
  };
}

async function readJson(path: string): Promise<unknown> {
  return JSON.parse(await readFile(path, 'utf8')) as unknown;
}

function assetKey(sha256: string): string {
  if (!SHA256_PATTERN.test(sha256)) throw new Error('Page asset key needs a SHA-256 digest');
  return `${ASSET_PREFIX}${sha256}.jpg`;
}

async function readVerifiedAsset(assetsDir: string, sha256: string): Promise<Uint8Array> {
  const bytes = await readFile(join(assetsDir, `${sha256}.bin`));
  const actual = createHash('sha256').update(bytes).digest('hex');
  if (actual !== sha256) {
    throw new Error(`Local original page asset ${sha256}.bin failed SHA-256 validation`);
  }
  return bytes;
}

async function uploadPageAssets(
  publication: FullPagePublication,
  assetsDir: string,
  storageBudgetBytes: number,
): Promise<void> {
  const r2 = loadR2Config({ storageBudgetBytes });
  if (!r2) throw new Error('R2 credentials and bucket are required for brochure publication.');
  const budget = await ensureR2StorageBudget(r2);
  if (!budget) throw new Error('Unable to read the current R2 storage budget.');

  // Resolve and validate every new source asset, and reserve the whole batch,
  // before the first remote write. An invalid late asset or budget overflow
  // therefore cannot leave a partially uploaded catalog candidate.
  const pending: Array<{ key: string; bytes: ArrayBuffer }> = [];
  const reservations: Array<ReturnType<typeof budget.reserve>> = [];
  try {
    for (const sha256 of publication.uniquePageHashes) {
      const key = assetKey(sha256);
      if (budget.hasExistingAsset(key)) continue;

      const originalBytes = await readVerifiedAsset(assetsDir, sha256);
      const originalBuffer = originalBytes.buffer.slice(
        originalBytes.byteOffset,
        originalBytes.byteOffset + originalBytes.byteLength,
      ) as ArrayBuffer;
      const storedImage = await optimizeImage(originalBuffer);
      reservations.push(budget.reserve(key, storedImage.byteLength));
      pending.push({ key, bytes: storedImage });
    }
  } catch (error) {
    for (const reservation of reservations) reservation.release();
    throw error;
  }

  for (let start = 0; start < pending.length; start += R2_UPLOAD_CONCURRENCY) {
    const batch = pending.slice(start, start + R2_UPLOAD_CONCURRENCY);
    const results = await Promise.allSettled(
      batch.map(async (asset, offset) => {
        const reservation = reservations[start + offset]!;
        const result = await uploadToR2(r2, asset.key, asset.bytes, 'image/jpeg');
        if (result === 'already-existed') {
          reservation.release();
          throw new Error(
            `R2 asset ${asset.key} appeared after the storage snapshot; rerun to refresh the budget.`,
          );
        }
        reservation.commit(asset.bytes.byteLength);
      }),
    );

    const failedUpload = results.find(
      (result): result is PromiseRejectedResult => result.status === 'rejected',
    );
    if (failedUpload) {
      // Wait for every started upload, then stop before starting another batch.
      // Completed R2 objects are safe to reuse; no Supabase catalog write runs.
      for (const reservation of reservations.slice(start + batch.length)) {
        reservation.release();
      }
      throw failedUpload.reason;
    }
  }
}

async function main(): Promise<void> {
  const budgetGb = Number(process.env.BROCHURE_R2_STORAGE_BUDGET_GB ?? DEFAULT_BUDGET_GB);
  if (!Number.isFinite(budgetGb) || budgetGb <= 0) {
    throw new Error('BROCHURE_R2_STORAGE_BUDGET_GB must be positive');
  }

  const fullScan = await readJson(`${DATA_DIR}/all-stores-full.json`);
  const verification = await readJson(`${DATA_DIR}/canonical-page-verification.json`);
  const persisted = await readJson(`${DATA_DIR}/canonical-brochures.json`);
  const publication = buildFullPagePublication({ fullScan, verification, persisted });
  const supabaseUrl = requiredString(process.env.SUPABASE_URL, 'SUPABASE_URL');
  const supabaseSecretKey = requiredString(process.env.SUPABASE_SECRET_KEY, 'SUPABASE_SECRET_KEY');

  await uploadPageAssets(
    publication,
    `${DATA_DIR}/page-assets`,
    decimalGbToBytes(budgetGb),
  );

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
