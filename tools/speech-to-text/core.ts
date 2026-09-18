import path from 'node:path';

export type InputFormat = 'json' | 'csv';
export type AudioFormat = 'wav' | 'mp3';

export type RawSpeechRecord = Record<string, unknown>;

export interface SpeechRecord {
  id: string;
  text: string;
  index: number;
}

export interface AudioGeneratorOptions {
  inputPath: string;
  outputDir: string;
  formats: AudioFormat[];
  voice: string;
  rate: number;
  sampleRate: number;
  textField?: string;
  idField: string;
  delimiter: string;
  force: boolean;
  dryRun: boolean;
  keepAiff: boolean;
  help: boolean;
}

export interface ParseInputOptions {
  format: InputFormat;
  delimiter?: string;
}

export interface CommandPlan {
  program: string;
  args: string[];
}

export interface AudioPlan {
  record: SpeechRecord;
  stem: string;
  aiffPath: string;
  wavPath: string;
  mp3Path: string;
  commands: CommandPlan[];
}

const DEFAULT_TEXT_FIELDS = ['text', 'sentence', 'prompt', 'transcript', 'utterance'];
const DEFAULT_VOICE = 'Anna';
const DEFAULT_RATE = 175;
const DEFAULT_SAMPLE_RATE = 16_000;
const DEFAULT_ID_FIELD = 'id';
const DEFAULT_DELIMITER = ',';
const DEFAULT_FORMATS: AudioFormat[] = ['wav'];

function isRecord(value: unknown): value is RawSpeechRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function assertDelimiter(delimiter: string): void {
  if ([...delimiter].length !== 1) {
    throw new Error('The CSV delimiter must be exactly one character.');
  }
}

function parseCsvRows(source: string, delimiter: string): string[][] {
  assertDelimiter(delimiter);

  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let index = 0; index < source.length; index++) {
    const character = source[index];
    const nextCharacter = source[index + 1];

    if (inQuotes) {
      if (character === '"' && nextCharacter === '"') {
        field += '"';
        index++;
      } else if (character === '"') {
        inQuotes = false;
      } else {
        field += character;
      }
      continue;
    }

    if (character === '"' && field.length === 0) {
      inQuotes = true;
    } else if (character === delimiter) {
      row.push(field);
      field = '';
    } else if (character === '\n' || character === '\r') {
      row.push(field);
      field = '';
      if (row.some((value) => value.trim() !== '')) rows.push(row);
      row = [];
      if (character === '\r' && nextCharacter === '\n') index++;
    } else {
      field += character;
    }
  }

  if (inQuotes) throw new Error('CSV contains an unterminated quoted field.');

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    if (row.some((value) => value.trim() !== '')) rows.push(row);
  }

  return rows;
}

function recordsFromCsv(source: string, delimiter: string): RawSpeechRecord[] {
  const rows = parseCsvRows(source.replace(/^\uFEFF/, ''), delimiter);
  if (rows.length === 0) return [];

  const headers = rows[0].map((header, index) => {
    const normalizedHeader = index === 0 ? header.replace(/^\uFEFF/, '') : header;
    return normalizedHeader.trim();
  });

  if (headers.some((header) => header.length === 0)) {
    throw new Error('CSV contains an empty header.');
  }

  if (new Set(headers).size !== headers.length) {
    throw new Error('CSV contains duplicate headers.');
  }

  return rows.slice(1).map((row, rowIndex) => {
    if (row.length > headers.length) {
      throw new Error(`CSV row ${rowIndex + 2} has more fields than the header.`);
    }

    return Object.fromEntries(headers.map((header, index) => [header, row[index] ?? '']));
  });
}

function recordsFromJson(source: string): RawSpeechRecord[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(source.replace(/^\uFEFF/, '')) as unknown;
  } catch (error) {
    const detail = error instanceof Error ? ` ${error.message}` : '';
    throw new Error(`Invalid JSON input.${detail}`);
  }

  if (Array.isArray(parsed)) {
    return parsed.map((value, index) => {
      if (!isRecord(value)) throw new Error(`JSON record ${index + 1} must be an object.`);
      return value;
    });
  }

  if (!isRecord(parsed)) throw new Error('JSON input must be an array or object.');

  for (const key of ['records', 'data', 'items']) {
    const nested = parsed[key];
    if (nested !== undefined) {
      if (!Array.isArray(nested)) throw new Error(`JSON property "${key}" must be an array.`);
      return nested.map((value, index) => {
        if (!isRecord(value)) throw new Error(`JSON record ${index + 1} must be an object.`);
        return value;
      });
    }
  }

  return [parsed];
}

export function parseInputRecords(source: string, options: ParseInputOptions): RawSpeechRecord[] {
  return options.format === 'csv'
    ? recordsFromCsv(source, options.delimiter ?? DEFAULT_DELIMITER)
    : recordsFromJson(source);
}

function resolveTextField(records: RawSpeechRecord[], requestedField?: string): string {
  if (requestedField) return requestedField;

  const detectedField = DEFAULT_TEXT_FIELDS.find((field) =>
    records.every((record) => typeof record[field] === 'string' && record[field].trim().length > 0),
  );
  if (detectedField) return detectedField;

  throw new Error(
    `Could not find a text field. Use --text-field=<name>. Tried: ${DEFAULT_TEXT_FIELDS.join(', ')}.`,
  );
}

function getIdValue(record: RawSpeechRecord, idField: string, index: number): string {
  const value = record[idField];
  if (typeof value === 'string' && value.trim().length > 0) return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return String(index + 1).padStart(3, '0');
}

function getTextValue(record: RawSpeechRecord, textField: string, index: number): string {
  const value = record[textField];
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`Record ${index + 1} has no non-empty text in field "${textField}".`);
  }
  return value.trim();
}

export function fileStemForId(id: string, index = 0): string {
  const normalized = id.normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
  const safe = normalized
    .replace(/[^a-zA-Z0-9._-]+/g, '_')
    .replace(/^\.+/, '')
    .replace(/\.+$/, '');
  return safe || String(index + 1).padStart(3, '0');
}

export function normalizeSpeechRecords(
  records: RawSpeechRecord[],
  options: { textField?: string; idField?: string } = {},
): SpeechRecord[] {
  const textField = resolveTextField(records, options.textField);
  const idField = options.idField ?? DEFAULT_ID_FIELD;
  const normalizedRecords = records.map((record, index) => ({
    id: getIdValue(record, idField, index),
    text: getTextValue(record, textField, index),
    index,
  }));

  const stems = new Map<string, number>();
  for (const record of normalizedRecords) {
    const stem = fileStemForId(record.id, record.index);
    const firstIndex = stems.get(stem);
    if (firstIndex !== undefined) {
      throw new Error(
        `Records ${firstIndex + 1} and ${record.index + 1} produce the same output filename "${stem}".`,
      );
    }
    stems.set(stem, record.index);
  }

  return normalizedRecords;
}

function parseFormats(value: string): AudioFormat[] {
  const formats = value
    .split(',')
    .map((format) => format.trim().toLowerCase())
    .filter(Boolean);
  if (formats.length === 0 || formats.some((format) => format !== 'wav' && format !== 'mp3')) {
    throw new Error('Formats must be a comma-separated list containing only wav and/or mp3.');
  }
  return [...new Set(formats)] as AudioFormat[];
}

function readOption(
  args: readonly string[],
  index: number,
  name: string,
): { value: string; nextIndex: number } {
  const argument = args[index];
  const equalsPrefix = `${name}=`;
  if (argument.startsWith(equalsPrefix)) {
    return { value: argument.slice(equalsPrefix.length), nextIndex: index };
  }

  const value = args[index + 1];
  if (!value || value.startsWith('--')) throw new Error(`${name} requires a value.`);
  return { value, nextIndex: index + 1 };
}

function parsePositiveInteger(value: string, optionName: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${optionName} must be a positive integer.`);
  }
  return parsed;
}

function defaultOutputDir(inputPath: string): string {
  const extension = path.extname(inputPath);
  const stem = path.basename(inputPath, extension);
  return path.join(path.dirname(inputPath), `${stem}-audio`);
}

export function parseCliArgs(argv: readonly string[]): AudioGeneratorOptions {
  let inputPath = '';
  let outputDir: string | undefined;
  let formats = [...DEFAULT_FORMATS];
  let voice = DEFAULT_VOICE;
  let rate = DEFAULT_RATE;
  let sampleRate = DEFAULT_SAMPLE_RATE;
  let textField: string | undefined;
  let idField = DEFAULT_ID_FIELD;
  let delimiter = DEFAULT_DELIMITER;
  let force = false;
  let dryRun = false;
  let keepAiff = false;
  let help = false;

  for (let index = 0; index < argv.length; index++) {
    const argument = argv[index];

    if (argument === '-h' || argument === '--help') {
      help = true;
    } else if (argument === '--force') {
      force = true;
    } else if (argument === '--dry-run') {
      dryRun = true;
    } else if (argument === '--keep-aiff') {
      keepAiff = true;
    } else if (argument === '--output-dir' || argument.startsWith('--output-dir=')) {
      const option = readOption(argv, index, '--output-dir');
      outputDir = option.value;
      index = option.nextIndex;
    } else if (argument === '--formats' || argument.startsWith('--formats=')) {
      const option = readOption(argv, index, '--formats');
      formats = parseFormats(option.value);
      index = option.nextIndex;
    } else if (argument === '--voice' || argument.startsWith('--voice=')) {
      const option = readOption(argv, index, '--voice');
      voice = option.value.trim();
      if (!voice) throw new Error('--voice must not be empty.');
      index = option.nextIndex;
    } else if (argument === '--rate' || argument.startsWith('--rate=')) {
      const option = readOption(argv, index, '--rate');
      rate = parsePositiveInteger(option.value, '--rate');
      index = option.nextIndex;
    } else if (argument === '--sample-rate' || argument.startsWith('--sample-rate=')) {
      const option = readOption(argv, index, '--sample-rate');
      sampleRate = parsePositiveInteger(option.value, '--sample-rate');
      index = option.nextIndex;
    } else if (argument === '--text-field' || argument.startsWith('--text-field=')) {
      const option = readOption(argv, index, '--text-field');
      textField = option.value.trim();
      if (!textField) throw new Error('--text-field must not be empty.');
      index = option.nextIndex;
    } else if (argument === '--id-field' || argument.startsWith('--id-field=')) {
      const option = readOption(argv, index, '--id-field');
      idField = option.value.trim();
      if (!idField) throw new Error('--id-field must not be empty.');
      index = option.nextIndex;
    } else if (argument === '--delimiter' || argument.startsWith('--delimiter=')) {
      const option = readOption(argv, index, '--delimiter');
      delimiter = option.value;
      assertDelimiter(delimiter);
      index = option.nextIndex;
    } else if (argument.startsWith('-')) {
      throw new Error(`Unknown option: ${argument}`);
    } else if (!inputPath) {
      inputPath = argument;
    } else {
      throw new Error(`Unexpected argument: ${argument}`);
    }
  }

  return {
    inputPath,
    outputDir: outputDir ?? (inputPath ? defaultOutputDir(inputPath) : ''),
    formats,
    voice,
    rate,
    sampleRate,
    textField,
    idField,
    delimiter,
    force,
    dryRun,
    keepAiff,
    help,
  };
}

export function buildAudioPlan(
  records: SpeechRecord[],
  options: AudioGeneratorOptions,
  tempDir = path.join(options.outputDir, '.speech-to-text-tmp'),
): AudioPlan[] {
  if (records.length === 0) throw new Error('Input contains no records.');
  if (options.formats.length === 0) throw new Error('At least one audio format is required.');

  const outputDir = path.resolve(options.outputDir);
  const resolvedTempDir = path.resolve(tempDir);

  return records.map((record) => {
    const stem = fileStemForId(record.id, record.index);
    const aiffPath = options.keepAiff
      ? path.join(outputDir, `${stem}.aiff`)
      : path.join(resolvedTempDir, `${stem}.aiff`);
    const wavPath = options.formats.includes('wav')
      ? path.join(outputDir, `${stem}.wav`)
      : path.join(resolvedTempDir, `${stem}.wav`);
    const mp3Path = path.join(outputDir, `${stem}.mp3`);
    const commands: CommandPlan[] = [
      {
        program: '/usr/bin/say',
        args: ['-v', options.voice, '-r', String(options.rate), '-o', aiffPath, record.text],
      },
      {
        program: 'afconvert',
        args: ['-f', 'WAVE', '-d', `LEI16@${options.sampleRate}`, '-c', '1', aiffPath, wavPath],
      },
    ];

    if (options.formats.includes('mp3')) {
      commands.push({
        program: 'ffmpeg',
        args: [
          '-hide_banner',
          '-loglevel',
          'error',
          '-y',
          '-i',
          wavPath,
          '-codec:a',
          'libmp3lame',
          '-b:a',
          '64k',
          mp3Path,
        ],
      });
    }

    return { record, stem, aiffPath, wavPath, mp3Path, commands };
  });
}

export const defaults = {
  delimiter: DEFAULT_DELIMITER,
  formats: DEFAULT_FORMATS,
  idField: DEFAULT_ID_FIELD,
  rate: DEFAULT_RATE,
  sampleRate: DEFAULT_SAMPLE_RATE,
  voice: DEFAULT_VOICE,
} as const;
