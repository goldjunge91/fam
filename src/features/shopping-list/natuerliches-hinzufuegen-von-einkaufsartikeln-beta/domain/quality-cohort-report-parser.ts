import type { QualityMetricKey } from '@/features/shopping-list/natuerliches-hinzufuegen-von-einkaufsartikeln-beta/domain/quality-evaluator';
import {
  type BetaMetricSnapshot,
  type BetaQualityMetricSnapshots,
  getBetaQualityMetricSnapshots,
} from '@/features/shopping-list/natuerliches-hinzufuegen-von-einkaufsartikeln-beta/domain/quality-metrics';
import type { SanitizedQualityPayload } from '@/features/shopping-list/natuerliches-hinzufuegen-von-einkaufsartikeln-beta/domain/quality-snapshot';
import type { BetaQualityMetrics } from '@/features/shopping-list/natuerliches-hinzufuegen-von-einkaufsartikeln-beta/types';

const MAX_DURATION_SAMPLES_PER_SNAPSHOT = 64;
const SNAPSHOT_KEYS = [
  'schemaVersion',
  'snapshotVersion',
  'metricDefinitionVersion',
  'captureKind',
  'fixtureSetVersion',
  'experimentVariant',
  'createdAt',
  'confirmedItemCount',
  'automaticAssignmentCount',
  'correctAutomaticAssignmentCount',
  'falseListAssignmentCount',
  'manualCorrectionCount',
  'durationSamplesMs',
  'qualityFlags',
  'metrics',
] as const;
const QUALITY_FLAG_KEYS = [
  'unparsedTextPresent',
  'ambiguousItemBoundary',
  'semanticItemMismatch',
  'incorrectAutomaticAssignment',
  'manualCorrection',
] as const;
export const METRIC_KEYS: readonly QualityMetricKey[] = [
  'automaticAccuracyPercent',
  'falseListPercent',
  'manualCorrectionPercent',
  'medianTimeToAddMs',
];
const METRIC_SNAPSHOT_KEYS = ['value', 'numerator', 'denominator', 'sampleCount'] as const;

type UnknownRecord = Record<string, unknown>;
export type QualityFlagKey = (typeof QUALITY_FLAG_KEYS)[number];

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function invalid(location: string, message: string): never {
  throw new Error(`${location}: ${message}`);
}

function readRecord(value: unknown, location: string): UnknownRecord {
  if (!isRecord(value)) invalid(location, 'erwartet ein JSON-Objekt');
  return value;
}

function assertExactKeys(
  record: UnknownRecord,
  expectedKeys: readonly string[],
  location: string,
): void {
  const expected = new Set(expectedKeys);
  for (const key of Object.keys(record)) {
    if (!expected.has(key)) invalid(location, `unbekanntes Feld "${key}"`);
  }
  for (const key of expectedKeys) {
    if (!(key in record)) invalid(location, `fehlendes Feld "${key}"`);
  }
}

function readNonNegativeInteger(record: UnknownRecord, key: string, location: string): number {
  const value = record[key];
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
    invalid(`${location}.${key}`, 'erwartet eine nicht-negative ganze Zahl');
  }
  return value;
}

function readNonNegativeFiniteNumber(value: unknown, location: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    invalid(location, 'erwartet eine endliche nicht-negative Zahl');
  }
  return value;
}

function readNullableNonNegativeFiniteNumber(
  record: UnknownRecord,
  key: string,
  location: string,
): number | null {
  const value = record[key];
  if (value === null) return null;
  return readNonNegativeFiniteNumber(value, `${location}.${key}`);
}

function readNullableNonNegativeInteger(
  record: UnknownRecord,
  key: string,
  location: string,
): number | null {
  const value = record[key];
  if (value === null) return null;
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
    invalid(`${location}.${key}`, 'erwartet null oder eine nicht-negative ganze Zahl');
  }
  return value;
}

function readString(record: UnknownRecord, key: string, location: string): string {
  const value = record[key];
  if (typeof value !== 'string') invalid(`${location}.${key}`, 'erwartet eine Zeichenkette');
  return value;
}

function readNullableString(record: UnknownRecord, key: string, location: string): string | null {
  const value = record[key];
  if (value === null) return null;
  if (typeof value !== 'string')
    invalid(`${location}.${key}`, 'erwartet null oder eine Zeichenkette');
  return value;
}

function readMetricSnapshot(value: unknown, location: string): BetaMetricSnapshot {
  const record = readRecord(value, location);
  assertExactKeys(record, METRIC_SNAPSHOT_KEYS, location);
  return {
    value: readNullableNonNegativeFiniteNumber(record, 'value', location),
    numerator: readNullableNonNegativeInteger(record, 'numerator', location),
    denominator: readNullableNonNegativeInteger(record, 'denominator', location),
    sampleCount: readNonNegativeInteger(record, 'sampleCount', location),
  };
}

function metricSnapshotsEqual(left: BetaMetricSnapshot, right: BetaMetricSnapshot): boolean {
  return (
    left.value === right.value &&
    left.numerator === right.numerator &&
    left.denominator === right.denominator &&
    left.sampleCount === right.sampleCount
  );
}

function parseQualityFlags(
  value: unknown,
  location: string,
): SanitizedQualityPayload['qualityFlags'] {
  const record = readRecord(value, location);
  assertExactKeys(record, QUALITY_FLAG_KEYS, location);
  return {
    unparsedTextPresent: readNonNegativeInteger(record, 'unparsedTextPresent', location),
    ambiguousItemBoundary: readNonNegativeInteger(record, 'ambiguousItemBoundary', location),
    semanticItemMismatch: readNonNegativeInteger(record, 'semanticItemMismatch', location),
    incorrectAutomaticAssignment: readNonNegativeInteger(
      record,
      'incorrectAutomaticAssignment',
      location,
    ),
    manualCorrection: readNonNegativeInteger(record, 'manualCorrection', location),
  };
}

function parseMetrics(value: unknown, location: string): BetaQualityMetricSnapshots {
  const record = readRecord(value, location);
  assertExactKeys(record, METRIC_KEYS, location);
  return {
    automaticAccuracyPercent: readMetricSnapshot(
      record.automaticAccuracyPercent,
      `${location}.automaticAccuracyPercent`,
    ),
    falseListPercent: readMetricSnapshot(record.falseListPercent, `${location}.falseListPercent`),
    manualCorrectionPercent: readMetricSnapshot(
      record.manualCorrectionPercent,
      `${location}.manualCorrectionPercent`,
    ),
    medianTimeToAddMs: readMetricSnapshot(
      record.medianTimeToAddMs,
      `${location}.medianTimeToAddMs`,
    ),
  };
}

function parseSnapshot(value: unknown, location: string): SanitizedQualityPayload {
  const record = readRecord(value, location);
  assertExactKeys(record, SNAPSHOT_KEYS, location);

  if (record.schemaVersion !== 2) invalid(`${location}.schemaVersion`, 'muss 2 sein');
  if (record.snapshotVersion !== 1) invalid(`${location}.snapshotVersion`, 'muss 1 sein');
  if (record.metricDefinitionVersion !== 1) {
    invalid(`${location}.metricDefinitionVersion`, 'muss 1 sein');
  }
  const captureKind = record.captureKind;
  if (captureKind !== 'quality-snapshot' && captureKind !== 'maestro-preview-test') {
    invalid(`${location}.captureKind`, 'unbekannter Capture-Typ');
  }
  const experimentVariant = record.experimentVariant;
  if (experimentVariant !== 'baseline' && experimentVariant !== 'contextual-strings') {
    invalid(`${location}.experimentVariant`, 'unbekannte Experiment-Variante');
  }

  const fixtureSetVersion = readNullableString(record, 'fixtureSetVersion', location);
  const createdAt = readString(record, 'createdAt', location);
  const createdAtMillis = Date.parse(createdAt);
  if (!Number.isFinite(createdAtMillis) || new Date(createdAtMillis).toISOString() !== createdAt) {
    invalid(`${location}.createdAt`, 'erwartet einen kanonischen ISO-Zeitstempel');
  }

  const durationValue = record.durationSamplesMs;
  if (!Array.isArray(durationValue)) invalid(`${location}.durationSamplesMs`, 'erwartet ein Array');
  if (durationValue.length > MAX_DURATION_SAMPLES_PER_SNAPSHOT) {
    invalid(
      `${location}.durationSamplesMs`,
      `darf höchstens ${MAX_DURATION_SAMPLES_PER_SNAPSHOT} Werte enthalten`,
    );
  }
  const durationSamplesMs = durationValue.map((entry, index) =>
    readNonNegativeFiniteNumber(entry, `${location}.durationSamplesMs[${index}]`),
  );
  const qualityFlags = parseQualityFlags(record.qualityFlags, `${location}.qualityFlags`);
  const metrics = parseMetrics(record.metrics, `${location}.metrics`);

  const confirmedItemCount = readNonNegativeInteger(record, 'confirmedItemCount', location);
  const automaticAssignmentCount = readNonNegativeInteger(
    record,
    'automaticAssignmentCount',
    location,
  );
  const correctAutomaticAssignmentCount = readNonNegativeInteger(
    record,
    'correctAutomaticAssignmentCount',
    location,
  );
  const falseListAssignmentCount = readNonNegativeInteger(
    record,
    'falseListAssignmentCount',
    location,
  );
  const manualCorrectionCount = readNonNegativeInteger(record, 'manualCorrectionCount', location);

  if (correctAutomaticAssignmentCount > automaticAssignmentCount) {
    invalid(
      `${location}.correctAutomaticAssignmentCount`,
      'darf automatische Zuordnungen nicht überschreiten',
    );
  }
  if (falseListAssignmentCount > automaticAssignmentCount) {
    invalid(
      `${location}.falseListAssignmentCount`,
      'darf automatische Zuordnungen nicht überschreiten',
    );
  }
  if (automaticAssignmentCount > confirmedItemCount) {
    invalid(`${location}.automaticAssignmentCount`, 'darf bestätigte Artikel nicht überschreiten');
  }
  if (correctAutomaticAssignmentCount + falseListAssignmentCount !== automaticAssignmentCount) {
    invalid(
      `${location}.correctAutomaticAssignmentCount`,
      'korrekte und falsche automatische Zuordnungen müssen automatische Zuordnungen vollständig beschreiben',
    );
  }
  if (manualCorrectionCount > confirmedItemCount) {
    invalid(`${location}.manualCorrectionCount`, 'darf bestätigte Artikel nicht überschreiten');
  }

  const parsed: SanitizedQualityPayload = {
    schemaVersion: 2,
    snapshotVersion: 1,
    metricDefinitionVersion: 1,
    captureKind,
    fixtureSetVersion,
    experimentVariant,
    createdAt,
    confirmedItemCount,
    automaticAssignmentCount,
    correctAutomaticAssignmentCount,
    falseListAssignmentCount,
    manualCorrectionCount,
    durationSamplesMs,
    qualityFlags,
    metrics,
  };

  const sourceMetrics: BetaQualityMetrics = {
    confirmedItemCount,
    automaticAssignmentCount,
    correctAutomaticAssignmentCount,
    falseListAssignmentCount,
    manualCorrectionCount,
    qualityFlagCounts: {
      unparsed_text_present: qualityFlags.unparsedTextPresent,
      ambiguous_item_boundary: qualityFlags.ambiguousItemBoundary,
      semantic_item_mismatch: qualityFlags.semanticItemMismatch,
      incorrect_automatic_assignment: qualityFlags.incorrectAutomaticAssignment,
      manual_correction: qualityFlags.manualCorrection,
    },
    completionDurationsMs: durationSamplesMs,
    recordedObservationIds: [],
    measuredSessionIds: [],
  };
  const expectedMetrics = getBetaQualityMetricSnapshots(sourceMetrics);
  for (const key of METRIC_KEYS) {
    if (!metricSnapshotsEqual(metrics[key], expectedMetrics[key])) {
      invalid(`${location}.metrics.${key}`, 'ist mit den Aggregaten inkonsistent');
    }
  }

  return parsed;
}

function parseJsonl(content: string): SanitizedQualityPayload[] {
  const snapshots: SanitizedQualityPayload[] = [];
  for (const [index, line] of content.split(/\r?\n/u).entries()) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    let parsed: unknown;
    try {
      parsed = JSON.parse(trimmed) as unknown;
    } catch {
      invalid(`JSONL Zeile ${index + 1}`, 'enthält kein gültiges JSON');
    }
    snapshots.push(parseSnapshot(parsed, `JSONL Zeile ${index + 1}`));
  }
  return snapshots;
}

/** Accepts a single copied JSON object, a JSON array or newline-delimited JSON. */
export function parseQualitySnapshotInput(content: string): SanitizedQualityPayload[] {
  const trimmed = content.trim();
  if (!trimmed) return [];

  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (Array.isArray(parsed)) {
      return parsed.map((entry, index) => parseSnapshot(entry, `JSON-Array[${index}]`));
    }
    return [parseSnapshot(parsed, 'JSON')];
  } catch (error) {
    if (error instanceof SyntaxError) return parseJsonl(trimmed);
    throw error;
  }
}
