import { readFile } from 'node:fs/promises';
import {
  SPEECH_GOLD_LABEL_SCHEMA_VERSION,
  type SpeechGoldLabel,
  type SpeechGoldLabelItem,
} from '../../src/features/shopping-list/natuerliches-hinzufuegen-von-einkaufsartikeln-beta/domain/speech-gold-contract';

export const SPEECH_GOLD_FIXTURE_SET_SIZE = 20 as const;

export const SPEECH_GOLD_AUDIO_IDS = Object.freeze(
  Array.from(
    { length: SPEECH_GOLD_FIXTURE_SET_SIZE },
    (_, index) => `satz-${String(index + 1).padStart(2, '0')}.wav`,
  ),
);

export type { SpeechGoldLabel, SpeechGoldLabelItem } from '../../src/features/shopping-list/natuerliches-hinzufuegen-von-einkaufsartikeln-beta/domain/speech-gold-contract';

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function fail(lineNumber: number, message: string): never {
  throw new Error(`Goldlabel-Zeile ${lineNumber}: ${message}`);
}

function requireNonEmptyString(value: unknown, field: string, lineNumber: number): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    fail(lineNumber, `${field} muss ein nichtleerer String sein`);
  }
  return value;
}

function validateGoldLabelItem(
  value: unknown,
  itemIndex: number,
  lineNumber: number,
): SpeechGoldLabelItem {
  if (!isRecord(value)) {
    fail(lineNumber, `items[${itemIndex}] muss ein Objekt sein`);
  }

  const name = requireNonEmptyString(value.name, `items[${itemIndex}].name`, lineNumber);
  if (
    typeof value.quantity !== 'number' ||
    !Number.isFinite(value.quantity) ||
    value.quantity <= 0
  ) {
    fail(lineNumber, `items[${itemIndex}].quantity muss eine endliche Zahl sein`);
  }

  if (
    value.unit !== null &&
    (typeof value.unit !== 'string' || value.unit.trim().length === 0)
  ) {
    fail(lineNumber, `items[${itemIndex}].unit muss ein String oder null sein`);
  }

  if (value.brand !== undefined && value.brand !== null && typeof value.brand !== 'string') {
    fail(lineNumber, `items[${itemIndex}].brand muss ein String oder null sein`);
  }

  return {
    name,
    quantity: value.quantity,
    unit: value.unit,
    brand: value.brand ?? null,
  };
}

function validateGoldLabelRecord(
  value: unknown,
  lineNumber: number,
  fixtureSetVersion: string | undefined,
): { label: SpeechGoldLabel; fixtureSetVersion: string } {
  if (!isRecord(value)) fail(lineNumber, 'enthält kein Goldlabel-Objekt');

  if (value.schemaVersion !== SPEECH_GOLD_LABEL_SCHEMA_VERSION) {
    fail(lineNumber, `schemaVersion muss ${SPEECH_GOLD_LABEL_SCHEMA_VERSION} sein`);
  }

  const currentFixtureSetVersion = requireNonEmptyString(
    value.fixtureSetVersion,
    'fixtureSetVersion',
    lineNumber,
  );
  if (fixtureSetVersion !== undefined && currentFixtureSetVersion !== fixtureSetVersion) {
    fail(
      lineNumber,
      `fixtureSetVersion muss ${fixtureSetVersion} entsprechen, erhalten: ${currentFixtureSetVersion}`,
    );
  }

  const audio = requireNonEmptyString(value.audio, 'audio', lineNumber);
  const audioIndex = SPEECH_GOLD_AUDIO_IDS.indexOf(audio);
  if (audioIndex === -1) {
    fail(lineNumber, `unbekannte Audio-ID: ${audio}`);
  }

  const referenceFile = requireNonEmptyString(value.referenceFile, 'referenceFile', lineNumber);
  if (
    typeof value.referenceLine !== 'number' ||
    !Number.isInteger(value.referenceLine) ||
    value.referenceLine < 1
  ) {
    fail(lineNumber, 'referenceLine muss eine positive Ganzzahl sein');
  }
  const expectedReferenceLine = audioIndex + 1;
  if (value.referenceLine !== expectedReferenceLine) {
    fail(
      lineNumber,
      `referenceLine ${value.referenceLine} passt nicht zu ${audio}, erwartet: ${expectedReferenceLine}`,
    );
  }

  if (value.targetListId !== null) {
    fail(lineNumber, 'targetListId muss null sein');
  }

  if (
    value.mentionedMarket !== null &&
    (typeof value.mentionedMarket !== 'string' || value.mentionedMarket.trim().length === 0)
  ) {
    fail(lineNumber, 'mentionedMarket muss ein String oder null sein');
  }
  if (
    value.expectedUnparsedText !== null &&
    (typeof value.expectedUnparsedText !== 'string' ||
      value.expectedUnparsedText.trim().length === 0)
  ) {
    fail(lineNumber, 'expectedUnparsedText muss ein String oder null sein');
  }

  if (!Array.isArray(value.items) || value.items.length === 0) {
    fail(lineNumber, 'items muss mindestens ein Item enthalten');
  }

  return {
    label: {
      schemaVersion: SPEECH_GOLD_LABEL_SCHEMA_VERSION,
      fixtureSetVersion: currentFixtureSetVersion,
      audio,
      referenceFile,
      referenceLine: value.referenceLine,
      targetListId: null,
      mentionedMarket: value.mentionedMarket,
      expectedUnparsedText: value.expectedUnparsedText,
      items: value.items.map((item, itemIndex) =>
        validateGoldLabelItem(item, itemIndex, lineNumber),
      ),
    },
    fixtureSetVersion: currentFixtureSetVersion,
  };
}

function parseJsonLines(content: string): unknown[] {
  const lines = content.split(/\r?\n/u);
  while (lines.at(-1)?.trim() === '') lines.pop();
  if (lines.length === 0) throw new Error('Goldlabel-Datei enthält keine Labels');

  return lines.map((line, index) => {
    if (line.trim().length === 0) fail(index + 1, 'ist leer');
    try {
      return JSON.parse(line) as unknown;
    } catch {
      fail(index + 1, 'ist kein gültiges JSON');
    }
  });
}

/**
 * Validiert die kanonische JSONL-Goldquelle ohne Zugriff auf den Produktparser.
 * Die Rückgabe ist nach der kanonischen Audio-Reihenfolge sortiert.
 */
export function validateSpeechGoldLabels(content: string): readonly SpeechGoldLabel[] {
  const parsedLines = parseJsonLines(content);
  const audioIds = new Set<string>();
  const referenceLines = new Set<number>();
  let fixtureSetVersion: string | undefined;
  const labels: SpeechGoldLabel[] = [];

  parsedLines.forEach((value, index) => {
    const lineNumber = index + 1;
    const result = validateGoldLabelRecord(value, lineNumber, fixtureSetVersion);
    const { label } = result;

    if (audioIds.has(label.audio)) {
      fail(lineNumber, `Audio-ID ${label.audio} ist doppelt`);
    }
    if (referenceLines.has(label.referenceLine)) {
      fail(lineNumber, `referenceLine ${label.referenceLine} ist doppelt`);
    }

    audioIds.add(label.audio);
    referenceLines.add(label.referenceLine);
    fixtureSetVersion ??= result.fixtureSetVersion;
    labels.push(label);
  });

  const missingAudioIds = SPEECH_GOLD_AUDIO_IDS.filter((audio) => !audioIds.has(audio));
  if (missingAudioIds.length > 0) {
    throw new Error(`Goldlabel-Abdeckung unvollständig: ${missingAudioIds.join(', ')} fehlt`);
  }
  if (labels.length !== SPEECH_GOLD_FIXTURE_SET_SIZE) {
    throw new Error(
      `Goldlabel-Abdeckung erwartet ${SPEECH_GOLD_FIXTURE_SET_SIZE} Labels, erhalten: ${labels.length}`,
    );
  }

  return [...labels].sort(
    (left, right) =>
      SPEECH_GOLD_AUDIO_IDS.indexOf(left.audio) - SPEECH_GOLD_AUDIO_IDS.indexOf(right.audio),
  );
}

export async function loadSpeechGoldLabels(filePath: string): Promise<readonly SpeechGoldLabel[]> {
  const content = await readFile(filePath, 'utf8');
  try {
    return validateSpeechGoldLabels(content);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Ungültige Speech-Goldlabel-Datei ${filePath}: ${message}`, { cause: error });
  }
}
