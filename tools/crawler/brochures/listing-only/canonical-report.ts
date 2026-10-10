#!/usr/bin/env bun

import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { buildPersistedCanonicalBrochures } from './persist-canonical';
import type { PersistedCanonicalBrochure } from './persist-canonical';

type CanonicalReportInput = {
  fullScan: unknown;
  verification: unknown;
  persistedBrochures: unknown;
};

type ReportGroup = {
  storeName: string;
  validFrom: string;
  validUntil: string;
  detailPageCount: number;
  brns: string[];
  availableZipCodes: string[];
  sightingCount: number;
  variants: {
    canonicalBrn: string;
    brns: string[];
    availableZipCodes: string[];
  }[];
};

export type CanonicalReport = {
  naive: number;
  canonical: number;
  metadata_groups: number;
  savings_percent: number;
  by_store: Record<string, { naive: number; canonical: number; metadata_groups: number }>;
};

export type CanonicalReportArguments = {
  inputPath: string;
  verificationPath: string;
  persistedPath: string;
  outputPath: string;
};

const DEFAULT_ARGUMENTS: CanonicalReportArguments = {
  inputPath: 'tools/crawler/data/listing-only/all-stores-full.json',
  verificationPath: 'tools/crawler/data/listing-only/canonical-page-verification.json',
  persistedPath: 'tools/crawler/data/listing-only/canonical-brochures.json',
  outputPath: 'tools/crawler/data/listing-only/canonical-report.json',
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

function nonNegativeInteger(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${field} must be a non-negative safe integer`);
  }
  return value;
}

function stringList(value: unknown, field: string): string[] {
  if (!Array.isArray(value)) throw new Error(`${field} must be an array`);
  const strings = value.map((entry) => requiredString(entry, field));
  if (new Set(strings).size !== strings.length) {
    throw new Error(`${field} must not contain duplicates`);
  }
  return strings;
}

function sameStringSet(left: string[], right: string[]): boolean {
  if (left.length !== right.length) return false;
  const sortedLeft = [...left].sort();
  const sortedRight = [...right].sort();
  return sortedLeft.every((value, index) => value === sortedRight[index]);
}

function groupIdentity(group: Pick<ReportGroup, 'storeName' | 'validFrom' | 'validUntil' | 'detailPageCount'>): string {
  return JSON.stringify([group.storeName, group.validFrom, group.validUntil, group.detailPageCount]);
}

function parseVerificationGroups(value: unknown): {
  groups: ReportGroup[];
  brochures: PersistedCanonicalBrochure[];
} {
  if (!isRecord(value) || value.version !== 1 || !Array.isArray(value.groups)) {
    throw new Error('Full-page verification must contain version 1 and a groups array');
  }

  const brochures = buildPersistedCanonicalBrochures(value);
  const brochureByBrn = new Map(brochures.map((brochure) => [brochure.canonicalBrn, brochure]));
  const groups: ReportGroup[] = value.groups.map((entry, groupIndex) => {
    if (!isRecord(entry) || !Array.isArray(entry.variants)) {
      throw new Error(`Verification group ${groupIndex + 1} must contain a variants array`);
    }
    const group: ReportGroup = {
      storeName: requiredString(entry.storeName, `Verification group ${groupIndex + 1} storeName`),
      validFrom: requiredString(entry.validFrom, `Verification group ${groupIndex + 1} validFrom`),
      validUntil: requiredString(entry.validUntil, `Verification group ${groupIndex + 1} validUntil`),
      detailPageCount: positiveInteger(
        entry.detailPageCount,
        `Verification group ${groupIndex + 1} detailPageCount`,
      ),
      brns: stringList(entry.brns, `Verification group ${groupIndex + 1} BRNs`),
      availableZipCodes: stringList(
        entry.availableZipCodes,
        `Verification group ${groupIndex + 1} ZIP codes`,
      ),
      sightingCount: positiveInteger(
        entry.sightingCount,
        `Verification group ${groupIndex + 1} sightingCount`,
      ),
      variants: entry.variants.map((variant, variantIndex) => {
        if (!isRecord(variant)) {
          throw new Error(`Verification variant ${groupIndex + 1}.${variantIndex + 1} must be an object`);
        }
        const canonicalBrn = requiredString(
          variant.canonicalBrn,
          `Verification variant ${groupIndex + 1}.${variantIndex + 1} canonicalBrn`,
        );
        const brns = stringList(
          variant.brns,
          `Verification variant ${groupIndex + 1}.${variantIndex + 1} BRNs`,
        );
        if (brns.length === 0 || !brns.includes(canonicalBrn)) {
          throw new Error(`Verification variant ${canonicalBrn} has no canonical BRN membership`);
        }
        const availableZipCodes = stringList(
          variant.availableZipCodes,
          `Verification variant ${groupIndex + 1}.${variantIndex + 1} ZIP codes`,
        );
        const brochure = brochureByBrn.get(canonicalBrn);
        if (!brochure || !sameStringSet(brochure.availableZipCodes, availableZipCodes)) {
          throw new Error(`Verification variant ${canonicalBrn} disagrees with its complete page data`);
        }
        return { canonicalBrn, brns, availableZipCodes };
      }),
    };
    return group;
  });

  const groupIdentities = groups.map(groupIdentity);
  if (new Set(groupIdentities).size !== groupIdentities.length) {
    throw new Error('Full-page verification contains duplicate metadata groups');
  }

  const listedBrns = groups.flatMap((group) => group.brns);
  if (new Set(listedBrns).size !== listedBrns.length) {
    throw new Error('Full-page verification contains a BRN in more than one metadata group');
  }

  const summary = value.summary;
  if (!isRecord(summary)) throw new Error('Full-page verification must contain a summary');
  const variantCount = groups.reduce((count, group) => count + group.variants.length, 0);
  if (
    nonNegativeInteger(summary.metadataGroupCount, 'Verification metadataGroupCount') !== groups.length ||
    nonNegativeInteger(summary.uniqueBrnCount, 'Verification uniqueBrnCount') !== listedBrns.length ||
    nonNegativeInteger(summary.canonicalBrochureCount, 'Verification canonicalBrochureCount') !== variantCount ||
    variantCount !== brochures.length
  ) {
    throw new Error('Full-page verification summary counts do not match its groups and variants');
  }

  return { groups, brochures };
}

function parsePersistedBrochures(value: unknown): PersistedCanonicalBrochure[] {
  if (!isRecord(value) || !Array.isArray(value.brochures)) {
    throw new Error('Persisted brochure input must contain a brochures array');
  }

  const groups = value.brochures.map((entry, index) => {
    if (!isRecord(entry)) throw new Error(`Persisted brochure ${index + 1} must be an object`);
    const pageCount = positiveInteger(entry.pageCount, `Persisted brochure ${index + 1} pageCount`);
    const coverImage = requiredString(entry.coverImage, `Persisted brochure ${index + 1} coverImage`);
    if (!Array.isArray(entry.pages) || !isRecord(entry.pages[0]) || entry.pages[0].imageUrl !== coverImage) {
      throw new Error(`Persisted brochure ${index + 1} cover image does not match page 1`);
    }
    return {
      storeName: entry.storeName,
      validFrom: entry.validFrom,
      validUntil: entry.validUntil,
      detailPageCount: pageCount,
      variants: [
        {
          canonicalBrn: entry.canonicalBrn,
          title: entry.title,
          storeId: entry.storeId,
          pageUrls: entry.pageUrls,
          pages: entry.pages,
          pageHashes: entry.verifiedPageHashes,
          pageCount,
          availableZipCodes: entry.availableZipCodes,
          brochureSha256: entry.verifiedSha256,
        },
      ],
    };
  });
  return buildPersistedCanonicalBrochures({
    version: 1,
    // Scope was already enforced on the source verification above. The
    // persisted file stores only brochure rows, so its full-scan proof comes
    // from matching every row against that verified source report.
    scope: { mode: 'all-brns', complete: true },
    groups,
  });
}

function comparableBrochure(brochure: PersistedCanonicalBrochure) {
  return {
    ...brochure,
    availableZipCodes: [...brochure.availableZipCodes].sort(),
  };
}

function ensurePersistedVariantsMatch(
  expected: PersistedCanonicalBrochure[],
  persisted: PersistedCanonicalBrochure[],
): void {
  const expectedByBrn = new Map(expected.map((brochure) => [brochure.canonicalBrn, brochure]));
  const persistedByBrn = new Map(persisted.map((brochure) => [brochure.canonicalBrn, brochure]));
  if (expectedByBrn.size !== expected.length || persistedByBrn.size !== persisted.length) {
    throw new Error('Canonical variant BRNs must be unique');
  }
  if (
    expectedByBrn.size !== persistedByBrn.size ||
    [...expectedByBrn].some(([brn, brochure]) => {
      const persistedBrochure = persistedByBrn.get(brn);
      return !persistedBrochure || !isDeepStrictEqual(
        comparableBrochure(brochure),
        comparableBrochure(persistedBrochure),
      );
    })
  ) {
    throw new Error('Persisted full-brochure variants do not match verification variants');
  }
}

function parseFullScan(value: unknown): {
  totalSightings: number;
  naiveByStore: Map<string, number>;
  sightings: { brn: string; storeName: string; validFrom: string; validUntil: string; zipCode: string }[];
} {
  if (!isRecord(value) || !isRecord(value.byZipCode)) {
    throw new Error('Full scan must contain a byZipCode object');
  }
  const naiveByStore = new Map<string, number>();
  const sightings: {
    brn: string;
    storeName: string;
    validFrom: string;
    validUntil: string;
    zipCode: string;
  }[] = [];
  let totalSightings = 0;

  for (const [zipCode, offers] of Object.entries(value.byZipCode)) {
    if (!Array.isArray(offers)) throw new Error(`Offers for ZIP ${zipCode} must be an array`);
    for (const offer of offers) {
      if (!isRecord(offer)) throw new Error(`Offer for ZIP ${zipCode} must be an object`);
      const brn = requiredString(offer.brn, `BRN for ZIP ${zipCode}`);
      const storeName = requiredString(offer.storeName, `Store name for ZIP ${zipCode}`);
      const validFrom = requiredString(offer.validFrom, `validFrom for ZIP ${zipCode}`);
      const validUntil = requiredString(offer.validUntil, `validUntil for ZIP ${zipCode}`);
      sightings.push({ brn, storeName, validFrom, validUntil, zipCode });
      naiveByStore.set(storeName, (naiveByStore.get(storeName) ?? 0) + 1);
      totalSightings++;
    }
  }

  return { totalSightings, naiveByStore, sightings };
}

function verifyFullScanCoverage(
  groups: ReportGroup[],
  scan: ReturnType<typeof parseFullScan>,
): void {
  const groupBySighting = new Map<string, string>();
  for (const group of groups) {
    const groupKey = groupIdentity(group);
    if (group.brns.length === 0) throw new Error(`Verification group ${group.storeName} has no BRNs`);
    for (const brn of group.brns) {
      const sightingKey = JSON.stringify([brn, group.storeName, group.validFrom, group.validUntil]);
      if (groupBySighting.has(sightingKey)) {
        throw new Error(`Verification BRN ${brn} appears in more than one group`);
      }
      groupBySighting.set(sightingKey, groupKey);
    }
  }

  const sightingsByGroup = new Map<string, { count: number; zipCodes: Set<string> }>();
  const zipCodesByBrn = new Map<string, Set<string>>();
  for (const sighting of scan.sightings) {
    const sightingKey = JSON.stringify([
      sighting.brn,
      sighting.storeName,
      sighting.validFrom,
      sighting.validUntil,
    ]);
    const groupKey = groupBySighting.get(sightingKey);
    if (!groupKey) {
      throw new Error(`Full-scan BRN ${sighting.brn} is missing from full-page verification`);
    }
    const groupSightings = sightingsByGroup.get(groupKey) ?? {
      count: 0,
      zipCodes: new Set<string>(),
    };
    groupSightings.count++;
    groupSightings.zipCodes.add(sighting.zipCode);
    sightingsByGroup.set(groupKey, groupSightings);

    const brnZipCodes = zipCodesByBrn.get(sighting.brn) ?? new Set<string>();
    brnZipCodes.add(sighting.zipCode);
    zipCodesByBrn.set(sighting.brn, brnZipCodes);
  }

  for (const group of groups) {
    const groupKey = groupIdentity(group);
    const actual = sightingsByGroup.get(groupKey);
    if (
      !actual || actual.count !== group.sightingCount ||
      !sameStringSet([...actual.zipCodes], group.availableZipCodes)
    ) {
      throw new Error(`Verification group ${group.storeName} does not match full-scan ZIP coverage`);
    }
    for (const brn of group.brns) {
      if (!zipCodesByBrn.has(brn)) throw new Error(`Verification BRN ${brn} has no full-scan sightings`);
    }

    const seenVariantBrns = new Set<string>();
    for (const variant of group.variants) {
      const expectedZips = new Set<string>();
      for (const brn of variant.brns) {
        if (!group.brns.includes(brn) || seenVariantBrns.has(brn)) {
          throw new Error(`Verification variants do not partition BRNs for ${group.storeName}`);
        }
        seenVariantBrns.add(brn);
        for (const zipCode of zipCodesByBrn.get(brn) ?? []) expectedZips.add(zipCode);
      }
      if (!sameStringSet([...expectedZips], variant.availableZipCodes)) {
        throw new Error(`Verification variant ${variant.canonicalBrn} ZIP availability does not match full scan`);
      }
    }
    if (seenVariantBrns.size !== group.brns.length) {
      throw new Error(`Verification variants do not cover every BRN for ${group.storeName}`);
    }
  }
}

function buildStoreReport(
  naiveByStore: Map<string, number>,
  brochures: PersistedCanonicalBrochure[],
  groups: ReportGroup[],
): CanonicalReport['by_store'] {
  const canonicalByStore = new Map<string, number>();
  const metadataGroupsByStore = new Map<string, number>();
  const storeForBrn = new Map<string, string>();
  for (const group of groups) {
    for (const variant of group.variants) storeForBrn.set(variant.canonicalBrn, group.storeName);
    metadataGroupsByStore.set(group.storeName, (metadataGroupsByStore.get(group.storeName) ?? 0) + 1);
  }
  for (const brochure of brochures) {
    const storeName = storeForBrn.get(brochure.canonicalBrn);
    if (!storeName) throw new Error(`No metadata group for variant ${brochure.canonicalBrn}`);
    canonicalByStore.set(storeName, (canonicalByStore.get(storeName) ?? 0) + 1);
  }

  const stores = new Set([...naiveByStore.keys(), ...canonicalByStore.keys(), ...metadataGroupsByStore.keys()]);
  return Object.fromEntries(
    [...stores].sort().map((storeName) => [
      storeName,
      {
        naive: naiveByStore.get(storeName) ?? 0,
        canonical: canonicalByStore.get(storeName) ?? 0,
        metadata_groups: metadataGroupsByStore.get(storeName) ?? 0,
      },
    ]),
  );
}

export function buildCanonicalReport(input: CanonicalReportInput): CanonicalReport {
  const verification = parseVerificationGroups(input.verification);
  const scan = parseFullScan(input.fullScan);
  verifyFullScanCoverage(verification.groups, scan);
  const persisted = parsePersistedBrochures(input.persistedBrochures);
  ensurePersistedVariantsMatch(verification.brochures, persisted);

  const naive = scan.totalSightings;
  const canonical = verification.brochures.length;
  const metadataGroups = verification.groups.length;
  return {
    naive,
    canonical,
    metadata_groups: metadataGroups,
    savings_percent: naive === 0 ? 0 : Math.round(((naive - canonical) / naive) * 10_000) / 100,
    by_store: buildStoreReport(scan.naiveByStore, verification.brochures, verification.groups),
  };
}

export function parseCanonicalReportArguments(args: readonly string[]): CanonicalReportArguments {
  const result = { ...DEFAULT_ARGUMENTS };
  const flags: Record<string, keyof CanonicalReportArguments> = {
    '--input': 'inputPath',
    '--verification': 'verificationPath',
    '--persisted': 'persistedPath',
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
  const args = parseCanonicalReportArguments(process.argv.slice(2));
  const [fullScan, verification, persistedBrochures] = await Promise.all([
    readFile(args.inputPath, 'utf8').then((contents) => JSON.parse(contents) as unknown),
    readFile(args.verificationPath, 'utf8').then((contents) => JSON.parse(contents) as unknown),
    readFile(args.persistedPath, 'utf8').then((contents) => JSON.parse(contents) as unknown),
  ]);
  const report = buildCanonicalReport({ fullScan, verification, persistedBrochures });
  const output = { generatedAt: new Date().toISOString(), ...report };

  await mkdir(dirname(args.outputPath), { recursive: true });
  const temporaryPath = `${args.outputPath}.${process.pid}.tmp`;
  await writeFile(temporaryPath, JSON.stringify(output, null, 2), 'utf8');
  await rename(temporaryPath, args.outputPath);
  console.log(
    `Sichtungen: ${report.naive} | Vollprospekte: ${report.canonical} | Metadaten-Gruppen: ${report.metadata_groups} | Ersparnis: ${report.savings_percent}% | Report: ${args.outputPath}`,
  );
}

if (process.argv[1]?.endsWith('canonical-report.ts')) {
  main().catch((error: unknown) => {
    console.error(`Fehler: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  });
}
