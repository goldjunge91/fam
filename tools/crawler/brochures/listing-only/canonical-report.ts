#!/usr/bin/env bun

import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { PersistedCanonicalBrochure } from './persist-canonical';

export type CanonicalReport = {
  naive: number;
  canonical: number;
  metadata_groups: number;
  savings_percent: number;
  by_store: Record<string, { naive: number; canonical: number; metadata_groups: number }>;
};

export type CanonicalReportArguments = {
  inputPath: string;
  persistedPath: string;
  outputPath: string;
};

const DEFAULT_ARGUMENTS: CanonicalReportArguments = {
  inputPath: 'tools/crawler/data/listing-only/all-stores-full.json',
  persistedPath: 'tools/crawler/data/listing-only/canonical-brochures.json',
  outputPath: 'tools/crawler/data/listing-only/canonical-report.json',
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requiredString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.length === 0) throw new Error(`${field} must be a non-empty string`);
  return value;
}

function positiveInteger(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 1) {
    throw new Error(`${field} must be a positive safe integer`);
  }
  return value;
}

function regionalKey(zipCode: string, brn: string): string {
  return `${zipCode}:${encodeURIComponent(brn)}`;
}

function parseFullScan(value: unknown) {
  if (!isRecord(value) || !isRecord(value.byZipCode)) throw new Error('Full scan must contain a byZipCode object');
  const sightings: Array<{ zipCode: string; brn: string; storeName: string; title: string; validFrom: string; validUntil: string }> = [];
  for (const [zipCode, entries] of Object.entries(value.byZipCode)) {
    if (!/^\d{5}$/.test(zipCode) || !Array.isArray(entries)) throw new Error(`Invalid full-scan ZIP ${zipCode}`);
    for (const [index, entry] of entries.entries()) {
      if (!isRecord(entry)) throw new Error(`Offer ${index + 1} for ZIP ${zipCode} must be an object`);
      sightings.push({
        zipCode,
        brn: requiredString(entry.brn, `BRN for ZIP ${zipCode}`),
        storeName: requiredString(entry.storeName, `Store name for ZIP ${zipCode}`),
        title: requiredString(entry.title, `Title for ZIP ${zipCode}`),
        validFrom: requiredString(entry.validFrom, `validFrom for ZIP ${zipCode}`),
        validUntil: requiredString(entry.validUntil, `validUntil for ZIP ${zipCode}`),
      });
    }
  }
  return sightings;
}

function parsePersisted(value: unknown): PersistedCanonicalBrochure[] {
  if (!isRecord(value) || !Array.isArray(value.brochures)) {
    throw new Error('Persisted brochure input must contain a brochures array');
  }
  return value.brochures.map((entry, index) => {
    if (!isRecord(entry)) throw new Error(`Persisted brochure ${index + 1} must be an object`);
    const sourceZipCode = requiredString(entry.sourceZipCode, `Persisted brochure ${index + 1} sourceZipCode`);
    const canonicalBrn = requiredString(entry.canonicalBrn, `Persisted brochure ${index + 1} canonicalBrn`);
    const availableZipCodes = entry.availableZipCodes;
    if (!Array.isArray(availableZipCodes) || availableZipCodes.length !== 1 || availableZipCodes[0] !== sourceZipCode) {
      throw new Error(`Persisted brochure ${canonicalBrn} has fabricated or ambiguous ZIP availability`);
    }
    const pageCount = positiveInteger(entry.pageCount, `Persisted brochure ${index + 1} pageCount`);
    if (!Array.isArray(entry.pages) || entry.pages.length !== pageCount) {
      throw new Error(`Persisted brochure ${canonicalBrn} has incomplete pages`);
    }
    return entry as unknown as PersistedCanonicalBrochure;
  });
}

export function buildCanonicalReport(input: {
  fullScan: unknown;
  persistedBrochures: unknown;
}): CanonicalReport {
  const sightings = parseFullScan(input.fullScan);
  const brochures = parsePersisted(input.persistedBrochures);
  const byReference = new Map<string, PersistedCanonicalBrochure>();
  for (const brochure of brochures) {
    const key = regionalKey(brochure.sourceZipCode, brochure.canonicalBrn);
    if (byReference.has(key)) throw new Error(`Regional brochure ${key} appears more than once`);
    byReference.set(key, brochure);
  }

  const naiveByStore = new Map<string, number>();
  const metadataGroupsByStore = new Map<string, Set<string>>();
  const seenReferences = new Set<string>();
  for (const sighting of sightings) {
    const key = regionalKey(sighting.zipCode, sighting.brn);
    const brochure = byReference.get(key);
    if (!brochure) throw new Error(`Persisted catalog is missing regional reference ${key}`);
    if (
      brochure.storeName !== sighting.storeName ||
      brochure.title !== sighting.title ||
      brochure.validFrom !== sighting.validFrom ||
      brochure.validUntil !== sighting.validUntil
    ) throw new Error(`Persisted catalog metadata disagrees with full scan for ${key}`);
    naiveByStore.set(sighting.storeName, (naiveByStore.get(sighting.storeName) ?? 0) + 1);
    seenReferences.add(key);
  }
  for (const key of byReference.keys()) {
    if (!seenReferences.has(key)) throw new Error(`Persisted catalog contains unavailable regional reference ${key}`);
  }

  const canonicalByStore = new Map<string, number>();
  for (const brochure of brochures) {
    canonicalByStore.set(brochure.storeName, (canonicalByStore.get(brochure.storeName) ?? 0) + 1);
    const groupKey = JSON.stringify([brochure.storeName, brochure.validFrom, brochure.validUntil, brochure.pageCount]);
    const groups = metadataGroupsByStore.get(brochure.storeName) ?? new Set<string>();
    groups.add(groupKey);
    metadataGroupsByStore.set(brochure.storeName, groups);
  }

  const stores = new Set([...naiveByStore.keys(), ...canonicalByStore.keys()]);
  const by_store = Object.fromEntries(
    [...stores].sort().map((storeName) => [storeName, {
      naive: naiveByStore.get(storeName) ?? 0,
      canonical: canonicalByStore.get(storeName) ?? 0,
      metadata_groups: metadataGroupsByStore.get(storeName)?.size ?? 0,
    }]),
  );
  const naive = sightings.length;
  const canonical = brochures.length;
  return {
    naive,
    canonical,
    metadata_groups: [...metadataGroupsByStore.values()].reduce((sum, groups) => sum + groups.size, 0),
    savings_percent: naive === 0 ? 0 : Math.round(((naive - canonical) / naive) * 10_000) / 100,
    by_store,
  };
}

export function parseCanonicalReportArguments(args: readonly string[]): CanonicalReportArguments {
  const result = { ...DEFAULT_ARGUMENTS };
  const flags: Record<string, keyof CanonicalReportArguments> = {
    '--input': 'inputPath',
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
  const [fullScan, persistedBrochures] = await Promise.all([
    readFile(args.inputPath, 'utf8').then((contents) => JSON.parse(contents) as unknown),
    readFile(args.persistedPath, 'utf8').then((contents) => JSON.parse(contents) as unknown),
  ]);
  const report = buildCanonicalReport({ fullScan, persistedBrochures });
  const output = { generatedAt: new Date().toISOString(), ...report };
  await mkdir(dirname(args.outputPath), { recursive: true });
  const temporaryPath = `${args.outputPath}.${process.pid}.tmp`;
  await writeFile(temporaryPath, JSON.stringify(output, null, 2), 'utf8');
  await rename(temporaryPath, args.outputPath);
  console.log(`Sichtungen: ${report.naive} | Regionale Ausgaben: ${report.canonical} | Metadaten-Gruppen: ${report.metadata_groups} | Ersparnis: ${report.savings_percent}% | Report: ${args.outputPath}`);
}

if (process.argv[1]?.endsWith('canonical-report.ts')) {
  main().catch((error: unknown) => {
    console.error(`Fehler: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  });
}
