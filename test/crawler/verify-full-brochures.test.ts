import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { createStorageBudget } from '../../tools/crawler/brochures/storage-policy';
import type { BrnReference } from '../../tools/crawler/brochures/listing-only/fetch-detail-pages';
import type { CanonicalGroup } from '../../tools/crawler/brochures/listing-only/group-canonical';
import { hashOrderedPageSet } from '../../tools/crawler/brochures/listing-only/full-brochure-signature';
import { createOriginalPageAssetStore } from '../../tools/crawler/brochures/listing-only/original-page-asset-store';
import {
  buildPilotVerificationGroups,
  buildZipSampleGroups,
  buildFullPageVerificationReport,
  createFullPageVerificationProgress,
  createProgressCheckpointWriter,
  parseVerifyFullBrochuresArguments,
  verifyAllBrochurePages,
  type VerifiedFullPageBrochure,
} from '../../tools/crawler/brochures/listing-only/verify-full-brochures';

const group: CanonicalGroup = {
  storeName: 'REWE',
  validFrom: '2026-10-01',
  validUntil: '2026-10-07',
  detailPageCount: 2,
  brns: ['brn-a'],
  availableZipCodes: ['10115'],
  sightingCount: 1,
};

const rootDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(rootDirectories.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

async function createAssetDirectory(): Promise<string> {
  const root = await mkdtemp(join(process.cwd(), '.test-full-brochure-verification-'));
  rootDirectories.push(root);
  return join(root, 'page-assets');
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function verification(first: string, second: string, pageUrls: string[]): VerifiedFullPageBrochure {
  const pageHashes = [
    { pageNumber: 1, sha256: sha256(first) },
    { pageNumber: 2, sha256: sha256(second) },
  ];
  return {
    title: 'REWE Angebote',
    storeId: 'rewe',
    pageUrls,
    pageHashes,
    pages: pageUrls.map((imageUrl, index) => ({ number: index + 1, imageUrl, hotspots: [] })),
    brochureSha256: hashOrderedPageSet(pageHashes, 2),
  };
}

describe('full brochure page verification', () => {
  it('limits a pilot to selected same-cover BRNs and recalculates availability', () => {
    const fullScan = {
      byZipCode: {
        '10115': [{ brn: 'brn-a', storeName: 'REWE', title: 'Angebote', validFrom: group.validFrom, validUntil: group.validUntil }],
        '20095': [{ brn: 'brn-b', storeName: 'REWE', title: 'Angebote', validFrom: group.validFrom, validUntil: group.validUntil }],
        '50667': [{ brn: 'brn-c', storeName: 'REWE', title: 'Angebote', validFrom: group.validFrom, validUntil: group.validUntil }],
      },
    };
    const candidateReport = {
      identity: { confirmed: false },
      skippedFullPageDownloads: 0,
      pilotSelection: {
        groups: [{
          storeName: group.storeName,
          validFrom: group.validFrom,
          validUntil: group.validUntil,
          detailPageCount: group.detailPageCount,
          representativeBrn: 'brn-a',
          fullVectorCandidateBrns: ['brn-a', 'brn-b'],
          fullVectorPageCount: 4,
        }],
      },
    };

    expect(buildPilotVerificationGroups([{
      ...group,
      brns: ['brn-a', 'brn-b', 'brn-c'],
      availableZipCodes: ['10115', '20095', '50667'],
      sightingCount: 3,
    }], fullScan, candidateReport)).toEqual({
      groups: [{
        ...group,
        brns: ['brn-a', 'brn-b'],
        availableZipCodes: ['10115', '20095'],
        sightingCount: 2,
      }],
      brns: ['brn-a', 'brn-b'],
      totalBrns: 3,
    });
  });

  it('rejects pilot candidates outside their metadata group', () => {
    const candidateReport = {
      identity: { confirmed: false },
      skippedFullPageDownloads: 0,
      pilotSelection: {
        groups: [{
          storeName: group.storeName,
          validFrom: group.validFrom,
          validUntil: group.validUntil,
          detailPageCount: group.detailPageCount,
          representativeBrn: 'brn-a',
          fullVectorCandidateBrns: ['brn-a', 'brn-other'],
          fullVectorPageCount: 4,
        }],
      },
    };

    expect(() => buildPilotVerificationGroups([group], {
      byZipCode: {
        '10115': [{ brn: 'brn-a', storeName: group.storeName, title: 'Angebote', validFrom: group.validFrom, validUntil: group.validUntil }],
      },
    }, candidateReport)).toThrow('Pilot BRN brn-other does not belong to its selected metadata group.');
  });

  it('limits a ZIP sample to the BRNs visible in that ZIP and updates coverage', () => {
    const secondGroup: CanonicalGroup = {
      ...group,
      validFrom: '2026-10-02',
      brns: ['brn-c'],
      availableZipCodes: ['10115', '22043'],
      sightingCount: 2,
    };
    const fullScan = {
      byZipCode: {
        '10115': [{ brn: 'brn-a', storeName: 'REWE', title: 'Angebote', validFrom: group.validFrom, validUntil: group.validUntil }],
        '22043': [
          { brn: 'brn-b', storeName: 'REWE', title: 'Angebote', validFrom: group.validFrom, validUntil: group.validUntil },
          { brn: 'brn-c', storeName: 'REWE', title: 'Angebote', validFrom: secondGroup.validFrom, validUntil: group.validUntil },
        ],
      },
    };

    expect(buildZipSampleGroups([
      { ...group, brns: ['brn-a', 'brn-b'], availableZipCodes: ['10115', '22043'], sightingCount: 2 },
      secondGroup,
    ], fullScan, '22043')).toEqual({
      groups: [
        { ...group, brns: ['brn-b'], availableZipCodes: ['22043'], sightingCount: 1 },
        { ...secondGroup, availableZipCodes: ['22043'], sightingCount: 1 },
      ],
      brns: ['brn-b', 'brn-c'],
      totalBrns: 3,
    });
    expect(() => buildZipSampleGroups([group], fullScan, '99999')).toThrow(/no offers/);
  });

  it('coalesces frequent progress changes and persists them on flush', async () => {
    const root = await mkdtemp(join(process.cwd(), '.test-full-brochure-progress-'));
    rootDirectories.push(root);
    const path = join(root, 'progress.json');
    const progress = createFullPageVerificationProgress('same-input');
    const writer = createProgressCheckpointWriter(path, progress, 60_000);

    await writer.checkpoint();
    progress.stats.pageDownloads = 2;
    await writer.checkpoint();

    const beforeFlush = JSON.parse(await readFile(path, 'utf8')) as typeof progress;
    expect(beforeFlush.stats.pageDownloads).toBe(0);

    await writer.flush();

    const afterFlush = JSON.parse(await readFile(path, 'utf8')) as typeof progress;
    expect(afterFlush.stats.pageDownloads).toBe(2);
  });

  it('requires an explicit positive byte budget', () => {
    expect(() => parseVerifyFullBrochuresArguments(['--all-brns'])).toThrow(/--budget-bytes/);
    expect(parseVerifyFullBrochuresArguments(['--budget-bytes=5000', '--all-brns']).budgetBytes).toBe(5000);
    expect(() => parseVerifyFullBrochuresArguments(['--budget-bytes=0', '--all-brns'])).toThrow(/positive safe integer/);
  });

  it('requires an explicit pilot selection or full-run opt-in and isolates pilot outputs', () => {
    expect(() => parseVerifyFullBrochuresArguments(['--budget-bytes=5000'])).toThrow(
      /--candidate-report, --zip-code, or --all-brns/,
    );

    const pilot = parseVerifyFullBrochuresArguments([
      '--budget-bytes=5000',
      '--candidate-report=tools/crawler/data/listing-only/metadata-candidate-report.json',
    ]);
    expect(pilot).toMatchObject({
      candidateReportPath: 'tools/crawler/data/listing-only/metadata-candidate-report.json',
      allBrns: false,
      outputPath: 'tools/crawler/data/listing-only/canonical-page-verification-pilot.json',
      progressPath: 'tools/crawler/data/listing-only/.canonical-page-verification-pilot-progress.json',
      assetsDir: 'tools/crawler/data/listing-only/page-assets-pilot',
    });

    const fullRun = parseVerifyFullBrochuresArguments(['--budget-bytes=5000', '--all-brns']);
    expect(fullRun).toMatchObject({
      allBrns: true,
      outputPath: 'tools/crawler/data/listing-only/canonical-page-verification.json',
    });
    expect(fullRun).not.toHaveProperty('candidateReportPath');
    expect(() => parseVerifyFullBrochuresArguments([
      '--budget-bytes=5000', '--candidate-report=pilot.json', '--all-brns',
    ])).toThrow(/cannot be combined/);

    const zipSample = parseVerifyFullBrochuresArguments(['--budget-bytes=5000', '--zip-code=22043']);
    expect(zipSample).toMatchObject({
      zipCode: '22043',
      outputPath: 'tools/crawler/data/listing-only/canonical-page-verification-22043.json',
      progressPath: 'tools/crawler/data/listing-only/.canonical-page-verification-22043-progress.json',
      assetsDir: 'tools/crawler/data/listing-only/page-assets-22043',
    });
    expect(() => parseVerifyFullBrochuresArguments(['--budget-bytes=5000', '--zip-code=1234'])).toThrow(/five-digit ZIP/);
    expect(() => parseVerifyFullBrochuresArguments([
      '--budget-bytes=5000', '--candidate-report=pilot.json', '--zip-code=22043',
    ])).toThrow(/cannot be combined/);
  });

  it('hashes each ordered original page once and resumes from verified local assets', async () => {
    const assetsDir = await createAssetDirectory();
    const assetStore = await createOriginalPageAssetStore(assetsDir, 1024);
    const inputs = {
      fullScan: {
        byZipCode: {
          '10115': [{
            brn: 'brn-a', storeName: 'REWE', title: 'Angebote',
            validFrom: group.validFrom, validUntil: group.validUntil,
          }],
          '20095': [{
            brn: 'brn-outside-scope', storeName: 'Other', title: 'Other',
            validFrom: group.validFrom, validUntil: group.validUntil,
          }],
        },
      },
      detailPages: { 'brn-a': 2 },
      groups: [group],
    };
    const reference: BrnReference = {
      brn: 'brn-a', zipCode: '10115', latitude: 52.53, longitude: 13.4,
    };
    const progress = createFullPageVerificationProgress('same-input');
    const fetchDetail = jest.fn(async () => ({
      pages: [
        { page: 2, image: 'https://cdn.example/page-2.jpg' },
        { page: 1, image: 'https://cdn.example/page-1.jpg' },
      ],
    }));
    const fetchOriginalBytes = jest.fn(async (url: string) =>
      new TextEncoder().encode(url.endsWith('page-1.jpg') ? 'original page one' : 'original page two'),
    );
    const checkpoint = jest.fn(async () => {});

    const firstRun = await verifyAllBrochurePages({
      inputs,
      references: [reference],
      headers: {},
      assetStore,
      progress,
      checkpoint,
      fetchDetail,
      fetchOriginalBytes,
    });

    expect(firstRun.failures).toEqual([]);
    expect([...firstRun.offersByBrn.keys()]).toEqual(['brn-a']);
    expect(fetchDetail).toHaveBeenCalledTimes(1);
    expect(fetchOriginalBytes).toHaveBeenCalledTimes(2);
    expect(progress.byBrn['brn-a']?.pageUrls).toEqual([
      'https://cdn.example/page-1.jpg',
      'https://cdn.example/page-2.jpg',
    ]);
    expect(progress.byBrn['brn-a']?.pages).toHaveLength(2);
    expect(progress.byBrn['brn-a']?.pageHashes).toHaveLength(2);

    const reopenedStore = await createOriginalPageAssetStore(assetsDir, 1024);
    const fetchDetailOnResume = jest.fn(async () => {
      throw new Error('saved page URLs should avoid another detail request');
    });
    const fetchOnResume = jest.fn(async () => {
      throw new Error('verified local assets should avoid another image download');
    });

    const resumed = await verifyAllBrochurePages({
      inputs,
      references: [reference],
      headers: {},
      assetStore: reopenedStore,
      progress,
      checkpoint,
      fetchDetail: fetchDetailOnResume,
      fetchOriginalBytes: fetchOnResume,
    });

    expect(resumed.failures).toEqual([]);
    expect(fetchDetailOnResume).not.toHaveBeenCalled();
    expect(fetchOnResume).not.toHaveBeenCalled();
    expect(progress.stats.detailRequests).toBe(1);
    expect(progress.stats.pageDownloads).toBe(2);
    expect(progress.stats.reusedPageAssets).toBe(2);
  });

  it('splits regional editions only when the complete ordered page vector differs', () => {
    const samePages = verification('cover', 'inside', ['cover-a', 'page-a']);
    const regionalPages = verification('cover', 'different inside', ['cover-c', 'page-c']);
    const groupWithThreeBrns: CanonicalGroup = {
      ...group,
      brns: ['brn-a', 'brn-b', 'brn-c'],
      availableZipCodes: ['10115', '20095', '50667'],
      sightingCount: 3,
    };
    const progress = createFullPageVerificationProgress('same-input');
    progress.stats.pageDownloads = 4;
    const scope = {
      mode: 'pilot' as const,
      complete: false,
      totalGroupCount: 119,
      verifiedGroupCount: 1,
      totalBrnCount: 4550,
      verifiedBrnCount: 3,
      totalPageReferenceCount: 183472,
      verifiedPageReferenceCount: 6,
    };
    const report = buildFullPageVerificationReport({
      groups: [groupWithThreeBrns],
      byBrn: { 'brn-a': samePages, 'brn-b': samePages, 'brn-c': regionalPages },
      zipCodesByBrn: new Map([
        ['brn-a', new Set(['10115'])],
        ['brn-b', new Set(['20095'])],
        ['brn-c', new Set(['50667'])],
      ]),
      inputFingerprint: 'same-input',
      progress,
      assetBudget: createStorageBudget({ budgetBytes: 1024 }).snapshot(),
      scope,
      generatedAt: '2026-10-07T00:00:00.000Z',
    });

    expect(report.scope).toEqual(scope);
    expect(report.groups[0]?.variants).toHaveLength(2);
    expect(report.groups[0]?.variants.find(({ brns }) => brns.includes('brn-b'))).toMatchObject({
      canonicalBrn: 'brn-a',
      brns: ['brn-a', 'brn-b'],
      availableZipCodes: ['10115', '20095'],
      pageCount: 2,
    });
    expect(report.summary).toMatchObject({
      metadataGroupCount: 1,
      uniqueBrnCount: 3,
      canonicalBrochureCount: 2,
      pageReferenceCount: 6,
      pageDownloadCount: 4,
      reusedPageReferences: 2,
    });
  });
});
