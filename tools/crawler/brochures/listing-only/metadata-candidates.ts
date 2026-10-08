import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import type { CanonicalGroup } from './group-canonical';

const SHA256_PATTERN = /^[a-f0-9]{64}$/;
const HASH_PILOT_GROUP_LIMIT = 32;
const HASH_PILOT_STORES = new Set(['Kaufland', 'REWE', 'XXXLutz']);

export type MetadataCandidateIndexEntry = {
  storeName: string;
  validFrom: string;
  validUntil: string;
  detailPageCount: number;
  page1Sha256: string;
};

export type MetadataCandidateIndex = {
  version: 1;
  byBrn: Record<string, MetadataCandidateIndexEntry>;
};

export type Page1HashesByBrn = Readonly<Record<string, string>>;

export type MetadataCandidateArguments = {
  groupsPath: string;
  page1VerificationPath: string;
  previousIndexPath: string;
  indexOutputPath: string;
  reportOutputPath: string;
};

export type PreviousCandidateClassification =
  | 'exact-match'
  | 'validity-extension'
  | 'validity-change'
  | 'page1-change'
  | 'metadata-change'
  | 'metadata-and-page1-change';

export type PreviousRunCandidate = {
  brn: string;
  classification: PreviousCandidateClassification;
  matchFamilyMatches: boolean;
  page1Matches: boolean;
  candidateOnly: true;
};

export type MetadataCandidateGroup = CanonicalGroup & {
  page1HashBuckets: Array<{ page1Sha256: string; brns: string[] }>;
  fullVectorCandidateBrns: string[];
  pageOneDistinctUnverifiedBrns: string[];
};

export type HashPilotGroup = {
  storeName: string;
  validFrom: string;
  validUntil: string;
  detailPageCount: number;
  sightingCount: number;
  representativeBrn: string;
  representativePage1Sha256: string;
  fullVectorCandidateBrns: string[];
  fullVectorPageCount: number;
};

export type HashPilotSelection = {
  groupLimit: number;
  selectedGroupCount: number;
  representativeBrnCount: number;
  representativePageCount: number;
  fullVectorCandidateBrnCount: number;
  fullVectorCandidatePageCount: number;
  groups: HashPilotGroup[];
};

export type MetadataCandidateReport = {
  version: 1;
  identity: { confirmed: false };
  skippedFullPageDownloads: 0;
  fullVectorCandidateBrns: string[];
  pageOneDistinctUnverifiedBrns: string[];
  pilotSelection: HashPilotSelection;
  previousRun: {
    indexAvailable: boolean;
    candidates: PreviousRunCandidate[];
  };
  groups: MetadataCandidateGroup[];
};

type ParsedCurrentGroup = {
  storeName: string;
  validFrom: string;
  validUntil: string;
  detailPageCount: number;
  brns: string[];
  availableZipCodes: string[];
  sightingCount: number;
};

const DEFAULT_ARGUMENTS: MetadataCandidateArguments = {
  groupsPath: 'tools/crawler/data/listing-only/canonical-groups.json',
  page1VerificationPath: 'tools/crawler/data/listing-only/canonical-verification.json',
  previousIndexPath: 'tools/crawler/data/listing-only/metadata-candidate-index.json',
  indexOutputPath: 'tools/crawler/data/listing-only/metadata-candidate-index.json',
  reportOutputPath: 'tools/crawler/data/listing-only/metadata-candidate-report.json',
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function exactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const actual = Object.keys(value).sort(compareStrings);
  const expected = [...keys].sort(compareStrings);
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

function requiredString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`${field} must be a non-empty string`);
  }
  return value;
}

function validateHash(value: unknown, field: string): string {
  if (typeof value !== 'string' || !SHA256_PATTERN.test(value)) {
    throw new Error(`${field} must be a lowercase SHA-256 hex digest`);
  }
  return value;
}

function compareStrings(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function compareGroups(left: ParsedCurrentGroup, right: ParsedCurrentGroup): number {
  return (
    compareStrings(left.storeName, right.storeName) ||
    compareStrings(left.validFrom, right.validFrom) ||
    compareStrings(left.validUntil, right.validUntil) ||
    left.detailPageCount - right.detailPageCount
  );
}

function parseCurrentGroups(value: readonly CanonicalGroup[]): ParsedCurrentGroup[] {
  if (!Array.isArray(value)) throw new Error('Current canonical groups must be an array');

  const groups = value.map((group, index): ParsedCurrentGroup => {
    if (!isRecord(group)) throw new Error(`Current group ${index + 1} must be an object`);
    if (
      typeof group.detailPageCount !== 'number' ||
      !Number.isSafeInteger(group.detailPageCount) ||
      group.detailPageCount < 1
    ) {
      throw new Error(`Detail page count for current group ${index + 1} must be a positive integer`);
    }
    if (!Array.isArray(group.brns) || group.brns.length === 0) {
      throw new Error(`BRNs for current group ${index + 1} must be a non-empty array`);
    }
    if (
      !Array.isArray(group.availableZipCodes) ||
      !Number.isSafeInteger(group.sightingCount) ||
      (group.sightingCount as number) < 1
    ) {
      throw new Error(`Current group ${index + 1} has invalid availability data`);
    }

    const brns = group.brns.map((brn) => requiredString(brn, `BRN for current group ${index + 1}`));
    if (new Set(brns).size !== brns.length) {
      throw new Error(`Current group ${index + 1} contains duplicate BRNs`);
    }

    return {
      storeName: requiredString(group.storeName, `Store name for current group ${index + 1}`),
      validFrom: requiredString(group.validFrom, `validFrom for current group ${index + 1}`),
      validUntil: requiredString(group.validUntil, `validUntil for current group ${index + 1}`),
      detailPageCount: group.detailPageCount,
      brns: brns.sort(compareStrings),
      availableZipCodes: group.availableZipCodes.map((zipCode) =>
        requiredString(zipCode, `ZIP code for current group ${index + 1}`),
      ).sort(compareStrings),
      sightingCount: group.sightingCount as number,
    };
  });

  return groups.sort(compareGroups);
}

function parsePage1Hashes(value: Page1HashesByBrn): Map<string, string> {
  if (!isRecord(value)) throw new Error('Page-1 hashes must be an object keyed by BRN');

  const hashes = new Map<string, string>();
  for (const [brn, hash] of Object.entries(value)) {
    requiredString(brn, 'BRN for page-1 hash');
    hashes.set(brn, validateHash(hash, `Page-1 hash for BRN ${brn}`));
  }
  return hashes;
}

export function parsePage1HashesFromVerification(value: unknown): Page1HashesByBrn {
  if (!isRecord(value) || !isRecord(value.byBrn)) {
    throw new Error('Page-1 verification must contain a byBrn object');
  }

  const hashes: Record<string, string> = {};
  for (const [brn, entry] of Object.entries(value.byBrn)) {
    if (!isRecord(entry)) throw new Error(`Page-1 verification for BRN ${brn} must be an object`);
    hashes[brn] = validateHash(entry.sha256, `Page-1 SHA-256 for BRN ${brn}`);
  }
  return hashes;
}

function requirePage1Hash(hashes: ReadonlyMap<string, string>, brn: string): string {
  const hash = hashes.get(brn);
  if (hash === undefined) throw new Error(`Missing page-1 SHA-256 for BRN ${brn}`);
  return hash;
}

function metadataFamilyMatches(
  current: ParsedCurrentGroup,
  previous: MetadataCandidateIndexEntry,
): boolean {
  return (
    current.storeName === previous.storeName &&
    current.validFrom === previous.validFrom &&
    current.detailPageCount === previous.detailPageCount
  );
}

function classifyPreviousCandidate(
  brn: string,
  current: ParsedCurrentGroup,
  currentPage1Sha256: string,
  previous: MetadataCandidateIndexEntry,
): PreviousRunCandidate {
  const matchFamilyMatches = metadataFamilyMatches(current, previous);
  const page1Matches = currentPage1Sha256 === previous.page1Sha256;
  let classification: PreviousCandidateClassification;

  if (!matchFamilyMatches && !page1Matches) {
    classification = 'metadata-and-page1-change';
  } else if (!matchFamilyMatches) {
    classification = 'metadata-change';
  } else if (!page1Matches) {
    classification = 'page1-change';
  } else if (current.validUntil === previous.validUntil) {
    classification = 'exact-match';
  } else if (current.validUntil > previous.validUntil) {
    classification = 'validity-extension';
  } else {
    classification = 'validity-change';
  }

  return { brn, classification, matchFamilyMatches, page1Matches, candidateOnly: true };
}

export function parseMetadataCandidateIndex(value: unknown): MetadataCandidateIndex {
  if (!isRecord(value) || !exactKeys(value, ['version', 'byBrn']) || value.version !== 1) {
    throw new Error('Metadata candidate index must have version 1 and a byBrn object');
  }
  if (!isRecord(value.byBrn)) {
    throw new Error('Metadata candidate index byBrn must be an object');
  }

  const entries = Object.entries(value.byBrn).map(([brn, entry]) => {
    requiredString(brn, 'BRN in metadata candidate index');
    if (
      !isRecord(entry) ||
      !exactKeys(entry, ['storeName', 'validFrom', 'validUntil', 'detailPageCount', 'page1Sha256'])
    ) {
      throw new Error(`Metadata candidate index entry for BRN ${brn} has an invalid shape`);
    }

    if (
      typeof entry.detailPageCount !== 'number' ||
      !Number.isSafeInteger(entry.detailPageCount) ||
      entry.detailPageCount < 1
    ) {
      throw new Error(`Detail page count for indexed BRN ${brn} must be a positive integer`);
    }

    const parsed: MetadataCandidateIndexEntry = {
      storeName: requiredString(entry.storeName, `Store name for indexed BRN ${brn}`),
      validFrom: requiredString(entry.validFrom, `validFrom for indexed BRN ${brn}`),
      validUntil: requiredString(entry.validUntil, `validUntil for indexed BRN ${brn}`),
      detailPageCount: entry.detailPageCount,
      page1Sha256: validateHash(entry.page1Sha256, `Page-1 hash for indexed BRN ${brn}`),
    };
    return [brn, parsed] as const;
  });

  entries.sort(([left], [right]) => compareStrings(left, right));
  return { version: 1, byBrn: Object.fromEntries(entries) };
}

export function parseMetadataCandidateArguments(
  args: readonly string[],
): MetadataCandidateArguments {
  const result = { ...DEFAULT_ARGUMENTS };
  const flags: Record<string, keyof MetadataCandidateArguments> = {
    '--groups': 'groupsPath',
    '--verification': 'page1VerificationPath',
    '--previous-index': 'previousIndexPath',
    '--index-output': 'indexOutputPath',
    '--report-output': 'reportOutputPath',
  };

  for (let index = 0; index < args.length; index++) {
    const argument = args[index];
    if (!argument) continue;

    const equalsIndex = argument.indexOf('=');
    const flag = equalsIndex < 0 ? argument : argument.slice(0, equalsIndex);
    const field = flags[flag];
    if (!field) throw new Error(`Unknown argument: ${argument}`);

    const value = equalsIndex < 0 ? args[++index] : argument.slice(equalsIndex + 1);
    if (!value || value.startsWith('--')) throw new Error(`Expected a path after ${flag}`);
    result[field] = value;
  }

  if (resolve(result.indexOutputPath) === resolve(result.reportOutputPath)) {
    throw new Error('Index and report output paths must be different');
  }
  if (
    resolve(result.groupsPath) === resolve(result.indexOutputPath) ||
    resolve(result.groupsPath) === resolve(result.reportOutputPath) ||
    resolve(result.page1VerificationPath) === resolve(result.indexOutputPath) ||
    resolve(result.page1VerificationPath) === resolve(result.reportOutputPath)
  ) {
    throw new Error('Output paths must not overwrite current run inputs');
  }

  return result;
}

async function readOptionalJson(path: string): Promise<unknown | undefined> {
  try {
    return JSON.parse(await readFile(path, 'utf8')) as unknown;
  } catch (error) {
    if (isRecord(error) && error.code === 'ENOENT') return undefined;
    throw error;
  }
}

async function writeJsonAtomically(path: string, value: unknown): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const temporaryPath = `${path}.${process.pid}.tmp`;
  await writeFile(temporaryPath, JSON.stringify(value, null, 2), 'utf8');
  await rename(temporaryPath, path);
}

export async function runMetadataCandidateReport(
  args: MetadataCandidateArguments,
): Promise<MetadataCandidateReport> {
  const groupsValue = await readOptionalJson(args.groupsPath);
  if (!isRecord(groupsValue) || !Array.isArray(groupsValue.groups)) {
    throw new Error(`Canonical groups input ${args.groupsPath} must contain a groups array`);
  }
  const verification = await readOptionalJson(args.page1VerificationPath);
  if (verification === undefined) {
    throw new Error(`Page-1 verification input not found: ${args.page1VerificationPath}`);
  }

  const groups = groupsValue.groups as CanonicalGroup[];
  const page1Hashes = parsePage1HashesFromVerification(verification);
  const previousIndexValue = await readOptionalJson(args.previousIndexPath);
  const previousIndex = previousIndexValue === undefined
    ? undefined
    : parseMetadataCandidateIndex(previousIndexValue);
  const report = buildMetadataCandidateReport(groups, page1Hashes, previousIndex);
  const index = buildMetadataCandidateIndex(groups, page1Hashes);

  await writeJsonAtomically(args.reportOutputPath, report);
  await writeJsonAtomically(args.indexOutputPath, index);
  return report;
}

async function main(): Promise<void> {
  const args = parseMetadataCandidateArguments(process.argv.slice(2));
  const report = await runMetadataCandidateReport(args);
  const brnCount = report.groups.reduce((sum, group) => sum + group.brns.length, 0);
  console.log(
    `Groups: ${report.groups.length} | BRNs: ${brnCount} | Pilot: ${report.pilotSelection.selectedGroupCount} groups / ${report.pilotSelection.fullVectorCandidateBrnCount} BRNs / ${report.pilotSelection.fullVectorCandidatePageCount} pages | Report: ${args.reportOutputPath}`,
  );
}

if (process.argv[1]?.endsWith('metadata-candidates.ts')) {
  main().catch((error: unknown) => {
    console.error(`Fehler: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  });
}

export function buildMetadataCandidateIndex(
  currentGroups: readonly CanonicalGroup[],
  currentPage1HashesByBrn: Page1HashesByBrn,
): MetadataCandidateIndex {
  const groups = parseCurrentGroups(currentGroups);
  const hashes = parsePage1Hashes(currentPage1HashesByBrn);
  const byBrn = new Map<string, MetadataCandidateIndexEntry>();

  for (const group of groups) {
    for (const brn of group.brns) {
      const entry: MetadataCandidateIndexEntry = {
        storeName: group.storeName,
        validFrom: group.validFrom,
        validUntil: group.validUntil,
        detailPageCount: group.detailPageCount,
        page1Sha256: requirePage1Hash(hashes, brn),
      };
      const existing = byBrn.get(brn);
      if (existing && JSON.stringify(existing) !== JSON.stringify(entry)) {
        throw new Error(`BRN ${brn} appears in multiple current metadata groups`);
      }
      byBrn.set(brn, entry);
    }
  }

  const sortedEntries = [...byBrn.entries()].sort(([left], [right]) => compareStrings(left, right));
  return { version: 1, byBrn: Object.fromEntries(sortedEntries) };
}

export function buildMetadataCandidateReport(
  currentGroups: readonly CanonicalGroup[],
  currentPage1HashesByBrn: Page1HashesByBrn,
  previousIndex?: MetadataCandidateIndex,
): MetadataCandidateReport {
  const groups = parseCurrentGroups(currentGroups);
  const hashes = parsePage1Hashes(currentPage1HashesByBrn);
  const normalizedPrevious = previousIndex === undefined
    ? undefined
    : parseMetadataCandidateIndex(previousIndex);
  const fullVectorCandidateBrns = new Set<string>();
  const pageOneDistinctUnverifiedBrns = new Set<string>();
  const previousCandidates = new Map<string, PreviousRunCandidate>();

  const reportGroups = groups.map((group): MetadataCandidateGroup => {
    const buckets = new Map<string, string[]>();
    for (const brn of group.brns) {
      const currentHash = requirePage1Hash(hashes, brn);
      const bucket = buckets.get(currentHash) ?? [];
      bucket.push(brn);
      buckets.set(currentHash, bucket);

      const prior = normalizedPrevious?.byBrn[brn];
      if (prior) {
        previousCandidates.set(
          brn,
          classifyPreviousCandidate(brn, group, currentHash, prior),
        );
      }
    }

    const page1HashBuckets = [...buckets.entries()]
      .sort(([left], [right]) => compareStrings(left, right))
      .map(([page1Sha256, brns]) => ({
        page1Sha256,
        brns: brns.sort(compareStrings),
      }));
    const groupFullVectorBrns: string[] = [];
    const groupDistinctBrns: string[] = [];

    for (const bucket of page1HashBuckets) {
      if (bucket.brns.length > 1) {
        groupFullVectorBrns.push(...bucket.brns);
      } else {
        groupDistinctBrns.push(...bucket.brns);
      }
    }
    groupFullVectorBrns.sort(compareStrings);
    groupDistinctBrns.sort(compareStrings);
    for (const brn of groupFullVectorBrns) fullVectorCandidateBrns.add(brn);
    for (const brn of groupDistinctBrns) pageOneDistinctUnverifiedBrns.add(brn);

    return {
      ...group,
      page1HashBuckets,
      fullVectorCandidateBrns: groupFullVectorBrns,
      pageOneDistinctUnverifiedBrns: groupDistinctBrns,
    };
  });

  const pilotGroups = reportGroups
    .filter((group) => HASH_PILOT_STORES.has(group.storeName))
    .sort((left, right) => right.sightingCount - left.sightingCount || compareGroups(left, right))
    .slice(0, HASH_PILOT_GROUP_LIMIT)
    .map((group): HashPilotGroup => {
      const representativeBrn = group.brns[0];
      if (!representativeBrn) {
        throw new Error(`Pilot group ${group.storeName} has no representative BRN`);
      }
      const representativePage1Sha256 = requirePage1Hash(hashes, representativeBrn);
      const matchingBucket = group.page1HashBuckets.find(
        (bucket) => bucket.page1Sha256 === representativePage1Sha256,
      );
      if (!matchingBucket) {
        throw new Error(`Pilot group ${group.storeName} has no representative page-1 bucket`);
      }
      const fullVectorCandidateBrns = [...matchingBucket.brns];

      return {
        storeName: group.storeName,
        validFrom: group.validFrom,
        validUntil: group.validUntil,
        detailPageCount: group.detailPageCount,
        sightingCount: group.sightingCount,
        representativeBrn,
        representativePage1Sha256,
        fullVectorCandidateBrns,
        fullVectorPageCount: fullVectorCandidateBrns.length * group.detailPageCount,
      };
    });
  const representativePageCount = pilotGroups.reduce(
    (sum, group) => sum + group.detailPageCount,
    0,
  );
  const fullVectorCandidateBrnCount = pilotGroups.reduce(
    (sum, group) => sum + group.fullVectorCandidateBrns.length,
    0,
  );
  const fullVectorCandidatePageCount = pilotGroups.reduce(
    (sum, group) => sum + group.fullVectorPageCount,
    0,
  );

  return {
    version: 1,
    identity: { confirmed: false },
    skippedFullPageDownloads: 0,
    fullVectorCandidateBrns: [...fullVectorCandidateBrns].sort(compareStrings),
    pageOneDistinctUnverifiedBrns: [...pageOneDistinctUnverifiedBrns].sort(compareStrings),
    pilotSelection: {
      groupLimit: HASH_PILOT_GROUP_LIMIT,
      selectedGroupCount: pilotGroups.length,
      representativeBrnCount: pilotGroups.length,
      representativePageCount,
      fullVectorCandidateBrnCount,
      fullVectorCandidatePageCount,
      groups: pilotGroups,
    },
    previousRun: {
      indexAvailable: normalizedPrevious !== undefined,
      candidates: [...previousCandidates.values()].sort((left, right) =>
        compareStrings(left.brn, right.brn),
      ),
    },
    groups: reportGroups,
  };
}
