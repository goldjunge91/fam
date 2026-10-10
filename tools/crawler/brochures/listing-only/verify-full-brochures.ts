#!/usr/bin/env bun

import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import { basename, dirname, join, resolve } from 'node:path';
import type { CrawlerPage } from '../types';
import { downloadOriginalImageBytes } from '../r2-storage';
import { loadTargetLocations } from '../locations';
import { transformLiveBrochure } from '../sources/live-offers';
import type { CanonicalGroup } from './group-canonical';
import {
  buildBrnReferences,
  buildBringHeaders,
  buildDetailUrl,
  fetchJsonWithRetry,
  loadBringTokens,
  type BrnReference,
} from './fetch-detail-pages';
import {
  hashOrderedPageSet,
  type PageContentHash,
} from './full-brochure-signature';
import { createOriginalPageAssetStore, type OriginalPageAssetStore } from './original-page-asset-store';
import { createBrochurePageHashingSession } from './original-page-hashes';
import { openSeenHashIndex, type SeenHashIndex } from './seen-hashes';

const defaultPaths = {
  inputPath: 'tools/crawler/data/listing-only/all-stores-full.json',
  detailPagesPath: 'tools/crawler/data/listing-only/detail-pages.json',
  groupsPath: 'tools/crawler/data/listing-only/canonical-groups.json',
  outputPath: 'tools/crawler/data/listing-only/canonical-page-verification.json',
  progressPath: 'tools/crawler/data/listing-only/.canonical-page-verification-progress.json',
  assetsDir: 'tools/crawler/data/listing-only/page-assets',
};
const pilotPaths = {
  outputPath: 'tools/crawler/data/listing-only/canonical-page-verification-pilot.json',
  progressPath: 'tools/crawler/data/listing-only/.canonical-page-verification-pilot-progress.json',
  assetsDir: 'tools/crawler/data/listing-only/page-assets-pilot',
};
const zipSamplePaths = {
  outputPath: 'tools/crawler/data/listing-only/canonical-page-verification-22043.json',
  progressPath: 'tools/crawler/data/listing-only/.canonical-page-verification-22043-progress.json',
  assetsDir: 'tools/crawler/data/listing-only/page-assets-22043',
};

const concurrency = 4;
const SHA256_PATTERN = /^[a-f0-9]{64}$/;

export type FullScanOffer = {
  brn: string;
  storeName: string;
  title: string;
  validFrom: string;
  validUntil: string;
};

export type FullPageVerification = {
  pageUrls: string[];
  pageHashes: PageContentHash[];
  brochureSha256: string;
};

export type VerifiedFullPageBrochure = FullPageVerification & {
  title: string;
  storeId: string;
  pages: CrawlerPage[];
};

type BrnPageProgress = {
  title?: string;
  storeId?: string;
  pageUrls?: string[];
  pages?: CrawlerPage[];
  pageHashes?: PageContentHash[];
  brochureSha256?: string;
  error?: string;
};

export type FullPageVerificationProgress = {
  version: 1;
  inputFingerprint: string;
  pageHashesByUrl: Record<string, string>;
  byBrn: Record<string, BrnPageProgress>;
  stats: {
    detailRequests: number;
    pageDownloads: number;
    newAssetsStored: number;
    contentDeduplicatedDownloads: number;
    reusedPageAssets: number;
  };
};

export type VerifiedFullBrochureVariant = {
  canonicalBrn: string;
  title: string;
  storeId: string;
  brns: string[];
  availableZipCodes: string[];
  pageUrls: string[];
  pageHashes: PageContentHash[];
  pages: CrawlerPage[];
  pageCount: number;
  brochureSha256: string;
};

export type VerifiedFullBrochureGroup = CanonicalGroup & {
  variants: VerifiedFullBrochureVariant[];
};

export type FullPageVerificationReport = {
  version: 1;
  generatedAt: string;
  inputFingerprint: string;
  scope: FullPageVerificationScope;
  summary: {
    metadataGroupCount: number;
    uniqueBrnCount: number;
    canonicalBrochureCount: number;
    pageReferenceCount: number;
    pageDownloadCount: number;
    reusedPageReferences: number;
    newAssetsStored: number;
    contentDeduplicatedDownloads: number;
    assetBudget: ReturnType<OriginalPageAssetStore['storageBudget']['snapshot']>;
  };
  byBrn: Record<string, FullPageVerification>;
  groups: VerifiedFullBrochureGroup[];
};

export type FullPageVerificationScope = {
  mode: 'pilot' | 'zip-sample' | 'all-brns';
  complete: boolean;
  zipCode?: string;
  totalGroupCount: number;
  verifiedGroupCount: number;
  totalBrnCount: number;
  verifiedBrnCount: number;
  totalPageReferenceCount: number;
  verifiedPageReferenceCount: number;
};

export type VerifyFullBrochuresArguments = typeof defaultPaths & {
  budgetBytes: number;
  candidateReportPath?: string;
  allBrns: boolean;
  zipCode?: string;
};

type VerificationInputs = {
  fullScan: { byZipCode: Record<string, FullScanOffer[]> };
  detailPages: Record<string, number>;
  groups: CanonicalGroup[];
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

function positiveInteger(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 1) {
    throw new Error(`${field} must be a positive safe integer`);
  }
  return value;
}

function parseFullScan(value: unknown): VerificationInputs['fullScan'] {
  if (!isRecord(value) || !isRecord(value.byZipCode)) {
    throw new Error('Full scan must contain a byZipCode object');
  }

  const byZipCode: VerificationInputs['fullScan']['byZipCode'] = {};
  for (const [zipCode, offers] of Object.entries(value.byZipCode)) {
    if (!Array.isArray(offers)) throw new Error(`Offers for ZIP ${zipCode} must be an array`);
    byZipCode[zipCode] = offers.map((entry, index) => {
      if (!isRecord(entry)) throw new Error(`Offer ${index + 1} for ZIP ${zipCode} must be an object`);
      return {
        brn: requiredString(entry.brn, `BRN for ZIP ${zipCode}`),
        storeName: requiredString(entry.storeName, `Store name for ZIP ${zipCode}`),
        title: requiredString(entry.title, `Title for ZIP ${zipCode}`),
        validFrom: requiredString(entry.validFrom, `validFrom for ZIP ${zipCode}`),
        validUntil: requiredString(entry.validUntil, `validUntil for ZIP ${zipCode}`),
      };
    });
  }
  return { byZipCode };
}

function parseDetailPages(value: unknown): Record<string, number> {
  if (!isRecord(value)) throw new Error('Detail page counts must be an object keyed by BRN');
  return Object.fromEntries(
    Object.entries(value).map(([brn, pageCount]) => [
      brn,
      positiveInteger(pageCount, `Detail page count for BRN ${brn}`),
    ]),
  );
}

function parseGroups(value: unknown): CanonicalGroup[] {
  if (!isRecord(value) || !Array.isArray(value.groups)) {
    throw new Error('Canonical groups input must contain a groups array');
  }
  return value.groups.map((entry, index) => {
    if (!isRecord(entry)) throw new Error(`Canonical group ${index + 1} must be an object`);
    if (!Array.isArray(entry.brns) || !Array.isArray(entry.availableZipCodes)) {
      throw new Error(`Canonical group ${index + 1} must contain BRN and ZIP arrays`);
    }
    if (!entry.availableZipCodes.every((zipCode) => typeof zipCode === 'string')) {
      throw new Error(`Canonical group ${index + 1} has invalid availableZipCodes`);
    }
    return {
      storeName: requiredString(entry.storeName, `Store name for group ${index + 1}`),
      validFrom: requiredString(entry.validFrom, `validFrom for group ${index + 1}`),
      validUntil: requiredString(entry.validUntil, `validUntil for group ${index + 1}`),
      detailPageCount: positiveInteger(entry.detailPageCount, `detailPageCount for group ${index + 1}`),
      brns: entry.brns.map((brn, brnIndex) => requiredString(brn, `BRN ${brnIndex + 1} for group ${index + 1}`)),
      availableZipCodes: entry.availableZipCodes as string[],
      sightingCount: positiveInteger(entry.sightingCount, `sightingCount for group ${index + 1}`),
    };
  });
}

export function buildPilotVerificationGroups(
  groups: readonly CanonicalGroup[],
  fullScan: VerificationInputs['fullScan'],
  candidateReportValue: unknown,
): { groups: CanonicalGroup[]; brns: string[]; totalBrns: number } {
  if (!isRecord(candidateReportValue) || !isRecord(candidateReportValue.pilotSelection)) {
    throw new Error('Candidate report must contain a pilotSelection object.');
  }
  if (
    !isRecord(candidateReportValue.identity) ||
    candidateReportValue.identity.confirmed !== false ||
    candidateReportValue.skippedFullPageDownloads !== 0
  ) {
    throw new Error('Candidate report must preserve unconfirmed identity and zero skipped page downloads.');
  }
  const pilotSelection = candidateReportValue.pilotSelection;
  if (!Array.isArray(pilotSelection.groups) || pilotSelection.groups.length === 0) {
    throw new Error('Candidate report pilotSelection must contain selected groups.');
  }

  const groupsByMetadata = new Map(groups.map((group) => [
    JSON.stringify([group.storeName, group.validFrom, group.validUntil, group.detailPageCount]),
    group,
  ]));
  const zipCodesByBrn = new Map<string, Set<string>>();
  const allBrns = new Set<string>();
  for (const [zipCode, offers] of Object.entries(fullScan.byZipCode)) {
    for (const offer of offers) {
      allBrns.add(offer.brn);
      const zipCodes = zipCodesByBrn.get(offer.brn) ?? new Set<string>();
      zipCodes.add(zipCode);
      zipCodesByBrn.set(offer.brn, zipCodes);
    }
  }

  const selectedBrns = new Set<string>();
  const pilotGroups = pilotSelection.groups.map((value, index): CanonicalGroup => {
    if (!isRecord(value)) throw new Error(`Pilot group ${index + 1} must be an object.`);
    const storeName = requiredString(value.storeName, `Pilot store for group ${index + 1}`);
    const validFrom = requiredString(value.validFrom, `Pilot validFrom for group ${index + 1}`);
    const validUntil = requiredString(value.validUntil, `Pilot validUntil for group ${index + 1}`);
    const detailPageCount = positiveInteger(value.detailPageCount, `Pilot page count for group ${index + 1}`);
    const representativeBrn = requiredString(value.representativeBrn, `Pilot representative BRN for group ${index + 1}`);
    if (!Array.isArray(value.fullVectorCandidateBrns) || value.fullVectorCandidateBrns.length === 0) {
      throw new Error(`Pilot group ${index + 1} must list full-vector candidate BRNs.`);
    }
    const candidateBrns = value.fullVectorCandidateBrns.map((brn, brnIndex) =>
      requiredString(brn, `Pilot BRN ${brnIndex + 1} for group ${index + 1}`),
    );
    if (new Set(candidateBrns).size !== candidateBrns.length || !candidateBrns.includes(representativeBrn)) {
      throw new Error(`Pilot group ${index + 1} has duplicate BRNs or omits its representative.`);
    }

    const metadataKey = JSON.stringify([storeName, validFrom, validUntil, detailPageCount]);
    const sourceGroup = groupsByMetadata.get(metadataKey);
    if (!sourceGroup) throw new Error(`Pilot metadata group ${storeName} is missing from current inputs.`);
    for (const brn of candidateBrns) {
      if (!sourceGroup.brns.includes(brn)) {
        throw new Error(`Pilot BRN ${brn} does not belong to its selected metadata group.`);
      }
      if (selectedBrns.has(brn)) throw new Error(`Pilot BRN ${brn} appears in more than one selected group.`);
      selectedBrns.add(brn);
    }

    const expectedPageCount = candidateBrns.length * detailPageCount;
    if (value.fullVectorPageCount !== expectedPageCount) {
      throw new Error(`Pilot group ${storeName} has an inconsistent full-vector page count.`);
    }
    const availableZipCodes = new Set<string>();
    let sightingCount = 0;
    for (const brn of candidateBrns) {
      const zipCodes = zipCodesByBrn.get(brn);
      if (!zipCodes || zipCodes.size === 0) throw new Error(`Pilot BRN ${brn} has no ZIP availability.`);
      sightingCount += zipCodes.size;
      for (const zipCode of zipCodes) availableZipCodes.add(zipCode);
    }

    return {
      ...sourceGroup,
      brns: [...candidateBrns].sort(),
      availableZipCodes: [...availableZipCodes].sort(),
      sightingCount,
    };
  });

  return {
    groups: pilotGroups,
    brns: [...selectedBrns].sort(),
    totalBrns: allBrns.size,
  };
}

export function buildZipSampleGroups(
  groups: readonly CanonicalGroup[],
  fullScan: VerificationInputs['fullScan'],
  zipCode: string,
): { groups: CanonicalGroup[]; brns: string[]; totalBrns: number } {
  const offers = fullScan.byZipCode[zipCode];
  if (!offers || offers.length === 0) throw new Error(`ZIP ${zipCode} has no offers in the full scan.`);

  const brnsAtZip = new Set(offers.map(({ brn }) => brn));
  const allBrns = new Set(Object.values(fullScan.byZipCode).flatMap((entries) => entries.map(({ brn }) => brn)));
  const selectedBrns = new Set<string>();
  const zipGroups: CanonicalGroup[] = [];

  for (const group of groups) {
    const brns = group.brns.filter((brn) => brnsAtZip.has(brn)).sort();
    if (brns.length === 0) continue;
    for (const brn of brns) {
      if (selectedBrns.has(brn)) throw new Error(`BRN ${brn} appears in more than one canonical group.`);
      selectedBrns.add(brn);
    }
    zipGroups.push({ ...group, brns, availableZipCodes: [zipCode], sightingCount: brns.length });
  }

  if (selectedBrns.size !== brnsAtZip.size || [...brnsAtZip].some((brn) => !selectedBrns.has(brn))) {
    throw new Error(`BRNs at ZIP ${zipCode} do not match the canonical groups.`);
  }
  return { groups: zipGroups, brns: [...selectedBrns].sort(), totalBrns: allBrns.size };
}

export function parseVerifyFullBrochuresArguments(args: readonly string[]): VerifyFullBrochuresArguments {
  const result: VerifyFullBrochuresArguments = { ...defaultPaths, budgetBytes: 0, allBrns: false };
  const explicitPaths = new Set<keyof VerifyFullBrochuresArguments>();
  const flags: Record<string, keyof VerifyFullBrochuresArguments> = {
    '--input': 'inputPath',
    '--details': 'detailPagesPath',
    '--groups': 'groupsPath',
    '--output': 'outputPath',
    '--progress': 'progressPath',
    '--assets-dir': 'assetsDir',
    '--budget-bytes': 'budgetBytes',
    '--candidate-report': 'candidateReportPath',
    '--zip-code': 'zipCode',
  };

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (!argument) continue;
    if (argument === '--all-brns') {
      result.allBrns = true;
      continue;
    }
    const equalsIndex = argument.indexOf('=');
    const flag = equalsIndex < 0 ? argument : argument.slice(0, equalsIndex);
    const field = flags[flag];
    if (!field) throw new Error(`Unknown argument: ${argument}`);
    const value = equalsIndex < 0 ? args[++index] : argument.slice(equalsIndex + 1);
    if (!value || value.startsWith('--')) throw new Error(`Expected a value after ${flag}`);
    if (field === 'budgetBytes') {
      const parsed = Number(value);
      if (!Number.isSafeInteger(parsed) || parsed < 1) {
        throw new Error('--budget-bytes must be a positive safe integer');
      }
      result.budgetBytes = parsed;
    } else {
      switch (field) {
        case 'inputPath': result.inputPath = value; break;
        case 'detailPagesPath': result.detailPagesPath = value; break;
        case 'groupsPath': result.groupsPath = value; break;
        case 'outputPath': result.outputPath = value; break;
        case 'progressPath': result.progressPath = value; break;
        case 'assetsDir': result.assetsDir = value; break;
        case 'candidateReportPath': result.candidateReportPath = value; break;
        case 'zipCode':
          if (!/^\d{5}$/.test(value)) throw new Error('--zip-code must be a five-digit ZIP code');
          result.zipCode = value;
          break;
      }
      explicitPaths.add(field);
    }
  }

  if (result.budgetBytes < 1) throw new Error('A required --budget-bytes limit must be supplied');
  const selectionCount = Number(Boolean(result.candidateReportPath)) + Number(result.allBrns) + Number(Boolean(result.zipCode));
  if (selectionCount > 1) {
    throw new Error('--candidate-report, --zip-code, and --all-brns cannot be combined.');
  }
  if (selectionCount === 0) {
    throw new Error('Choose --candidate-report, --zip-code, or --all-brns before downloading brochure pages.');
  }
  if (result.candidateReportPath || result.zipCode) {
    const samplePaths = result.zipCode ? zipSamplePaths : pilotPaths;
    if (!explicitPaths.has('outputPath')) result.outputPath = samplePaths.outputPath;
    if (!explicitPaths.has('progressPath')) result.progressPath = samplePaths.progressPath;
    if (!explicitPaths.has('assetsDir')) result.assetsDir = samplePaths.assetsDir;
    if (
      resolve(result.outputPath) === resolve(defaultPaths.outputPath) ||
      resolve(result.progressPath) === resolve(defaultPaths.progressPath) ||
      resolve(result.assetsDir) === resolve(defaultPaths.assetsDir)
    ) {
      throw new Error('Pilot output, progress, and assets must use paths separate from the full run.');
    }
  }
  return result;
}

function hashInputs(files: readonly { path: string; bytes: Buffer }[]): string {
  const hash = createHash('sha256');
  for (const file of [...files].sort((left, right) => left.path.localeCompare(right.path))) {
    hash.update(file.path).update('\0').update(String(file.bytes.byteLength)).update('\0').update(file.bytes);
  }
  return hash.digest('hex');
}

export function createFullPageVerificationProgress(inputFingerprint: string): FullPageVerificationProgress {
  return {
    version: 1,
    inputFingerprint,
    pageHashesByUrl: {},
    byBrn: {},
    stats: {
      detailRequests: 0,
      pageDownloads: 0,
      newAssetsStored: 0,
      contentDeduplicatedDownloads: 0,
      reusedPageAssets: 0,
    },
  };
}

function parseProgress(value: unknown, inputFingerprint: string): FullPageVerificationProgress {
  if (!isRecord(value)) return createFullPageVerificationProgress(inputFingerprint);
  if (value.version !== 1 || value.inputFingerprint !== inputFingerprint) {
    throw new Error('Progress input differs from this run. Choose a new --progress path to start over.');
  }
  if (!isRecord(value.pageHashesByUrl) || !isRecord(value.byBrn) || !isRecord(value.stats)) {
    throw new Error('Progress file is malformed; choose a new --progress path to start over.');
  }

  const pageHashesByUrl: Record<string, string> = {};
  for (const [url, sha256] of Object.entries(value.pageHashesByUrl)) {
    if (url.length === 0 || typeof sha256 !== 'string' || !SHA256_PATTERN.test(sha256)) {
      throw new Error('Progress file contains an invalid URL-to-hash entry.');
    }
    pageHashesByUrl[url] = sha256;
  }

  const stats: FullPageVerificationProgress['stats'] = {
    detailRequests: 0,
    pageDownloads: 0,
    newAssetsStored: 0,
    contentDeduplicatedDownloads: 0,
    reusedPageAssets: 0,
  };
  for (const key of Object.keys(stats) as Array<keyof typeof stats>) {
    const count = value.stats[key];
    if (!Number.isSafeInteger(count) || Number(count) < 0) {
      throw new Error(`Progress file contains an invalid ${key} count.`);
    }
    stats[key] = Number(count);
  }

  const byBrn: FullPageVerificationProgress['byBrn'] = {};
  for (const [brn, entry] of Object.entries(value.byBrn)) {
    if (!isRecord(entry)) throw new Error(`Progress file contains invalid BRN state for ${brn}.`);
    const pageUrls = Array.isArray(entry.pageUrls) && entry.pageUrls.every((url) => typeof url === 'string')
      ? [...entry.pageUrls]
      : undefined;
    const pages = Array.isArray(entry.pages) && entry.pages.every((page) =>
      isRecord(page) && Number.isSafeInteger(page.number) && typeof page.imageUrl === 'string' && Array.isArray(page.hotspots),
    )
      ? entry.pages as CrawlerPage[]
      : undefined;
    const pageHashes = Array.isArray(entry.pageHashes) && entry.pageHashes.every((page) =>
      isRecord(page) && Number.isSafeInteger(page.pageNumber) && typeof page.sha256 === 'string' && SHA256_PATTERN.test(page.sha256),
    )
      ? entry.pageHashes.map((page) => ({ pageNumber: Number((page as Record<string, unknown>).pageNumber), sha256: (page as Record<string, unknown>).sha256 as string }))
      : undefined;
    const brochureSha256 = typeof entry.brochureSha256 === 'string' && SHA256_PATTERN.test(entry.brochureSha256)
      ? entry.brochureSha256
      : undefined;
    byBrn[brn] = {
      ...(typeof entry.title === 'string' ? { title: entry.title } : {}),
      ...(typeof entry.storeId === 'string' ? { storeId: entry.storeId } : {}),
      ...(pageUrls ? { pageUrls } : {}),
      ...(pages ? { pages } : {}),
      ...(pageHashes ? { pageHashes } : {}),
      ...(brochureSha256 ? { brochureSha256 } : {}),
      ...(typeof entry.error === 'string' ? { error: entry.error } : {}),
    };
  }

  return { version: 1, inputFingerprint, pageHashesByUrl, byBrn, stats };
}

async function readProgress(path: string, inputFingerprint: string): Promise<FullPageVerificationProgress> {
  try {
    return parseProgress(JSON.parse(await readFile(path, 'utf8')) as unknown, inputFingerprint);
  } catch (error) {
    if (isRecord(error) && error.code === 'ENOENT') return createFullPageVerificationProgress(inputFingerprint);
    throw error;
  }
}

async function writeJsonAtomic(path: string, value: unknown): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const temporaryPath = `${path}.${process.pid}.${randomUUID()}.tmp`;
  try {
    await writeFile(temporaryPath, JSON.stringify(value, null, 2), 'utf8');
    await rename(temporaryPath, path);
  } catch (error) {
    await unlink(temporaryPath).catch(() => undefined);
    throw error;
  }
}

export function createProgressCheckpointWriter(
  path: string,
  progress: FullPageVerificationProgress,
  intervalMs = 30_000,
): { checkpoint: () => Promise<void>; flush: () => Promise<void> } {
  let lastWriteAt = 0;
  let dirty = true;
  let inFlight: Promise<void> | undefined;

  const write = (): Promise<void> => {
    if (inFlight) return inFlight;

    const snapshot = JSON.parse(JSON.stringify(progress)) as unknown;
    dirty = false;
    const pending = writeJsonAtomic(path, snapshot)
      .then(() => { lastWriteAt = Date.now(); })
      .catch((error: unknown) => {
        dirty = true;
        throw error;
      })
      .finally(() => {
        if (inFlight === pending) inFlight = undefined;
      });
    inFlight = pending;
    return pending;
  };

  return {
    checkpoint: async () => {
      dirty = true;
      if (inFlight) {
        await inFlight;
        return;
      }
      if (Date.now() - lastWriteAt >= intervalMs) await write();
    },
    flush: async () => {
      if (inFlight) await inFlight;
      if (dirty) await write();
    },
  };
}

function indexOffers(fullScan: VerificationInputs['fullScan']): Map<string, FullScanOffer> {
  const offersByBrn = new Map<string, FullScanOffer>();
  for (const zipCode of Object.keys(fullScan.byZipCode).sort()) {
    for (const offer of fullScan.byZipCode[zipCode] ?? []) {
      const existing = offersByBrn.get(offer.brn);
      if (existing && (
        existing.storeName !== offer.storeName ||
        existing.validFrom !== offer.validFrom ||
        existing.validUntil !== offer.validUntil
      )) {
        throw new Error(`BRN ${offer.brn} has conflicting metadata in the full scan.`);
      }
      if (!existing) offersByBrn.set(offer.brn, offer);
    }
  }
  return offersByBrn;
}

function indexZipCodes(fullScan: VerificationInputs['fullScan']): Map<string, Set<string>> {
  const zipCodesByBrn = new Map<string, Set<string>>();
  for (const [zipCode, offers] of Object.entries(fullScan.byZipCode)) {
    for (const offer of offers) {
      const zipCodes = zipCodesByBrn.get(offer.brn) ?? new Set<string>();
      zipCodes.add(zipCode);
      zipCodesByBrn.set(offer.brn, zipCodes);
    }
  }
  return zipCodesByBrn;
}

function validateInputs(
  { fullScan, detailPages, groups }: VerificationInputs,
  references: readonly BrnReference[],
): { offersByBrn: Map<string, FullScanOffer>; pageCountByBrn: Map<string, number>; zipCodesByBrn: Map<string, Set<string>> } {
  const offersByBrn = indexOffers(fullScan);
  const zipCodesByBrn = indexZipCodes(fullScan);
  const pageCountByBrn = new Map<string, number>();
  const groupBrns = new Set<string>();
  for (const group of groups) {
    if (group.brns.length === 0) throw new Error('Canonical groups contain an empty BRN list.');
    for (const brn of group.brns) {
      if (groupBrns.has(brn)) throw new Error(`BRN ${brn} appears in more than one canonical group.`);
      groupBrns.add(brn);
      const offer = offersByBrn.get(brn);
      if (!offer) throw new Error(`BRN ${brn} is missing from the full scan.`);
      if (
        offer.storeName !== group.storeName ||
        offer.validFrom !== group.validFrom ||
        offer.validUntil !== group.validUntil
      ) {
        throw new Error(`Full-scan metadata for BRN ${brn} does not match its canonical group.`);
      }
      if (detailPages[brn] !== group.detailPageCount) {
        throw new Error(`Detail page count for BRN ${brn} does not match its canonical group.`);
      }
      pageCountByBrn.set(brn, group.detailPageCount);
    }
  }

  const referenceBrns = new Set(references.map(({ brn }) => brn));
  if (
    groupBrns.size === 0 ||
    referenceBrns.size !== groupBrns.size ||
    [...groupBrns].some((brn) => !referenceBrns.has(brn))
  ) {
    throw new Error('BRNs in canonical groups do not match the full scan references.');
  }
  const offersInScope = new Map(
    [...offersByBrn].filter(([brn]) => groupBrns.has(brn)),
  );
  return { offersByBrn: offersInScope, pageCountByBrn, zipCodesByBrn };
}

function pageMetadataFromProgress(
  entry: BrnPageProgress | undefined,
  expectedPageCount: number,
): { title: string; storeId: string; pageUrls: string[]; pages: CrawlerPage[] } | undefined {
  if (
    !entry?.title || !entry.storeId || !entry.pageUrls || !entry.pages ||
    entry.pageUrls.length !== expectedPageCount || entry.pages.length !== expectedPageCount ||
    entry.pageUrls.some((url) => url.length === 0) ||
    entry.pages.some((page, index) => page.number !== index + 1 || page.imageUrl !== entry.pageUrls?.[index])
  ) {
    return undefined;
  }
  return { title: entry.title, storeId: entry.storeId, pageUrls: entry.pageUrls, pages: entry.pages };
}

function pageMetadataFromDetail(
  offer: FullScanOffer,
  detail: unknown,
  expectedPageCount: number,
): { title: string; storeId: string; pageUrls: string[]; pages: CrawlerPage[] } {
  const transformed = transformLiveBrochure({
    brn: offer.brn,
    title: offer.title,
    company: { title: offer.storeName },
    activeFrom: offer.validFrom,
    activeTo: offer.validUntil,
  }, detail);
  if (!transformed) throw new Error('Bring detail response did not contain usable brochure pages.');

  const pages = [...transformed.brochure.pages].sort((left, right) => left.number - right.number);
  if (pages.length !== expectedPageCount || pages.some((page, index) => page.number !== index + 1)) {
    throw new Error(`Expected ${expectedPageCount} ordered pages; Bring detail returned ${pages.length}.`);
  }
  if (pages.some((page) => page.imageUrl.trim().length === 0)) {
    throw new Error('Bring detail response has a page without an image URL.');
  }
  return {
    title: offer.title,
    storeId: transformed.brochure.storeId,
    pageUrls: pages.map((page) => page.imageUrl),
    pages,
  };
}

export async function verifyAllBrochurePages(options: {
  inputs: VerificationInputs;
  references: readonly BrnReference[];
  headers: Record<string, string>;
  assetStore: OriginalPageAssetStore;
  seenHashIndex: SeenHashIndex;
  progress: FullPageVerificationProgress;
  checkpoint: () => Promise<void>;
  fetchDetail: (reference: BrnReference, headers: Record<string, string>) => Promise<unknown>;
  fetchOriginalBytes: (url: string) => Promise<ArrayBuffer | Uint8Array>;
}): Promise<{ failures: Array<{ brn: string; error: string }>; offersByBrn: Map<string, FullScanOffer>; zipCodesByBrn: Map<string, Set<string>> }> {
  const { inputs, references, headers, assetStore, seenHashIndex, progress, checkpoint } = options;
  const { offersByBrn, pageCountByBrn, zipCodesByBrn } = validateInputs(inputs, references);

  const pageHashSession = createBrochurePageHashingSession(
    options.fetchOriginalBytes,
    async ({ sha256, bytes }) => {
      if (await assetStore.put(sha256, bytes)) progress.stats.newAssetsStored += 1;
      else progress.stats.contentDeduplicatedDownloads += 1;
    },
    {
      resolveStoredHash: async (url) => {
        const sha256 = progress.pageHashesByUrl[url];
        if (!sha256) return undefined;
        const bytes = await assetStore.read(sha256);
        if (!bytes) {
          delete progress.pageHashesByUrl[url];
          await checkpoint();
          return undefined;
        }
        progress.stats.reusedPageAssets += 1;
        return sha256;
      },
      onPageHashed: async ({ url, sha256 }) => {
        progress.pageHashesByUrl[url] = sha256;
        progress.stats.pageDownloads += 1;
        await checkpoint();
      },
    },
  );

  const failures: Array<{ brn: string; error: string }> = [];
  const referencesInOrder = [...references].sort((left, right) => left.brn.localeCompare(right.brn));

  for (let index = 0; index < referencesInOrder.length; index += concurrency) {
    const batch = referencesInOrder.slice(index, index + concurrency);
    await Promise.all(batch.map(async (reference) => {
      const brn = reference.brn;
      const pageCount = pageCountByBrn.get(brn);
      const offer = offersByBrn.get(brn);
      if (!pageCount || !offer) {
        failures.push({ brn, error: 'Missing canonical page count or full-scan metadata.' });
        return;
      }

      let pageMetadata = pageMetadataFromProgress(progress.byBrn[brn], pageCount);
      try {
        if (!pageMetadata) {
          const detail = await options.fetchDetail(reference, headers);
          progress.stats.detailRequests += 1;
          pageMetadata = pageMetadataFromDetail(offer, detail, pageCount);
          progress.byBrn[brn] = pageMetadata;
          await checkpoint();
        }

        const signature = await pageHashSession.hashBrochurePages(pageMetadata.pageUrls);
        if (signature.pageHashes.length !== pageCount) {
          throw new Error(`Expected ${pageCount} page hashes; received ${signature.pageHashes.length}.`);
        }
        for (const pageHash of signature.pageHashes) {
          await seenHashIndex.record({
            sha256: pageHash.sha256,
            assetPath: `${pageHash.sha256}.bin`,
            use: { brochureId: brn, pageNumber: pageHash.pageNumber },
          });
        }
        progress.byBrn[brn] = {
          ...pageMetadata,
          pageHashes: signature.pageHashes,
          brochureSha256: signature.brochureSha256,
        };
        await checkpoint();
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        progress.byBrn[brn] = {
          ...(pageMetadata ?? {}),
          error: message.slice(0, 500),
        };
        failures.push({ brn, error: message });
        await checkpoint();
      }
    }));

    await checkpoint();
    console.log(
      `${Math.min(index + batch.length, referencesInOrder.length)}/${referencesInOrder.length} BRNs | ${progress.stats.pageDownloads} Originalseiten geladen | ${failures.length} Fehler`,
    );
  }

  return { failures, offersByBrn, zipCodesByBrn };
}

export function buildFullPageVerificationReport(options: {
  groups: readonly CanonicalGroup[];
  byBrn: Record<string, VerifiedFullPageBrochure>;
  zipCodesByBrn: ReadonlyMap<string, ReadonlySet<string>>;
  inputFingerprint: string;
  progress: FullPageVerificationProgress;
  assetBudget: ReturnType<OriginalPageAssetStore['storageBudget']['snapshot']>;
  scope?: FullPageVerificationScope;
  generatedAt?: string;
}): FullPageVerificationReport {
  const { groups, byBrn, zipCodesByBrn, inputFingerprint, progress, assetBudget } = options;
  let pageReferenceCount = 0;
  const verifiedBrns = new Set<string>();
  const verifiedGroups: VerifiedFullBrochureGroup[] = groups.map((group) => {
    const variantsByVector = new Map<string, { brns: string[]; verification: VerifiedFullPageBrochure }>();

    for (const brn of group.brns) {
      if (verifiedBrns.has(brn)) throw new Error(`BRN ${brn} appears in more than one group.`);
      verifiedBrns.add(brn);
      const verification = byBrn[brn];
      if (!verification) throw new Error(`BRN ${brn} has no complete page verification.`);
      if (
        verification.pageHashes.length !== group.detailPageCount ||
        verification.pageUrls.length !== group.detailPageCount ||
        verification.pages.length !== group.detailPageCount ||
        verification.pages.some((page, index) => page.number !== index + 1 || page.imageUrl !== verification.pageUrls[index])
      ) {
        throw new Error(`BRN ${brn} has an incomplete page hash vector.`);
      }
      const orderedHashes = [...verification.pageHashes].sort((left, right) => left.pageNumber - right.pageNumber);
      if (hashOrderedPageSet(orderedHashes, group.detailPageCount) !== verification.brochureSha256) {
        throw new Error(`BRN ${brn} has an inconsistent full brochure hash.`);
      }

      pageReferenceCount += group.detailPageCount;
      const vectorKey = JSON.stringify(orderedHashes.map(({ pageNumber, sha256 }) => [pageNumber, sha256]));
      const variant = variantsByVector.get(vectorKey);
      if (variant) variant.brns.push(brn);
      else variantsByVector.set(vectorKey, {
        brns: [brn],
        verification: { ...verification, pageHashes: orderedHashes },
      });
    }

    const variants: VerifiedFullBrochureVariant[] = [...variantsByVector.values()]
      .map(({ brns, verification }) => {
        brns.sort();
        const variantZips = new Set(brns.flatMap((brn) => [...(zipCodesByBrn.get(brn) ?? [])]));
        return {
          canonicalBrn: brns[0]!,
          title: verification.title,
          storeId: verification.storeId,
          brns,
          availableZipCodes: [...variantZips].sort(),
          pageUrls: [...verification.pageUrls],
          pageHashes: verification.pageHashes.map((pageHash) => ({ ...pageHash })),
          pages: verification.pages.map((page) => ({ ...page, hotspots: [...page.hotspots] })),
          pageCount: group.detailPageCount,
          brochureSha256: verification.brochureSha256,
        };
      })
      .sort((left, right) => left.brochureSha256.localeCompare(right.brochureSha256));

    return { ...group, variants };
  });

  const canonicalBrochureCount = verifiedGroups.reduce((sum, group) => sum + group.variants.length, 0);
  const pageDownloads = progress.stats.pageDownloads;
  return {
    version: 1,
    generatedAt: options.generatedAt ?? new Date().toISOString(),
    inputFingerprint,
    scope: options.scope ?? {
      mode: 'all-brns',
      complete: true,
      totalGroupCount: groups.length,
      verifiedGroupCount: groups.length,
      totalBrnCount: verifiedBrns.size,
      verifiedBrnCount: verifiedBrns.size,
      totalPageReferenceCount: pageReferenceCount,
      verifiedPageReferenceCount: pageReferenceCount,
    },
    summary: {
      metadataGroupCount: groups.length,
      uniqueBrnCount: verifiedBrns.size,
      canonicalBrochureCount,
      pageReferenceCount,
      pageDownloadCount: pageDownloads,
      reusedPageReferences: Math.max(0, pageReferenceCount - pageDownloads),
      newAssetsStored: progress.stats.newAssetsStored,
      contentDeduplicatedDownloads: progress.stats.contentDeduplicatedDownloads,
      assetBudget,
    },
    byBrn: Object.fromEntries(
      Object.entries(byBrn).map(([brn, verification]) => [brn, {
        pageUrls: verification.pageUrls,
        pageHashes: verification.pageHashes,
        brochureSha256: verification.brochureSha256,
      }]),
    ),
    groups: verifiedGroups,
  };
}

async function main(): Promise<void> {
  const args = parseVerifyFullBrochuresArguments(process.argv.slice(2));
  const [inputBytes, detailBytes, groupBytes] = await Promise.all([
    readFile(args.inputPath),
    readFile(args.detailPagesPath),
    readFile(args.groupsPath),
  ]);
  const candidateReportBytes = args.candidateReportPath
    ? await readFile(args.candidateReportPath)
    : undefined;
  const inputFiles = [
    { path: args.inputPath, bytes: inputBytes },
    { path: args.detailPagesPath, bytes: detailBytes },
    { path: args.groupsPath, bytes: groupBytes },
    ...(candidateReportBytes && args.candidateReportPath
      ? [{ path: args.candidateReportPath, bytes: candidateReportBytes }]
      : []),
  ];
  const inputFingerprint = hashInputs([
    ...inputFiles,
    ...(args.zipCode ? [{ path: 'scope:zip-code', bytes: Buffer.from(args.zipCode) }] : []),
  ]);
  const inputs: VerificationInputs = {
    fullScan: parseFullScan(JSON.parse(inputBytes.toString('utf8')) as unknown),
    detailPages: parseDetailPages(JSON.parse(detailBytes.toString('utf8')) as unknown),
    groups: parseGroups(JSON.parse(groupBytes.toString('utf8')) as unknown),
  };
  const locations = await loadTargetLocations({ all: true });
  const allReferences = buildBrnReferences(inputs.fullScan, locations);
  let verificationInputs = inputs;
  let references = allReferences;
  let scope: FullPageVerificationScope = {
    mode: 'all-brns',
    complete: true,
    totalGroupCount: inputs.groups.length,
    verifiedGroupCount: inputs.groups.length,
    totalBrnCount: allReferences.length,
    verifiedBrnCount: allReferences.length,
    totalPageReferenceCount: inputs.groups.reduce(
      (sum, group) => sum + group.brns.length * group.detailPageCount,
      0,
    ),
    verifiedPageReferenceCount: inputs.groups.reduce(
      (sum, group) => sum + group.brns.length * group.detailPageCount,
      0,
    ),
  };
  if (candidateReportBytes) {
    const pilot = buildPilotVerificationGroups(
      inputs.groups,
      inputs.fullScan,
      JSON.parse(candidateReportBytes.toString('utf8')) as unknown,
    );
    const selectedBrns = new Set(pilot.brns);
    verificationInputs = { ...inputs, groups: pilot.groups };
    references = allReferences.filter(({ brn }) => selectedBrns.has(brn));
    if (references.length !== selectedBrns.size) {
      throw new Error('Pilot candidate BRNs do not match full-scan references.');
    }
    const verifiedPageReferenceCount = pilot.groups.reduce(
      (sum, group) => sum + group.brns.length * group.detailPageCount,
      0,
    );
    scope = {
      mode: 'pilot',
      complete: false,
      totalGroupCount: inputs.groups.length,
      verifiedGroupCount: pilot.groups.length,
      totalBrnCount: pilot.totalBrns,
      verifiedBrnCount: pilot.brns.length,
      totalPageReferenceCount: inputs.groups.reduce(
        (sum, group) => sum + group.brns.length * group.detailPageCount,
        0,
      ),
      verifiedPageReferenceCount,
    };
  } else if (args.zipCode) {
    const zipSample = buildZipSampleGroups(inputs.groups, inputs.fullScan, args.zipCode);
    const selectedBrns = new Set(zipSample.brns);
    verificationInputs = { ...inputs, groups: zipSample.groups };
    references = allReferences.filter(({ brn }) => selectedBrns.has(brn));
    if (references.length !== selectedBrns.size) {
      throw new Error(`BRNs for ZIP ${args.zipCode} do not match full-scan references.`);
    }
    const verifiedPageReferenceCount = zipSample.groups.reduce(
      (sum, group) => sum + group.brns.length * group.detailPageCount,
      0,
    );
    scope = {
      mode: 'zip-sample',
      complete: false,
      zipCode: args.zipCode,
      totalGroupCount: inputs.groups.length,
      verifiedGroupCount: zipSample.groups.length,
      totalBrnCount: zipSample.totalBrns,
      verifiedBrnCount: zipSample.brns.length,
      totalPageReferenceCount: inputs.groups.reduce(
        (sum, group) => sum + group.brns.length * group.detailPageCount,
        0,
      ),
      verifiedPageReferenceCount,
    };
  }
  const progress = await readProgress(args.progressPath, inputFingerprint);
  const assetStore = await createOriginalPageAssetStore(args.assetsDir, args.budgetBytes);
  const seenHashIndex = await openSeenHashIndex({
    indexPath: join(dirname(args.assetsDir), `.${basename(args.assetsDir)}-index`, 'seen-hashes.json'),
    assetsDir: args.assetsDir,
  });
  const progressWriter = createProgressCheckpointWriter(args.progressPath, progress);
  let bringHeaders: Record<string, string> | undefined;
  const getHeaders = () => {
    bringHeaders ??= buildBringHeaders(loadBringTokens());
    return bringHeaders;
  };

  console.log(
    `Vollprospekt-Verifikation (${scope.mode}): ${references.length} eindeutige BRNs | ${scope.verifiedPageReferenceCount} Seitenreferenzen | Budget ${args.budgetBytes} Bytes | Assets ${args.assetsDir}`,
  );
  let result: Awaited<ReturnType<typeof verifyAllBrochurePages>>;
  try {
    result = await verifyAllBrochurePages({
      inputs: verificationInputs,
      references,
      headers: {},
      assetStore,
      seenHashIndex,
      progress,
      checkpoint: progressWriter.checkpoint,
      fetchDetail: async (reference) => fetchJsonWithRetry(buildDetailUrl(reference), getHeaders()),
      fetchOriginalBytes: downloadOriginalImageBytes,
    });
  } finally {
    await progressWriter.flush();
  }

  if (result.failures.length > 0) {
    console.error(`${result.failures.length} BRNs unvollständig; kein Verifikationsbericht veröffentlicht.`);
    for (const failure of result.failures) console.error(`${failure.brn}: ${failure.error}`);
    process.exitCode = 1;
    return;
  }

  const byBrn: Record<string, VerifiedFullPageBrochure> = {};
  for (const brn of [...result.offersByBrn.keys()].sort()) {
    const entry = progress.byBrn[brn];
    if (!entry?.title || !entry.storeId || !entry.pageUrls || !entry.pages || !entry.pageHashes || !entry.brochureSha256) {
      throw new Error(`BRN ${brn} has no completed verification state.`);
    }
    byBrn[brn] = {
      title: entry.title,
      storeId: entry.storeId,
      pageUrls: entry.pageUrls,
      pages: entry.pages,
      pageHashes: entry.pageHashes,
      brochureSha256: entry.brochureSha256,
    };
  }

  const report = buildFullPageVerificationReport({
    groups: verificationInputs.groups,
    byBrn,
    zipCodesByBrn: result.zipCodesByBrn,
    inputFingerprint,
    progress,
    assetBudget: assetStore.storageBudget.snapshot(),
    scope,
  });
  await writeJsonAtomic(args.outputPath, report);
  await unlink(args.progressPath).catch(() => undefined);
  console.log(
    `Fertig: ${report.summary.uniqueBrnCount} BRNs, ${report.summary.canonicalBrochureCount} vollständige Prospekte, ${report.summary.pageDownloadCount} Seitenabrufe, ${report.summary.reusedPageReferences} wiederverwendete Seitenreferenzen.`,
  );
  console.log(`Bericht: ${args.outputPath}`);
}

if (process.argv[1]?.endsWith('verify-full-brochures.ts')) {
  main().catch((error: unknown) => {
    console.error(`Fehler: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  });
}
