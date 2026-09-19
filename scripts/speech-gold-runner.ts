import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { loadSpeechGoldLabels } from '../.maestro/scripts/speech-gold-labels';
import {
  aggregateSpeechGoldComparisons,
  compareSpeechGoldLabel,
  type SpeechGoldAggregate,
  type SpeechGoldComparison,
} from '../src/features/shopping-list/natuerliches-hinzufuegen-von-einkaufsartikeln-beta/domain/speech-gold-comparison';
import type { SpeechGoldLabel } from '../src/features/shopping-list/natuerliches-hinzufuegen-von-einkaufsartikeln-beta/domain/speech-gold-contract';
import type { ParsedShoppingItem } from '../src/features/shopping-list/natuerliches-hinzufuegen-von-einkaufsartikeln-beta/types';

export type SpeechGoldDiagnosticResult = Readonly<{
  items: readonly ParsedShoppingItem[];
  unparsedText: string | null;
}>;

export type SpeechGoldDiagnosticAdapter = Readonly<{
  getDiagnostic: (label: SpeechGoldLabel) => Promise<SpeechGoldDiagnosticResult>;
}>;

export type SpeechGoldRunStatus = 'running' | 'completed' | 'failed';

export type SpeechGoldRunManifest = Readonly<{
  schemaVersion: 1;
  status: SpeechGoldRunStatus;
  plannedAudioIds: readonly string[];
  lastCompletedAudio: string | null;
  counts: Readonly<{
    planned: number;
    completed: number;
    exactMatch: number;
  }>;
  createdAt: string;
  updatedAt: string;
}>;

export type SpeechGoldRunResult = Readonly<{
  manifest: SpeechGoldRunManifest;
  comparisons: readonly SpeechGoldComparison[];
  summary: SpeechGoldAggregate;
}>;

export type SpeechGoldRunOptions = Readonly<{
  goldLabelsPath: string;
  outputDirectory: string;
  plannedAudioIds: readonly string[];
  adapter: SpeechGoldDiagnosticAdapter;
  resume?: boolean;
  now?: () => Date;
}>;

type UnknownRecord = Record<string, unknown>;

const SPEECH_GOLD_MISMATCH_FIELDS = ['quantity', 'unit', 'brand'] as const;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isPositiveFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

function isOptionalText(value: unknown): value is string | null {
  return value === null || isNonEmptyString(value);
}

function isGoldItem(value: unknown): boolean {
  if (!isRecord(value)) return false;
  return (
    isNonEmptyString(value.name) &&
    isPositiveFiniteNumber(value.quantity) &&
    isOptionalText(value.unit) &&
    isOptionalText(value.brand)
  );
}

function isParsedItem(value: unknown): boolean {
  return isGoldItem(value);
}

function isMismatchedItem(value: unknown): boolean {
  if (!isRecord(value) || !isGoldItem(value.expected) || !isParsedItem(value.actual)) {
    return false;
  }
  if (!Array.isArray(value.fields) || value.fields.length === 0) return false;
  const fields = value.fields;
  return (
    fields.every((field) =>
      SPEECH_GOLD_MISMATCH_FIELDS.includes(field as (typeof SPEECH_GOLD_MISMATCH_FIELDS)[number]),
    ) && new Set(fields).size === fields.length
  );
}

function nowIso(now: () => Date): string {
  const date = now();
  if (!(date instanceof Date) || !Number.isFinite(date.getTime())) {
    throw new Error('now muss ein gültiges Datum liefern');
  }
  return date.toISOString();
}

function validatePlannedAudioIds(
  audioIds: readonly string[],
  labels: readonly SpeechGoldLabel[],
): void {
  if (audioIds.length === 0) throw new Error('plannedAudioIds darf nicht leer sein');
  const uniqueAudioIds = new Set(audioIds);
  if (uniqueAudioIds.size !== audioIds.length) {
    throw new Error('plannedAudioIds darf keine Duplikate enthalten');
  }

  const knownAudioIds = new Set(labels.map((label) => label.audio));
  const unknownAudioIds = audioIds.filter((audio) => !knownAudioIds.has(audio));
  if (unknownAudioIds.length > 0) {
    throw new Error(`Unbekannte Goldlabel-Audios: ${unknownAudioIds.join(', ')}`);
  }
}

function manifestPath(outputDirectory: string): string {
  return path.join(outputDirectory, 'manifest.json');
}

function comparisonsPath(outputDirectory: string): string {
  return path.join(outputDirectory, 'comparisons.jsonl');
}

function summaryPath(outputDirectory: string): string {
  return path.join(outputDirectory, 'summary.json');
}

async function readTextIfPresent(filePath: string): Promise<string | null> {
  try {
    return await readFile(filePath, 'utf8');
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return null;
    throw error;
  }
}

async function atomicWrite(filePath: string, content: string): Promise<void> {
  const temporaryPath = `${filePath}.tmp`;
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(temporaryPath, content, 'utf8');
  await rename(temporaryPath, filePath);
}

function isSpeechGoldComparison(value: unknown): value is SpeechGoldComparison {
  if (!isRecord(value)) return false;
  const missing = Array.isArray(value.missing) ? value.missing : null;
  const unexpected = Array.isArray(value.unexpected) ? value.unexpected : null;
  const mismatched = Array.isArray(value.mismatched) ? value.mismatched : null;
  if (
    missing === null ||
    unexpected === null ||
    mismatched === null ||
    !missing.every(isGoldItem) ||
    !unexpected.every(isParsedItem) ||
    !mismatched.every(isMismatchedItem)
  ) {
    return false;
  }

  const expectedItemCount = value.expectedItemCount;
  const actualItemCount = value.actualItemCount;
  const nameMatchedItemCount = value.nameMatchedItemCount;
  const matchedItemCount = value.matchedItemCount;

  return (
    value.schemaVersion === 1 &&
    value.comparisonKind === 'speech-gold-label' &&
    isNonEmptyString(value.audio) &&
    isNonNegativeInteger(value.referenceLine) &&
    value.referenceLine > 0 &&
    isNonNegativeInteger(expectedItemCount) &&
    isNonNegativeInteger(actualItemCount) &&
    isNonNegativeInteger(nameMatchedItemCount) &&
    isNonNegativeInteger(matchedItemCount) &&
    isOptionalText(value.expectedUnparsedText) &&
    isOptionalText(value.actualUnparsedText) &&
    typeof value.unparsedTextMatch === 'boolean' &&
    typeof value.exactMatch === 'boolean' &&
    nameMatchedItemCount + missing.length === expectedItemCount &&
    nameMatchedItemCount + unexpected.length === actualItemCount &&
    matchedItemCount + mismatched.length === nameMatchedItemCount &&
    matchedItemCount <= nameMatchedItemCount &&
    value.exactMatch ===
      (missing.length === 0 &&
        unexpected.length === 0 &&
        mismatched.length === 0 &&
        value.unparsedTextMatch)
  );
}

function parseStoredComparisons(
  content: string,
  plannedAudioIds: readonly string[],
): SpeechGoldComparison[] {
  const lines = content
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter(Boolean);
  const comparisons: SpeechGoldComparison[] = [];

  for (const [index, line] of lines.entries()) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(line) as unknown;
    } catch {
      throw new Error(`comparisons.jsonl enthält in Zeile ${index + 1} kein gültiges JSON`);
    }
    if (!isSpeechGoldComparison(parsed)) {
      throw new Error(
        `comparisons.jsonl enthält in Zeile ${index + 1} keinen vollständigen Vergleich`,
      );
    }
    const expectedAudio = plannedAudioIds[index];
    if (expectedAudio !== parsed.audio) {
      throw new Error(
        `comparisons.jsonl ist nicht fortlaufend: erwartet ${expectedAudio ?? 'kein weiteres Audio'}, erhalten ${parsed.audio}`,
      );
    }
    comparisons.push(parsed);
  }

  if (comparisons.length > plannedAudioIds.length) {
    throw new Error('comparisons.jsonl enthält mehr Ergebnisse als geplante Audios');
  }
  return comparisons;
}

function speechGoldItemKey(item: {
  name: string;
  quantity: number;
  unit: string | null;
  brand: string | null;
}): string {
  return JSON.stringify([item.name, item.quantity, item.unit, item.brand]);
}

function reconstructActualFromComparison(
  label: SpeechGoldLabel,
  comparison: SpeechGoldComparison,
): SpeechGoldDiagnosticResult {
  const missingCounts = new Map<string, number>();
  for (const item of comparison.missing) {
    const key = speechGoldItemKey(item);
    missingCounts.set(key, (missingCounts.get(key) ?? 0) + 1);
  }

  const mismatchedByExpected = new Map<string, ParsedShoppingItem[]>();
  for (const mismatch of comparison.mismatched) {
    const key = speechGoldItemKey(mismatch.expected);
    const actualItems = mismatchedByExpected.get(key) ?? [];
    actualItems.push(mismatch.actual);
    mismatchedByExpected.set(key, actualItems);
  }

  const actualItems: ParsedShoppingItem[] = [];
  for (const expectedItem of label.items) {
    const key = speechGoldItemKey(expectedItem);
    const missingCount = missingCounts.get(key) ?? 0;
    if (missingCount > 0) {
      missingCounts.set(key, missingCount - 1);
      continue;
    }

    const mismatchedItems = mismatchedByExpected.get(key);
    const mismatchedItem = mismatchedItems?.shift();
    actualItems.push(mismatchedItem ?? expectedItem);
  }
  actualItems.push(...comparison.unexpected);

  return { items: actualItems, unparsedText: comparison.actualUnparsedText };
}

function validateStoredComparisons(
  comparisons: readonly SpeechGoldComparison[],
  labels: readonly SpeechGoldLabel[],
): void {
  comparisons.forEach((comparison, index) => {
    const label = labels[index];
    if (!label) throw new Error(`Gespeicherter Vergleich ${index + 1} hat kein Goldlabel.`);
    const recomputed = compareSpeechGoldLabel(
      label,
      reconstructActualFromComparison(label, comparison),
    );
    if (JSON.stringify(recomputed) !== JSON.stringify(comparison)) {
      throw new Error(`Gespeicherter Vergleich für ${comparison.audio} ist nicht konsistent.`);
    }
  });
}

async function readStoredComparisons(
  outputDirectory: string,
  plannedAudioIds: readonly string[],
): Promise<SpeechGoldComparison[]> {
  const content = await readTextIfPresent(comparisonsPath(outputDirectory));
  return content === null ? [] : parseStoredComparisons(content, plannedAudioIds);
}

function createManifest(
  plannedAudioIds: readonly string[],
  comparisons: readonly SpeechGoldComparison[],
  status: SpeechGoldRunStatus,
  createdAt: string,
  updatedAt: string,
): SpeechGoldRunManifest {
  return {
    schemaVersion: 1,
    status,
    plannedAudioIds,
    lastCompletedAudio: comparisons.at(-1)?.audio ?? null,
    counts: {
      planned: plannedAudioIds.length,
      completed: comparisons.length,
      exactMatch: comparisons.filter((comparison) => comparison.exactMatch).length,
    },
    createdAt,
    updatedAt,
  };
}

async function writeManifest(
  manifestFilePath: string,
  manifest: SpeechGoldRunManifest,
): Promise<void> {
  await atomicWrite(manifestFilePath, `${JSON.stringify(manifest, null, 2)}\n`);
}

async function writeComparisons(
  comparisonsFilePath: string,
  comparisons: readonly SpeechGoldComparison[],
): Promise<void> {
  const content =
    comparisons.length > 0
      ? `${comparisons.map((comparison) => JSON.stringify(comparison)).join('\n')}\n`
      : '';
  await atomicWrite(comparisonsFilePath, content);
}

async function writeSummary(summaryFilePath: string, summary: SpeechGoldAggregate): Promise<void> {
  await atomicWrite(summaryFilePath, `${JSON.stringify(summary, null, 2)}\n`);
}

function labelsForPlan(
  labels: readonly SpeechGoldLabel[],
  plannedAudioIds: readonly string[],
): SpeechGoldLabel[] {
  const byAudio = new Map(labels.map((label) => [label.audio, label]));
  return plannedAudioIds.map((audio) => {
    const label = byAudio.get(audio);
    if (!label) throw new Error(`Goldlabel fehlt für ${audio}`);
    return label;
  });
}

/**
 * Runs the gold evaluation through an injected diagnostic adapter.
 * The adapter owns audio/speech execution; this function only owns ordering,
 * comparison, persistence and resume semantics.
 */
export async function runSpeechGoldEvaluation(
  options: SpeechGoldRunOptions,
): Promise<SpeechGoldRunResult> {
  const now = options.now ?? (() => new Date());
  const labels = await loadSpeechGoldLabels(options.goldLabelsPath);
  validatePlannedAudioIds(options.plannedAudioIds, labels);
  const plannedLabels = labelsForPlan(labels, options.plannedAudioIds);

  await mkdir(options.outputDirectory, { recursive: true });
  const manifestFilePath = manifestPath(options.outputDirectory);
  const comparisonsFilePath = comparisonsPath(options.outputDirectory);
  const summaryFilePath = summaryPath(options.outputDirectory);
  const comparisons = options.resume
    ? await readStoredComparisons(options.outputDirectory, options.plannedAudioIds)
    : [];
  if (options.resume) validateStoredComparisons(comparisons, plannedLabels);
  const createdAt = options.resume
    ? (await readTextIfPresent(manifestFilePath))?.trim()
      ? ((JSON.parse(await readFile(manifestFilePath, 'utf8')) as Partial<SpeechGoldRunManifest>)
          .createdAt ?? nowIso(now))
      : nowIso(now)
    : nowIso(now);

  await writeComparisons(comparisonsFilePath, comparisons);
  await writeManifest(
    manifestFilePath,
    createManifest(options.plannedAudioIds, comparisons, 'running', createdAt, nowIso(now)),
  );

  try {
    for (const label of plannedLabels.slice(comparisons.length)) {
      const diagnostic = await options.adapter.getDiagnostic(label);
      const comparison = compareSpeechGoldLabel(label, diagnostic);
      comparisons.push(comparison);
      await writeComparisons(comparisonsFilePath, comparisons);
      await writeManifest(
        manifestFilePath,
        createManifest(options.plannedAudioIds, comparisons, 'running', createdAt, nowIso(now)),
      );
    }

    const summary = aggregateSpeechGoldComparisons(comparisons, {
      fixtureCount: options.plannedAudioIds.length,
    });
    await writeSummary(summaryFilePath, summary);
    const manifest = createManifest(
      options.plannedAudioIds,
      comparisons,
      'completed',
      createdAt,
      nowIso(now),
    );
    await writeManifest(manifestFilePath, manifest);
    return { manifest, comparisons, summary };
  } catch (error) {
    await writeManifest(
      manifestFilePath,
      createManifest(options.plannedAudioIds, comparisons, 'failed', createdAt, nowIso(now)),
    );
    throw error;
  }
}
