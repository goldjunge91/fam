import type { SanitizedQualityPayload } from '../domain/quality-snapshot';

let mockFileExists = false;
let mockFileText = '';

jest.mock('expo-file-system', () => ({
  File: jest.fn().mockImplementation(() => ({
    uri: 'file:///cache/fam-natural-language-addition-quality.jsonl',
    exists: mockFileExists,
    text: jest.fn().mockResolvedValue(mockFileText),
    write: jest.fn(),
  })),
  Paths: { cache: 'file:///cache' },
}));

const {
  appendQualityTestSnapshot,
  MAX_QUALITY_TEST_SNAPSHOTS,
  QUALITY_TEST_RESULTS_FILE_NAME,
  readQualityTestSnapshots,
} = require('./quality-test-results') as typeof import('./quality-test-results');
const fileSystem = require('expo-file-system') as { File: jest.Mock };

const payload = {
  schemaVersion: 2,
  snapshotVersion: 1,
  metricDefinitionVersion: 1,
  captureKind: 'maestro-preview-test',
  fixtureSetVersion: null,
  experimentVariant: 'baseline',
  createdAt: '2026-09-18T12:00:00.000Z',
  confirmedItemCount: 1,
  automaticAssignmentCount: 1,
  correctAutomaticAssignmentCount: 1,
  falseListAssignmentCount: 0,
  manualCorrectionCount: 0,
  durationSamplesMs: [100],
  qualityFlags: {
    unparsedTextPresent: 0,
    ambiguousItemBoundary: 0,
    semanticItemMismatch: 0,
    incorrectAutomaticAssignment: 0,
    manualCorrection: 0,
  },
  metrics: {
    automaticAccuracyPercent: {
      value: 100,
      numerator: 1,
      denominator: 1,
      sampleCount: 1,
    },
    falseListPercent: { value: 0, numerator: 0, denominator: 1, sampleCount: 1 },
    manualCorrectionPercent: { value: 0, numerator: 0, denominator: 1, sampleCount: 1 },
    medianTimeToAddMs: { value: 100, numerator: null, denominator: null, sampleCount: 1 },
  },
} satisfies SanitizedQualityPayload;

describe('quality test results', () => {
  beforeEach(() => {
    fileSystem.File.mockClear();
    mockFileExists = false;
    mockFileText = '';
  });

  it('rewrites the bounded simulator cache with exactly one sanitized payload line', async () => {
    await appendQualityTestSnapshot(payload);

    expect(fileSystem.File).toHaveBeenCalledWith('file:///cache', QUALITY_TEST_RESULTS_FILE_NAME);
    const file = fileSystem.File.mock.results.at(-1)?.value as { write: jest.Mock };
    expect(file.write).toHaveBeenCalledTimes(1);
    expect(file.write).toHaveBeenCalledWith(`${JSON.stringify(payload)}\n`, { append: false });
  });

  it('keeps only the newest bounded set of test captures', async () => {
    mockFileExists = true;
    mockFileText = `${Array.from({ length: MAX_QUALITY_TEST_SNAPSHOTS }, () =>
      JSON.stringify(payload),
    ).join('\n')}\n`;

    await appendQualityTestSnapshot({ ...payload, createdAt: '2026-09-18T12:01:00.000Z' });

    const file = fileSystem.File.mock.results.at(-1)?.value as { write: jest.Mock };
    const [content, options] = file.write.mock.calls[0] as [string, { append: boolean }];
    expect(options).toEqual({ append: false });
    expect(content.trim().split('\n')).toHaveLength(MAX_QUALITY_TEST_SNAPSHOTS);
    expect(content).toContain('2026-09-18T12:01:00.000Z');
  });

  it('reads valid test snapshots from the simulator cache', async () => {
    mockFileExists = true;
    mockFileText = `${JSON.stringify(payload)}\n`;

    await expect(readQualityTestSnapshots()).resolves.toEqual([payload]);

    const file = fileSystem.File.mock.results.at(-1)?.value as { text: jest.Mock };
    expect(file.text).toHaveBeenCalledTimes(1);
  });

  it('treats a missing simulator cache file as an empty test result', async () => {
    await expect(readQualityTestSnapshots()).resolves.toEqual([]);
  });

  it('rejects malformed cache records instead of exposing partial data', async () => {
    mockFileExists = true;
    mockFileText = '{"captureKind":"maestro-preview-test"}\n';

    await expect(readQualityTestSnapshots()).rejects.toThrow(/fehlendes Feld|missing field/i);
  });

  it('rejects persistent-quality captures in the test cache', async () => {
    mockFileExists = true;
    mockFileText = `${JSON.stringify({ ...payload, captureKind: 'quality-snapshot' })}\n`;

    await expect(readQualityTestSnapshots()).rejects.toThrow('nicht unterstützten Capture-Typ');
  });
});
