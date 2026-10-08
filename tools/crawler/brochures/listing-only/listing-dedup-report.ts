#!/usr/bin/env bun

import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

type ListingSighting = {
  brn: string;
  storeName: string;
  validFrom: string;
  validUntil: string;
};

type ZipSightings = {
  zipCode: string;
  entries: ListingSighting[];
};

type MetadataGroup = {
  storeName: string;
  validFrom: string;
  validUntil: string;
  detailPageCount: number;
  brns: string[];
  availableZipCodes: string[];
  sightingCount: number;
};

type MutableMetadataGroup = {
  storeName: string;
  validFrom: string;
  validUntil: string;
  detailPageCount: number;
  brns: Set<string>;
  availableZipCodes: Set<string>;
  seenBrnZipPairs: Set<string>;
  sightingCount: number;
};

export type ListingDedupReportArguments = {
  inputPath: string;
  detailPagesPath: string;
  outputPath: string;
};

const DEFAULT_ARGUMENTS: ListingDedupReportArguments = {
  inputPath: 'tools/crawler/data/listing-only/all-stores-full.json',
  detailPagesPath: 'tools/crawler/data/listing-only/detail-pages.json',
  outputPath: 'tools/crawler/data/listing-only/listing-dedup-report.json',
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

function parseFullScan(value: unknown): ZipSightings[] {
  if (!isRecord(value) || !isRecord(value.byZipCode)) {
    throw new Error('Full scan must contain a byZipCode object');
  }

  return Object.entries(value.byZipCode).map(([zipCode, entries]) => {
    if (!Array.isArray(entries)) {
      throw new Error(`Offers for ZIP ${zipCode} must be an array`);
    }

    return {
      zipCode,
      entries: entries.map((entry, index) => {
        if (!isRecord(entry)) {
          throw new Error(`Offer ${index + 1} for ZIP ${zipCode} must be an object`);
        }

        return {
          brn: requiredString(entry.brn, `BRN for ZIP ${zipCode}`),
          storeName: requiredString(entry.storeName, `Store name for ZIP ${zipCode}`),
          validFrom: requiredString(entry.validFrom, `validFrom for ZIP ${zipCode}`),
          validUntil: requiredString(entry.validUntil, `validUntil for ZIP ${zipCode}`),
        };
      }),
    };
  });
}

function parseDetailPages(value: unknown): Map<string, number> {
  if (!isRecord(value)) {
    throw new Error('Detail page counts must be an object keyed by BRN');
  }

  const detailPages = new Map<string, number>();
  for (const [brn, pageCount] of Object.entries(value)) {
    if (typeof pageCount !== 'number' || !Number.isSafeInteger(pageCount) || pageCount < 1) {
      throw new Error(`Detail page count for BRN ${brn} must be a positive integer`);
    }
    detailPages.set(brn, pageCount);
  }

  return detailPages;
}

function compareStrings(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function compareGroups(left: MetadataGroup, right: MetadataGroup): number {
  return (
    compareStrings(left.storeName, right.storeName) ||
    compareStrings(left.validFrom, right.validFrom) ||
    compareStrings(left.validUntil, right.validUntil) ||
    left.detailPageCount - right.detailPageCount
  );
}

function metadataKey(sighting: ListingSighting, detailPageCount: number): string {
  return JSON.stringify([
    sighting.storeName,
    sighting.validFrom,
    sighting.validUntil,
    detailPageCount,
  ]);
}

function createGroup(sighting: ListingSighting, detailPageCount: number): MutableMetadataGroup {
  return {
    storeName: sighting.storeName,
    validFrom: sighting.validFrom,
    validUntil: sighting.validUntil,
    detailPageCount,
    brns: new Set(),
    availableZipCodes: new Set(),
    seenBrnZipPairs: new Set(),
    sightingCount: 0,
  };
}

function serializeGroup(group: MutableMetadataGroup): MetadataGroup {
  return {
    storeName: group.storeName,
    validFrom: group.validFrom,
    validUntil: group.validUntil,
    detailPageCount: group.detailPageCount,
    brns: [...group.brns].sort(compareStrings),
    availableZipCodes: [...group.availableZipCodes].sort(compareStrings),
    sightingCount: group.sightingCount,
  };
}

function possibleSavings(brnCount: number, candidateGroupCount: number): number {
  return Math.max(0, brnCount - candidateGroupCount);
}

export function buildListingDedupReport(fullScanValue: unknown, detailPagesValue: unknown) {
  const zipSightings = parseFullScan(fullScanValue).sort((left, right) =>
    compareStrings(left.zipCode, right.zipCode),
  );
  const detailPages = parseDetailPages(detailPagesValue);
  const brnZipCodes = new Map<string, Set<string>>();
  const brnPageCounts = new Map<string, number>();
  const globalGroups = new Map<string, MutableMetadataGroup>();
  const localGroups = new Map<string, Map<string, MutableMetadataGroup>>();
  const localBrns = new Map<string, Set<string>>();
  const localTotals = new Map<string, { rawSightings: number; rawPages: number }>();
  let rawSightings = 0;
  let rawPageTotal = 0;

  for (const { zipCode, entries } of zipSightings) {
    const groupsForZip = new Map<string, MutableMetadataGroup>();
    const brnsForZip = new Set<string>();
    let zipRawPages = 0;

    for (const sighting of entries) {
      const detailPageCount = detailPages.get(sighting.brn);
      if (detailPageCount === undefined) {
        throw new Error(`Missing detail page count for BRN ${sighting.brn}`);
      }

      const key = metadataKey(sighting, detailPageCount);
      let globalGroup = globalGroups.get(key);
      if (!globalGroup) {
        globalGroup = createGroup(sighting, detailPageCount);
        globalGroups.set(key, globalGroup);
      }
      let localGroup = groupsForZip.get(key);
      if (!localGroup) {
        localGroup = createGroup(sighting, detailPageCount);
        groupsForZip.set(key, localGroup);
      }

      for (const group of [globalGroup, localGroup]) {
        group.brns.add(sighting.brn);
        group.availableZipCodes.add(zipCode);
        const pairKey = JSON.stringify([sighting.brn, zipCode]);
        if (!group.seenBrnZipPairs.has(pairKey)) {
          group.seenBrnZipPairs.add(pairKey);
          group.sightingCount++;
        }
      }

      let availableZipCodes = brnZipCodes.get(sighting.brn);
      if (!availableZipCodes) {
        availableZipCodes = new Set();
        brnZipCodes.set(sighting.brn, availableZipCodes);
      }
      availableZipCodes.add(zipCode);
      brnPageCounts.set(sighting.brn, detailPageCount);
      brnsForZip.add(sighting.brn);
      zipRawPages += detailPageCount;
      rawPageTotal += detailPageCount;
      rawSightings++;
    }

    localGroups.set(zipCode, groupsForZip);
    localBrns.set(zipCode, brnsForZip);
    localTotals.set(zipCode, { rawSightings: entries.length, rawPages: zipRawPages });
  }

  const groups = [...globalGroups.values()].map(serializeGroup).sort(compareGroups);
  const uniqueBrns = brnZipCodes.size;
  const globalCandidateGroups = groups.length;
  let localWouldDownloadBrns = 0;
  let localCandidateGroups = 0;
  let localRepeatedSightings = 0;
  let localWouldDownloadPages = 0;
  let localMetadataCandidates = 0;

  const byZipCode = [...localBrns.keys()]
    .sort(compareStrings)
    .map((zipCode) => {
      const brns = localBrns.get(zipCode);
      const groupsForZip = localGroups.get(zipCode);
      const totals = localTotals.get(zipCode);
      if (!brns || !groupsForZip || !totals) {
        throw new Error(`Missing listing totals for ZIP ${zipCode}`);
      }

      const candidateGroupCount = groupsForZip.size;
      const wouldDownloadPages = [...brns].reduce((sum, brn) => {
        const pageCount = brnPageCounts.get(brn);
        if (pageCount === undefined) {
          throw new Error(`Missing detail page count for BRN ${brn}`);
        }
        return sum + pageCount;
      }, 0);
      const metadataCandidates = [...groupsForZip.values()].reduce(
        (sum, group) => sum + group.detailPageCount,
        0,
      );
      const repeated = totals.rawSightings - brns.size;

      localWouldDownloadBrns += brns.size;
      localCandidateGroups += candidateGroupCount;
      localRepeatedSightings += repeated;
      localWouldDownloadPages += wouldDownloadPages;
      localMetadataCandidates += metadataCandidates;

      return {
        zipCode,
        rawSightings: totals.rawSightings,
        uniqueBrns: brns.size,
        wouldDownloadBrns: brns.size,
        skippedBrns: 0,
        metadataCandidateGroups: candidateGroupCount,
        possibleBrnSavings: possibleSavings(brns.size, candidateGroupCount),
        repeatedSightings: repeated,
        pageTotals: {
          rawSightings: totals.rawPages,
          wouldDownload: wouldDownloadPages,
          metadataCandidates,
        },
      };
    });

  const globalWouldDownloadPages = [...brnPageCounts.values()].reduce(
    (sum, pageCount) => sum + pageCount,
    0,
  );
  const globalMetadataCandidates = groups.reduce(
    (sum, group) => sum + group.detailPageCount,
    0,
  );

  return {
    version: 1,
    scope: 'metadata-only' as const,
    identity: {
      confirmed: false,
      metadataGroupsAreDownloadCandidates: true,
      metadataGroupsMaySkipDownloads: false,
    },
    totals: {
      rawSightings,
      uniqueBrns,
      metadataGroups: globalCandidateGroups,
    },
    downloads: {
      global: {
        wouldDownloadBrns: uniqueBrns,
        skippedBrns: 0,
        metadataCandidateGroups: globalCandidateGroups,
        possibleBrnSavings: possibleSavings(uniqueBrns, globalCandidateGroups),
        repeatedSightings: rawSightings - uniqueBrns,
      },
      local: {
        wouldDownloadBrns: localWouldDownloadBrns,
        skippedBrns: 0,
        metadataCandidateGroups: localCandidateGroups,
        possibleBrnSavings: possibleSavings(localWouldDownloadBrns, localCandidateGroups),
        repeatedSightings: localRepeatedSightings,
      },
    },
    pageTotals: {
      rawSightings: rawPageTotal,
      globalWouldDownload: globalWouldDownloadPages,
      localWouldDownload: localWouldDownloadPages,
      globalMetadataCandidates,
      localMetadataCandidates,
    },
    availabilityByBrn: [...brnZipCodes.entries()]
      .sort(([left], [right]) => compareStrings(left, right))
      .map(([brn, zipCodes]) => ({ brn, zipCodes: [...zipCodes].sort(compareStrings) })),
    groups,
    byZipCode,
  };
}

export function parseListingDedupReportArguments(
  args: readonly string[],
): ListingDedupReportArguments {
  const result = { ...DEFAULT_ARGUMENTS };
  const flags: Record<string, keyof ListingDedupReportArguments> = {
    '--input': 'inputPath',
    '--details': 'detailPagesPath',
    '--output': 'outputPath',
  };

  for (let index = 0; index < args.length; index++) {
    const argument = args[index];
    if (!argument) continue;

    const equalsIndex = argument.indexOf('=');
    const flag = equalsIndex < 0 ? argument : argument.slice(0, equalsIndex);
    const field = flags[flag];
    if (!field) throw new Error(`Unknown argument: ${argument}`);

    const value = equalsIndex < 0 ? args[++index] : argument.slice(equalsIndex + 1);
    if (!value || value.startsWith('--')) {
      throw new Error(`Expected a path after ${flag}`);
    }
    result[field] = value;
  }

  return result;
}

async function main(): Promise<void> {
  const args = parseListingDedupReportArguments(process.argv.slice(2));
  const fullScan = JSON.parse(await readFile(args.inputPath, 'utf8')) as unknown;
  const detailPages = JSON.parse(await readFile(args.detailPagesPath, 'utf8')) as unknown;
  const report = buildListingDedupReport(fullScan, detailPages);

  await mkdir(dirname(args.outputPath), { recursive: true });
  const temporaryPath = `${args.outputPath}.${process.pid}.tmp`;
  await writeFile(temporaryPath, JSON.stringify(report, null, 2), 'utf8');
  await rename(temporaryPath, args.outputPath);

  console.log(`BRNs: ${report.totals.uniqueBrns} | Gruppen: ${report.totals.metadataGroups} | Report: ${args.outputPath}`);
}

if (process.argv[1]?.endsWith('listing-dedup-report.ts')) {
  main().catch((error: unknown) => {
    console.error(`Fehler: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  });
}
