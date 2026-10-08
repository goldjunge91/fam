#!/usr/bin/env bun

import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

type BrochureSighting = {
  brn: string;
  storeName: string;
  validFrom: string;
  validUntil: string;
};

type FullScan = {
  byZipCode: Record<string, BrochureSighting[]>;
};

export type CanonicalGroup = {
  storeName: string;
  validFrom: string;
  validUntil: string;
  detailPageCount: number;
  brns: string[];
  availableZipCodes: string[];
  sightingCount: number;
};

export type CanonicalGrouping = {
  naiveSightingCount: number;
  groupedSightingCount: number;
  groups: CanonicalGroup[];
};

export type GroupCanonicalArguments = {
  inputPath: string;
  detailPagesPath: string;
  outputPath: string;
};

type MutableCanonicalGroup = {
  storeName: string;
  validFrom: string;
  validUntil: string;
  detailPageCount: number;
  brns: Set<string>;
  availableZipCodes: Set<string>;
  sightingCount: number;
};

const DEFAULT_ARGUMENTS: GroupCanonicalArguments = {
  inputPath: 'tools/crawler/data/listing-only/all-stores-full.json',
  detailPagesPath: 'tools/crawler/data/listing-only/detail-pages.json',
  outputPath: 'tools/crawler/data/listing-only/canonical-groups.json',
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

function parseFullScan(value: unknown): FullScan {
  if (!isRecord(value) || !isRecord(value.byZipCode)) {
    throw new Error('Full scan must contain a byZipCode object');
  }

  const byZipCode: FullScan['byZipCode'] = {};
  for (const [zipCode, entries] of Object.entries(value.byZipCode)) {
    if (!Array.isArray(entries)) {
      throw new Error(`Offers for ZIP ${zipCode} must be an array`);
    }

    byZipCode[zipCode] = entries.map((entry, index) => {
      if (!isRecord(entry)) {
        throw new Error(`Offer ${index + 1} for ZIP ${zipCode} must be an object`);
      }

      return {
        brn: requiredString(entry.brn, `BRN for ZIP ${zipCode}`),
        storeName: requiredString(entry.storeName, `Store name for ZIP ${zipCode}`),
        validFrom: requiredString(entry.validFrom, `validFrom for ZIP ${zipCode}`),
        validUntil: requiredString(entry.validUntil, `validUntil for ZIP ${zipCode}`),
      };
    });
  }

  return { byZipCode };
}

function parseDetailPages(value: unknown): Record<string, number> {
  if (!isRecord(value)) {
    throw new Error('Detail page counts must be an object keyed by BRN');
  }

  const detailPages: Record<string, number> = {};
  for (const [brn, pageCount] of Object.entries(value)) {
    if (!Number.isInteger(pageCount) || typeof pageCount !== 'number' || pageCount < 1) {
      throw new Error(`Detail page count for BRN ${brn} must be a positive integer`);
    }
    detailPages[brn] = pageCount;
  }

  return detailPages;
}

function compareStrings(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function compareGroups(left: CanonicalGroup, right: CanonicalGroup): number {
  return (
    compareStrings(left.storeName, right.storeName) ||
    compareStrings(left.validFrom, right.validFrom) ||
    compareStrings(left.validUntil, right.validUntil) ||
    left.detailPageCount - right.detailPageCount
  );
}

export function groupCanonicalBrochures(
  fullScanValue: unknown,
  detailPagesValue: unknown,
): CanonicalGrouping {
  const fullScan = parseFullScan(fullScanValue);
  const detailPages = parseDetailPages(detailPagesValue);
  const grouped = new Map<string, MutableCanonicalGroup>();
  let naiveSightingCount = 0;

  for (const [zipCode, entries] of Object.entries(fullScan.byZipCode)) {
    for (const entry of entries) {
      if (!Object.hasOwn(detailPages, entry.brn)) {
        throw new Error(`Missing detail page count for BRN ${entry.brn}`);
      }

      const detailPageCount = detailPages[entry.brn];
      if (detailPageCount === undefined) {
        throw new Error(`Missing detail page count for BRN ${entry.brn}`);
      }

      const groupKey = JSON.stringify([
        entry.storeName,
        entry.validFrom,
        entry.validUntil,
        detailPageCount,
      ]);
      let group = grouped.get(groupKey);
      if (!group) {
        group = {
          storeName: entry.storeName,
          validFrom: entry.validFrom,
          validUntil: entry.validUntil,
          detailPageCount,
          brns: new Set(),
          availableZipCodes: new Set(),
          sightingCount: 0,
        };
        grouped.set(groupKey, group);
      }

      group.brns.add(entry.brn);
      group.availableZipCodes.add(zipCode);
      group.sightingCount++;
      naiveSightingCount++;
    }
  }

  const groups = Array.from(
    grouped.values(),
    (group): CanonicalGroup => ({
      storeName: group.storeName,
      validFrom: group.validFrom,
      validUntil: group.validUntil,
      detailPageCount: group.detailPageCount,
      brns: Array.from(group.brns).sort(compareStrings),
      availableZipCodes: Array.from(group.availableZipCodes).sort(compareStrings),
      sightingCount: group.sightingCount,
    }),
  ).sort(compareGroups);

  const groupedSightingCount = groups.reduce((sum, group) => sum + group.sightingCount, 0);
  if (groupedSightingCount !== naiveSightingCount) {
    throw new Error('Grouped sighting count does not match the full scan');
  }

  return { naiveSightingCount, groupedSightingCount, groups };
}

export function parseGroupCanonicalArguments(args: readonly string[]): GroupCanonicalArguments {
  const result = { ...DEFAULT_ARGUMENTS };
  const flags: Record<string, keyof GroupCanonicalArguments> = {
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
  const args = parseGroupCanonicalArguments(process.argv.slice(2));
  const fullScan = JSON.parse(await readFile(args.inputPath, 'utf8')) as unknown;
  const detailPages = JSON.parse(await readFile(args.detailPagesPath, 'utf8')) as unknown;
  const grouping = groupCanonicalBrochures(fullScan, detailPages);
  const output = { generatedAt: new Date().toISOString(), ...grouping };

  await mkdir(dirname(args.outputPath), { recursive: true });
  const temporaryPath = `${args.outputPath}.${process.pid}.tmp`;
  await writeFile(temporaryPath, JSON.stringify(output, null, 2), 'utf8');
  await rename(temporaryPath, args.outputPath);

  console.log(
    `Gruppen: ${grouping.groups.length} | Sichtungen: ${grouping.naiveSightingCount} | Report: ${args.outputPath}`,
  );
}

if (process.argv[1]?.endsWith('group-canonical.ts')) {
  main().catch((error: unknown) => {
    console.error(`Fehler: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  });
}
