import { readdir, stat } from 'node:fs/promises';
import path from 'node:path';

export const DEFAULT_AUDIO_START_DELAY_MS = 50;
export const DEFAULT_AUDIO_FINISH_DELAY_MS = 10;

export type SpeechAudioFormat = 'wav' | 'mp3';

export const DEFAULT_SPEECH_DATASETS = ['datensätze/20-saetze-neu'] as const;

export const DEFAULT_SPEECH_DEVICE = '4B293FA5-24E8-4BF4-8295-3EF2D6C50F7D';
export const DEFAULT_SPEECH_RESULTS_DIRECTORY =
  'docs/specs/natuerliches-hinzufuegen-von-einkaufsartikeln_V2/maestro-speech-results';

export type SpeechDatasetRunnerOptions = {
  datasetPaths: string[];
  formats: SpeechAudioFormat[];
  device: string;
  audioPlayer: string;
  audioStartDelayMs: number;
  audioFinishDelayMs: number;
  resultsDirectory: string;
  limit?: number;
  dryRun: boolean;
  help: boolean;
};

function requireValue(argv: readonly string[], index: number, option: string): string {
  const value = argv[index + 1];
  if (!value || value.startsWith('--')) {
    throw new Error(`${option} benötigt einen Wert.`);
  }
  return value;
}

function parseNonNegativeInteger(value: string, option: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`${option} benötigt eine nichtnegative Ganzzahl.`);
  }
  return parsed;
}

function parseLimit(value: string): number {
  const parsed = parseNonNegativeInteger(value, '--limit');
  if (parsed === 0) throw new Error('--limit muss größer als 0 sein.');
  return parsed;
}

function parseFormats(value: string): SpeechAudioFormat[] {
  const normalized = value.trim().toLowerCase();
  if (normalized === 'both') return ['wav', 'mp3'];

  const formats = normalized.split(',').filter(Boolean);
  if (
    formats.length === 0 ||
    formats.some((format): format is string => format !== 'wav' && format !== 'mp3')
  ) {
    throw new Error('--formats unterstützt nur wav, mp3 oder both.');
  }

  return [...new Set(formats)] as SpeechAudioFormat[];
}

export function parseSpeechDatasetArgs(
  argv: readonly string[],
  environment: Readonly<Record<string, string | undefined>> = process.env,
): SpeechDatasetRunnerOptions {
  const positionalDatasets: string[] = [];
  const explicitDatasets: string[] = [];
  let formats: SpeechAudioFormat[] = ['wav'];
  let device = environment.MAESTRO_DEVICE ?? DEFAULT_SPEECH_DEVICE;
  let audioPlayer = environment.SPEECH_AUDIO_PLAYER ?? '/usr/bin/afplay';
  let audioStartDelayMs = DEFAULT_AUDIO_START_DELAY_MS;
  let audioFinishDelayMs = DEFAULT_AUDIO_FINISH_DELAY_MS;
  let resultsDirectory = DEFAULT_SPEECH_RESULTS_DIRECTORY;
  let limit: number | undefined;
  let dryRun = false;
  let help = false;

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    switch (argument) {
      case '--dataset':
        explicitDatasets.push(requireValue(argv, index, argument));
        index += 1;
        break;
      case '--formats':
      case '--format':
        formats = parseFormats(requireValue(argv, index, argument));
        index += 1;
        break;
      case '--device':
        device = requireValue(argv, index, argument);
        index += 1;
        break;
      case '--audio-player':
        audioPlayer = requireValue(argv, index, argument);
        index += 1;
        break;
      case '--audio-start-delay-ms':
        audioStartDelayMs = parseNonNegativeInteger(requireValue(argv, index, argument), argument);
        index += 1;
        break;
      case '--audio-finish-delay-ms':
        audioFinishDelayMs = parseNonNegativeInteger(requireValue(argv, index, argument), argument);
        index += 1;
        break;
      case '--results-dir':
        resultsDirectory = requireValue(argv, index, argument);
        index += 1;
        break;
      case '--limit':
        limit = parseLimit(requireValue(argv, index, argument));
        index += 1;
        break;
      case '--dry-run':
        dryRun = true;
        break;
      case '--help':
      case '-h':
        help = true;
        break;
      default:
        if (argument.startsWith('-')) throw new Error(`Unbekannte Option: ${argument}`);
        positionalDatasets.push(argument);
    }
  }

  const datasetPaths = [...positionalDatasets, ...explicitDatasets];

  return {
    datasetPaths: datasetPaths.length > 0 ? datasetPaths : [...DEFAULT_SPEECH_DATASETS],
    formats,
    device,
    audioPlayer,
    audioStartDelayMs,
    audioFinishDelayMs,
    resultsDirectory,
    ...(limit === undefined ? {} : { limit }),
    dryRun,
    help,
  };
}

export function sortSpeechAudioPaths(paths: readonly string[]): string[] {
  return [...paths].sort((left, right) => {
    const naturalOrder = left.localeCompare(right, 'en', {
      numeric: true,
      sensitivity: 'base',
    });
    return naturalOrder === 0 ? left.localeCompare(right) : naturalOrder;
  });
}

async function collectFiles(rootPath: string): Promise<string[]> {
  const rootStats = await stat(rootPath);
  if (rootStats.isFile()) return [rootPath];
  if (!rootStats.isDirectory()) return [];

  const entries = await readdir(rootPath, { withFileTypes: true });
  const children = await Promise.all(
    entries
      .filter((entry) => !entry.name.startsWith('.'))
      .map((entry) => collectFiles(path.join(rootPath, entry.name))),
  );
  return children.flat();
}

export async function discoverSpeechAudioFiles(
  datasetPaths: readonly string[],
  formats: readonly SpeechAudioFormat[],
): Promise<string[]> {
  const formatSet = new Set(formats.map((format) => `.${format}`));
  const discovered: string[] = [];

  for (const datasetPath of datasetPaths) {
    const files = await collectFiles(path.resolve(datasetPath));
    for (const file of sortSpeechAudioPaths(files)) {
      if (formatSet.has(path.extname(file).toLowerCase())) discovered.push(file);
    }
  }

  return discovered;
}
