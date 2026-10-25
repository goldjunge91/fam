#!/usr/bin/env bun

import { readFile } from 'node:fs/promises';
import { buildCanonicalReport } from './canonical-report';
import { validatePublicationHandoff } from './publication-handoff';
import { uploadCanonicalCatalog } from '../uploader';
import { requiredBringImageUrl } from '../bring-image-url';
import type { CanonicalCatalogRecord } from './canonical-catalog';
import type { CrawlerStore } from '../types';
import type { PersistedCanonicalBrochure } from './persist-canonical';

export type FullPagePublicationInput = {
  fullScan: unknown;
  persisted: unknown;
  verification?: unknown;
};

export type FullPagePublication = {
  catalog: CanonicalCatalogRecord[];
  stores: CrawlerStore[];
  scopedZipCodes: string[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requiredString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.length === 0) throw new Error(`${field} must be a non-empty string`);
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

function persistedCatalog(value: unknown, scopedZipCodes: ReadonlySet<string>): {
  catalog: CanonicalCatalogRecord[];
  stores: CrawlerStore[];
} {
  if (!isRecord(value) || !Array.isArray(value.brochures)) {
    throw new Error('Persisted regional brochure input must contain a brochures array');
  }
  const stores = new Map<string, CrawlerStore>();
  const catalog: CanonicalCatalogRecord[] = [];
  const ids = new Set<string>();

  for (const [index, entry] of value.brochures.entries()) {
    if (!isRecord(entry)) throw new Error(`Persisted brochure ${index + 1} must be an object`);
    const brochure = entry as unknown as PersistedCanonicalBrochure;
    const sourceZipCode = requiredString(brochure.sourceZipCode, `Persisted brochure ${index + 1} sourceZipCode`);
    const canonicalBrn = requiredString(brochure.canonicalBrn, `Persisted brochure ${index + 1} canonicalBrn`);
    const id = `canonical:${JSON.stringify([sourceZipCode, canonicalBrn])}`;
    if (!scopedZipCodes.has(sourceZipCode)) throw new Error(`Prospekt ${id} liegt außerhalb des Crawl-Scopes`);
    if (ids.has(id)) throw new Error(`Persisted regional brochure ${id} appears more than once`);
    ids.add(id);

    if (!Array.isArray(brochure.pages) || brochure.pages.length < 1 || brochure.pages.length !== brochure.pageCount) {
      throw new Error(`Persisted brochure ${id} has an incomplete page set`);
    }
    const pages = brochure.pages.map((page, pageIndex) => {
      if (page.number !== pageIndex + 1) throw new Error(`Persisted brochure ${id} pages are not ordered`);
      return {
        ...page,
        imageUrl: requiredBringImageUrl(page.imageUrl, `Persisted brochure ${id} page ${page.number}`),
        hotspots: page.hotspots.map((hotspot) => ({
          ...hotspot,
          ...(hotspot.imageUrl
            ? { imageUrl: requiredBringImageUrl(hotspot.imageUrl, `Persisted brochure ${id} hotspot`) }
            : {}),
        })),
      };
    });
    const coverImage = requiredBringImageUrl(brochure.coverImage, `Persisted brochure ${id} cover`);
    if (brochure.availableZipCodes.length !== 1 || brochure.availableZipCodes[0] !== sourceZipCode) {
      throw new Error(`Prospekt ${id} contains availability outside its source region`);
    }

    stores.set(brochure.storeId, { id: brochure.storeId, name: brochure.storeName });
    catalog.push({
      id,
      canonicalBrn,
      sourceZipCode,
      storeId: brochure.storeId,
      title: brochure.title,
      validFrom: brochure.validFrom,
      validUntil: brochure.validUntil,
      pageCount: brochure.pageCount,
      coverImage,
      pages,
      availableZipCodes: [sourceZipCode],
    });
  }

  return {
    catalog: catalog.sort((left, right) => left.id.localeCompare(right.id)),
    stores: [...stores.values()].sort((left, right) => left.id.localeCompare(right.id)),
  };
}

export function buildFullPagePublication(input: FullPagePublicationInput): FullPagePublication {
  const scopedZipCodes = completeFullScanZipCodes(input.fullScan);
  const parsed = persistedCatalog(input.persisted, new Set(scopedZipCodes));

  buildCanonicalReport({
    fullScan: input.fullScan,
    persistedBrochures: input.persisted,
  });

  return { ...parsed, scopedZipCodes };
}

export type FullCanonicalPublicationDependencies = {
  uploadCanonicalCatalog: typeof uploadCanonicalCatalog;
};

const fullCanonicalPublicationDependencies: FullCanonicalPublicationDependencies = {
  uploadCanonicalCatalog,
};

/** Publishes only the regional metadata catalog. Image bytes are fetched by the demand cache. */
export async function publishCanonicalPublication(
  publication: FullPagePublication,
  catalogConfig: Parameters<typeof uploadCanonicalCatalog>[3],
  dependencies: FullCanonicalPublicationDependencies = fullCanonicalPublicationDependencies,
): Promise<{
  status: 'COMPLETE';
  uploadedAssetCount: 0;
  reusedAssetCount: 0;
  catalogResult: Awaited<ReturnType<typeof uploadCanonicalCatalog>>;
}> {
  const catalogResult = await dependencies.uploadCanonicalCatalog(
    publication.catalog,
    publication.stores,
    publication.scopedZipCodes,
    catalogConfig,
  );
  return { status: 'COMPLETE', uploadedAssetCount: 0, reusedAssetCount: 0, catalogResult };
}

function argumentValue(args: readonly string[], flag: string): string | undefined {
  const index = args.indexOf(flag);
  if (index >= 0) return args[index + 1];
  const prefixed = args.find((argument) => argument.startsWith(`${flag}=`));
  return prefixed?.slice(flag.length + 1);
}

async function readJson(path: string): Promise<unknown> {
  return JSON.parse(await readFile(path, 'utf8')) as unknown;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const bundleDir = argumentValue(args, '--bundle-dir');
  const manifestSha256 = argumentValue(args, '--manifest-sha256');
  if (!bundleDir || !manifestSha256) throw new Error('--bundle-dir and --manifest-sha256 are required');

  const handoff = await validatePublicationHandoff({
    bundleDir,
    manifestSha256,
    binding: {
      repository: requiredString(process.env.GITHUB_REPOSITORY, 'GITHUB_REPOSITORY'),
      runId: requiredString(process.env.GITHUB_RUN_ID, 'GITHUB_RUN_ID'),
      commitSha: requiredString(process.env.GITHUB_SHA, 'GITHUB_SHA'),
    },
  });

  const [fullScan, persisted] = await Promise.all([
    readJson(handoff.paths['all-stores-full.json']),
    readJson(handoff.paths['canonical-brochures.json']),
  ]);
  const publication = buildFullPagePublication({ fullScan, persisted });
  const result = await publishCanonicalPublication(
    publication,
    {
      supabaseUrl: requiredString(process.env.SUPABASE_URL, 'SUPABASE_URL'),
      supabaseSecretKey: requiredString(process.env.SUPABASE_SECRET_KEY, 'SUPABASE_SECRET_KEY'),
    },
  );
  console.log(
    `Published ${result.catalogResult.uploadedCount} regional brochure records and availability for ${publication.scopedZipCodes.length} ZIP codes.`,
  );
}

if (process.argv[1]?.endsWith('publish-full-canonical.ts')) {
  main().catch((error: unknown) => {
    console.error(`Brochure publication failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  });
}
