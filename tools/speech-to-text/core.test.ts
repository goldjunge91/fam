import assert from 'node:assert/strict';
import {
  buildAudioPlan,
  normalizeSpeechRecords,
  parseCliArgs,
  parseInputRecords,
  type AudioGeneratorOptions,
} from './core';

function test(name: string, callback: () => void): void {
  callback();
  console.log(`✓ ${name}`);
}

test('parses semicolon CSV with quoted commas and escaped quotes', () => {
  const records = parseInputRecords(
    'id;text;market\r\n01;"Milch, Brot und Eier";EDEKA\r\n02;"Er sagt ""Hallo""";REWE\r\n',
    { format: 'csv', delimiter: ';' },
  );

  assert.deepEqual(records, [
    { id: '01', text: 'Milch, Brot und Eier', market: 'EDEKA' },
    { id: '02', text: 'Er sagt "Hallo"', market: 'REWE' },
  ]);
});

test('accepts JSON records wrapped in a records property', () => {
  const records = parseInputRecords(
    JSON.stringify({ records: [{ id: '01', utterance: 'Milch und Brot' }] }),
    { format: 'json' },
  );

  assert.deepEqual(normalizeSpeechRecords(records, { textField: 'utterance' }), [
    { id: '01', text: 'Milch und Brot', index: 0 },
  ]);
});

test('derives stable safe stems and rejects collisions', () => {
  const records = normalizeSpeechRecords([
    { id: '01 Milch/Brot', text: 'Milch und Brot' },
    { text: 'Eier und Butter' },
  ]);

  assert.deepEqual(records, [
    { id: '01 Milch/Brot', text: 'Milch und Brot', index: 0 },
    { id: '002', text: 'Eier und Butter', index: 1 },
  ]);

  assert.throws(
    () =>
      normalizeSpeechRecords([
        { id: 'a/b', text: 'Erster Satz' },
        { id: 'a_b', text: 'Zweiter Satz' },
      ]),
    /same output filename/i,
  );
});

test('parses CLI options for a CSV to WAV and MP3 run', () => {
  assert.deepEqual(
    parseCliArgs([
      'lists.csv',
      '--output-dir',
      'audio',
      '--formats',
      'wav,mp3',
      '--voice',
      'Anna',
      '--rate',
      '180',
      '--text-field',
      'utterance',
      '--delimiter',
      ';',
      '--force',
    ]),
    {
      inputPath: 'lists.csv',
      outputDir: 'audio',
      formats: ['wav', 'mp3'],
      voice: 'Anna',
      rate: 180,
      sampleRate: 16000,
      textField: 'utterance',
      idField: 'id',
      delimiter: ';',
      force: true,
      dryRun: false,
      keepAiff: false,
      help: false,
    },
  );
});

test('builds safe macOS conversion commands', () => {
  const options: AudioGeneratorOptions = {
    inputPath: '/tmp/lists.json',
    outputDir: '/tmp/audio',
    formats: ['wav', 'mp3'],
    voice: 'Anna',
    rate: 175,
    sampleRate: 16000,
    textField: 'text',
    idField: 'id',
    delimiter: ',',
    force: false,
    dryRun: false,
    keepAiff: false,
    help: false,
  };

  const [plan] = buildAudioPlan(
    normalizeSpeechRecords([{ id: '01', text: 'Milch und Brot' }]),
    options,
  );

  assert.equal(plan.stem, '01');
  assert.deepEqual(
    plan.commands.map(({ program, args }) => ({ program, args })),
    [
      {
        program: '/usr/bin/say',
        args: ['-v', 'Anna', '-r', '175', '-o', plan.aiffPath, 'Milch und Brot'],
      },
      {
        program: 'afconvert',
        args: ['-f', 'WAVE', '-d', 'LEI16@16000', '-c', '1', plan.aiffPath, plan.wavPath],
      },
      {
        program: 'ffmpeg',
        args: [
          '-hide_banner',
          '-loglevel',
          'error',
          '-y',
          '-i',
          plan.wavPath,
          '-codec:a',
          'libmp3lame',
          '-b:a',
          '64k',
          plan.mp3Path,
        ],
      },
    ],
  );
});
