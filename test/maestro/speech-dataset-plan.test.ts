import {
  DEFAULT_AUDIO_FINISH_DELAY_MS,
  DEFAULT_AUDIO_START_DELAY_MS,
  DEFAULT_SPEECH_DATASETS,
  discoverSpeechAudioFiles,
  DEFAULT_SPEECH_RESULTS_DIRECTORY,
  parseSpeechDatasetArgs,
  sortSpeechAudioPaths,
} from '../../.maestro/scripts/speech-dataset-plan';

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
      dryRun: false,
      help: false,
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

  it('discovers the 20 WAV files from the default dataset', async () => {
    const files = await discoverSpeechAudioFiles(DEFAULT_SPEECH_DATASETS, ['wav']);

    expect(files).toHaveLength(20);
    expect(files[0]).toMatch(/satz-01\.wav$/);
    expect(files.at(-1)).toMatch(/satz-20\.wav$/);
  });
});
