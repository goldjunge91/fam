import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { createStorageBudget } from '../../tools/crawler/brochures/storage-policy';
import type { R2Config } from '../../tools/crawler/brochures/r2-storage';
import { hashOrderedPageSet } from '../../tools/crawler/brochures/listing-only/full-brochure-signature';
import { buildPersistedCanonicalBrochures } from '../../tools/crawler/brochures/listing-only/persist-canonical';
import {
  buildFullPagePublication,
  resolveVerifiedPageAsset,
  uploadPageAssets,
} from '../../tools/crawler/brochures/listing-only/publish-full-canonical';

const pageHashes = [{ pageNumber: 1, sha256: 'a'.repeat(64) }];
const verification = {
  version: 1,
  scope: {
    mode: 'all-brns',
    complete: true,
    totalGroupCount: 1,
    verifiedGroupCount: 1,
    totalBrnCount: 1,
    verifiedBrnCount: 1,
    totalPageReferenceCount: 1,
    verifiedPageReferenceCount: 1,
  },
  summary: {
    metadataGroupCount: 1,
    uniqueBrnCount: 1,
    canonicalBrochureCount: 1,
    pageReferenceCount: 1,
  },
  byBrn: {
    'brn-a': {
      pageUrls: ['https://cdn.example/rewe.jpg'],
      pageHashes,
      brochureSha256: hashOrderedPageSet(pageHashes, 1),
    },
  },
  groups: [{
    storeName: 'REWE',
    validFrom: '2026-10-01',
    validUntil: '2026-10-07',
    detailPageCount: 1,
    brns: ['brn-a'],
    availableZipCodes: ['10115'],
    sightingCount: 1,
    variants: [{
      canonicalBrn: 'brn-a',
      brns: ['brn-a'],
      title: 'REWE Angebote',
      storeId: 'rewe',
      pageUrls: ['https://cdn.example/rewe.jpg'],
      pages: [{ number: 1, imageUrl: 'https://cdn.example/rewe.jpg', hotspots: [] }],
      pageHashes,
      pageCount: 1,
      availableZipCodes: ['10115'],
      brochureSha256: hashOrderedPageSet(pageHashes, 1),
    }],
  }],
};

const fullScan = {
  totalLocations: 1,
  completedLocations: 1,
  byZipCode: {
    '10115': [{
      brn: 'brn-a',
      storeName: 'REWE',
      title: 'REWE Angebote',
      validFrom: '2026-10-01',
      validUntil: '2026-10-07',
    }],
  },
};

const roots: string[] = [];

function bytesSha256(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
  jest.restoreAllMocks();
});

describe('full-page brochure publication', () => {
  it('builds app records only from complete verification and persisted full-scan coverage', () => {
    const persisted = {
      generatedAt: '2026-10-09T00:00:00.000Z',
      brochures: buildPersistedCanonicalBrochures(verification),
    };

    const publication = buildFullPagePublication({ fullScan, verification, persisted });

    expect(publication.scopedZipCodes).toEqual(['10115']);
    expect(publication.uniquePageHashes).toEqual(['a'.repeat(64)]);
    expect(publication.pageSourcesByHash).toEqual({
      ['a'.repeat(64)]: ['https://cdn.example/rewe.jpg'],
    });
    expect(publication.stores).toEqual([{ id: 'rewe', name: 'REWE' }]);
    expect(publication.catalog[0]).toMatchObject({
      canonicalBrn: 'brn-a',
      pageCount: 1,
      coverImage: `brochures/dumps/assets/sha256/${'a'.repeat(64)}.jpg`,
      pages: [{
        number: 1,
        imageUrl: `brochures/dumps/assets/sha256/${'a'.repeat(64)}.jpg`,
        hotspots: [],
      }],
      verifiedSha256: hashOrderedPageSet(pageHashes, 1),
    });
  });

  it('keeps every deterministic verified source URL for each page hash', () => {
    const sourceGroup = verification.groups[0]!;
    const sourceVariant = sourceGroup.variants[0]!;
    const alternateVerification = {
      ...verification,
      scope: {
        ...verification.scope,
        totalBrnCount: 2,
        verifiedBrnCount: 2,
        totalPageReferenceCount: 2,
        verifiedPageReferenceCount: 2,
      },
      summary: { ...verification.summary, uniqueBrnCount: 2, pageReferenceCount: 2 },
      byBrn: {
        'brn-a': verification.byBrn['brn-a'],
        'brn-b': {
          pageUrls: ['https://cdn.example/alternate-rewe.jpg'],
          pageHashes,
          brochureSha256: hashOrderedPageSet(pageHashes, 1),
        },
      },
      groups: [{
        ...sourceGroup,
        brns: ['brn-a', 'brn-b'],
        sightingCount: 2,
        variants: [{ ...sourceVariant, brns: ['brn-a', 'brn-b'] }],
      }],
    };
    const alternateFullScan = {
      ...fullScan,
      byZipCode: {
        '10115': [
          ...fullScan.byZipCode['10115'],
          {
            brn: 'brn-b',
            storeName: 'REWE',
            title: 'REWE Angebote',
            validFrom: '2026-10-01',
            validUntil: '2026-10-07',
          },
        ],
      },
    };

    const publication = buildFullPagePublication({
      fullScan: alternateFullScan,
      verification: alternateVerification,
      persisted: { brochures: buildPersistedCanonicalBrochures(alternateVerification) },
    });

    expect(publication.pageSourcesByHash).toEqual({
      ['a'.repeat(64)]: [
        'https://cdn.example/alternate-rewe.jpg',
        'https://cdn.example/rewe.jpg',
      ],
    });
  });

  it('rejects incomplete ZIP scans before preparing an app publication', () => {
    expect(() => buildFullPagePublication({
      fullScan: { ...fullScan, completedLocations: 0 },
      verification,
      persisted: { brochures: buildPersistedCanonicalBrochures(verification) },
    })).toThrow('Full scan did not complete every postal code; publication is blocked.');
  });

  it('rejects sample verification reports even when their sample pages are complete', () => {
    const sample = {
      ...verification,
      scope: { ...verification.scope, mode: 'zip-sample', complete: false },
    };

    expect(() => buildFullPagePublication({
      fullScan,
      verification: sample,
      persisted: { brochures: buildPersistedCanonicalBrochures(sample) },
    })).toThrow(/Only a complete all-BRN page verification/);
  });

  it('prefers a locally transferred page asset and validates its original-byte hash', async () => {
    const root = await mkdtemp(join(process.cwd(), '.test-publication-assets-'));
    roots.push(root);
    const assetsDir = join(root, 'page-assets');
    await mkdir(assetsDir, { recursive: true });
    const bytes = new TextEncoder().encode('verified local page');
    const sha256 = bytesSha256(bytes);
    await writeFile(join(assetsDir, `${sha256}.bin`), bytes);
    const fetchOriginalBytes = jest.fn(async () => {
      throw new Error('local verified bytes must win');
    });

    await expect(resolveVerifiedPageAsset({
      bundleDir: root,
      sha256,
      sourceUrls: ['https://cdn.example/page.jpg'],
      fetchOriginalBytes,
    })).resolves.toEqual(bytes);
    expect(fetchOriginalBytes).not.toHaveBeenCalled();
  });

  it('skips content-addressed assets already present in the R2 budget snapshot', async () => {
    const root = await mkdtemp(join(process.cwd(), '.test-publication-existing-'));
    roots.push(root);
    const publication = buildFullPagePublication({
      fullScan,
      verification,
      persisted: { brochures: buildPersistedCanonicalBrochures(verification) },
    });
    const existingKey = `brochures/dumps/assets/sha256/${'a'.repeat(64)}.jpg`;
    const budget = createStorageBudget({
      budgetBytes: 1000,
      existingAssets: [{ key: existingKey, bytes: 10 }],
    });
    const uploadToR2 = jest.fn(async () => 'uploaded' as const);
    const resolvePageAsset = jest.fn(async () => new Uint8Array());
    const config: R2Config = {
      accountId: 'account', accessKeyId: 'access', secretAccessKey: 'secret', bucket: 'bucket',
    };

    await uploadPageAssets(publication, root, 1000, {
      loadR2Config: () => config,
      ensureR2StorageBudget: async () => budget,
      optimizeImage: async (bytes) => bytes,
      uploadToR2,
      resolveVerifiedPageAsset: resolvePageAsset,
    });

    expect(resolvePageAsset).not.toHaveBeenCalled();
    expect(uploadToR2).not.toHaveBeenCalled();
  });

  it('prepares every missing asset before the first R2 write', async () => {
    const root = await mkdtemp(join(process.cwd(), '.test-publication-prepare-'));
    roots.push(root);
    const goodBytes = new TextEncoder().encode('good page');
    const expectedBadBytes = new TextEncoder().encode('expected second page');
    const goodHash = bytesSha256(goodBytes);
    const badHash = bytesSha256(expectedBadBytes);
    const publication = buildFullPagePublication({
      fullScan,
      verification,
      persisted: { brochures: buildPersistedCanonicalBrochures(verification) },
    });
    publication.uniquePageHashes = [goodHash, badHash];
    publication.pageSourcesByHash = {
      [goodHash]: ['https://cdn.example/good.jpg'],
      [badHash]: ['https://cdn.example/changed.jpg'],
    };
    const budget = createStorageBudget({ budgetBytes: 1000 });
    const uploadToR2 = jest.fn(async () => 'uploaded' as const);
    const config: R2Config = {
      accountId: 'account', accessKeyId: 'access', secretAccessKey: 'secret', bucket: 'bucket',
    };

    await expect(uploadPageAssets(publication, root, 1000, {
      loadR2Config: () => config,
      ensureR2StorageBudget: async () => budget,
      optimizeImage: async (bytes) => bytes,
      uploadToR2,
      resolveVerifiedPageAsset: async ({ sha256 }) =>
        sha256 === goodHash ? goodBytes : new TextEncoder().encode('changed second page'),
    })).rejects.toThrow('failed verified SHA-256');
    expect(uploadToR2).not.toHaveBeenCalled();
  });

  it('rehydrates missing assets only when a bound source still has the verified hash', async () => {
    const root = await mkdtemp(join(process.cwd(), '.test-publication-rehydrate-'));
    roots.push(root);
    const bytes = new TextEncoder().encode('verified remote page');
    const sha256 = bytesSha256(bytes);
    const fetchOriginalBytes = jest.fn(async (url: string) => {
      if (url.endsWith('/a-stale.jpg')) return new TextEncoder().encode('changed bytes');
      return bytes;
    });

    await expect(resolveVerifiedPageAsset({
      bundleDir: root,
      sha256,
      sourceUrls: ['https://cdn.example/a-stale.jpg', 'https://cdn.example/z-current.jpg'],
      fetchOriginalBytes,
    })).resolves.toEqual(bytes);
    expect(fetchOriginalBytes).toHaveBeenCalledTimes(2);

    await expect(resolveVerifiedPageAsset({
      bundleDir: root,
      sha256,
      sourceUrls: ['https://cdn.example/a-stale.jpg'],
      fetchOriginalBytes,
    })).rejects.toThrow('verified SHA-256');
  });
});
