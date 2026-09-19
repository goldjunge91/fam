import path from 'node:path';

import { createEmptyBetaQualityMetrics } from '../../src/features/shopping-list/natuerliches-hinzufuegen-von-einkaufsartikeln-beta/domain/quality-metrics';
import { sanitizeQualitySnapshot } from '../../src/features/shopping-list/natuerliches-hinzufuegen-von-einkaufsartikeln-beta/domain/quality-snapshot';
import {
  DEFAULT_AUDIO_FINISH_DELAY_MS,
  DEFAULT_AUDIO_START_DELAY_MS,
  DEFAULT_SPEECH_DATASETS,
  discoverSpeechAudioFiles,
  findResumeStartIndex,
  DEFAULT_SPEECH_RESULTS_DIRECTORY,
  parseSpeechDatasetArgs,
  validateSpeechDatasetQualityLine,
  sortSpeechAudioPaths,
} from '../../.maestro/scripts/speech-dataset-plan';

function qualityLine(
  confirmedItemCount: number,
  experimentVariant: 'baseline' | 'contextual-strings' = 'baseline',
): string {
  const baseMetrics = createEmptyBetaQualityMetrics();
  const payload = sanitizeQualitySnapshot({
    metrics: {
      ...baseMetrics,
      confirmedItemCount,
      automaticAssignmentCount: confirmedItemCount,
      correctAutomaticAssignmentCount: confirmedItemCount,
      completionDurationsMs: confirmedItemCount > 0 ? [1_000] : [],
    },
    captureKind: 'maestro-preview-test',
    fixtureSetVersion: '20-saetze-neu-v1',
    experimentVariant,
    createdAt: '2026-09-19T10:00:00.000Z',
  });
  if (!payload) throw new Error('Testfixture für Qualitätszeile ist ungültig.');
  return JSON.stringify(payload);
}

describe('speech dataset runner plan', () => {
  it('uses both repository datasets and WAV audio by default', () => {
    expect(parseSpeechDatasetArgs([], {})).toMatchObject({
      datasetPaths: [...DEFAULT_SPEECH_DATASETS],
      formats: ['wav'],
      device: '4B293FA5-24E8-4BF4-8295-3EF2D6C50F7D',
      audioPlayer: '/usr/bin/afplay',
      audioStartDelayMs: DEFAULT_AUDIO_START_DELAY_MS,
      audioFinishDelayMs: DEFAULT_AUDIO_FINISH_DELAY_MS,
      resultsDirectory: DEFAULT_SPEECH_RESULTS_DIRECTORY,
      experimentVariant: 'baseline',
      resumeLatest: false,
      dryRun: false,
      help: false,
    });
  });

  it('accepts the latest incomplete run resume flag', () => {
    expect(parseSpeechDatasetArgs(['--resume-latest'], {})).toMatchObject({
      resumeLatest: true,
    });
  });

  it('accepts an explicit contextual speech variant', () => {
    expect(parseSpeechDatasetArgs(['--variant', 'contextual-strings'], {})).toMatchObject({
      experimentVariant: 'contextual-strings',
    });
  });

  it('accepts explicit datasets, device, MP3 input, and a run limit', () => {
    expect(
      parseSpeechDatasetArgs(
        [
          'datensätze/eigenmarken-20',
          '--dataset',
          'datensätze/20-saetze-neu',
          '--formats',
          'mp3',
          '--device',
          'simulator-1',
          '--results-dir',
          'tmp/speech-results',
          '--limit',
          '3',
          '--dry-run',
        ],
        {},
      ),
    ).toMatchObject({
      datasetPaths: ['datensätze/eigenmarken-20', 'datensätze/20-saetze-neu'],
      formats: ['mp3'],
      device: 'simulator-1',
      limit: 3,
      resultsDirectory: 'tmp/speech-results',
      dryRun: true,
    });
  });

  it('sorts numbered audio files naturally and keeps equal names deterministic', () => {
    expect(
      sortSpeechAudioPaths([
        '/tmp/satz-10.wav',
        '/tmp/satz-2.wav',
        '/tmp/satz-01.wav',
        '/tmp/satz-2.mp3',
      ]),
    ).toEqual([
      '/tmp/satz-01.wav',
      '/tmp/satz-2.mp3',
      '/tmp/satz-2.wav',
      '/tmp/satz-10.wav',
    ]);
  });

  it('starts at the first audio fixture without a captured snapshot', () => {
    const repositoryRoot = process.cwd();
    const audioFiles = [
      path.join(repositoryRoot, 'datensätze/20-saetze-neu/satz-01.wav'),
      path.join(repositoryRoot, 'datensätze/20-saetze-neu/satz-02.wav'),
      path.join(repositoryRoot, 'datensätze/20-saetze-neu/satz-03.wav'),
    ];

    expect(
      findResumeStartIndex(
        audioFiles,
        [
          {
            audio: 'datensätze/20-saetze-neu/satz-01.wav',
            line: 1,
            capturedAt: '2026-09-18T18:00:00.000Z',
          },
          {
            audio: 'datensätze/20-saetze-neu/satz-02.wav',
            line: 2,
            capturedAt: '2026-09-18T18:01:00.000Z',
          },
        ],
        repositoryRoot,
      ),
    ).toBe(2);
  });

  it('rejects a capture without confirmed preview items', () => {
    expect(() =>
      validateSpeechDatasetQualityLine(
        qualityLine(0),
        'satz-01.wav',
      ),
    ).toThrow('enthält keine bestätigten Preview-Artikel');
  });

  it('accepts a non-empty preview measurement', () => {
    const line = qualityLine(1);

    expect(validateSpeechDatasetQualityLine(line, 'satz-01.wav')).toBe(line);
  });

  it('rejects a capture whose variant does not match the requested run', () => {
    const line = qualityLine(1);

    expect(() =>
      validateSpeechDatasetQualityLine(line, 'satz-01.wav', 'contextual-strings'),
    ).toThrow('unerwartete Experiment-Variante');
  });

  it('discovers the 20 WAV files from the default dataset', async () => {
    const files = await discoverSpeechAudioFiles(DEFAULT_SPEECH_DATASETS, ['wav']);

    expect(files).toHaveLength(20);
    expect(files[0]).toMatch(/satz-01\.wav$/);
    expect(files.at(-1)).toMatch(/satz-20\.wav$/);
  });
});
