import type { SanitizedQualityPayload } from '../domain/quality-snapshot';

jest.mock('expo-file-system', () => ({
  File: jest.fn().mockImplementation(() => ({
    uri: 'file:///cache/fam-natural-language-addition-quality.jsonl',
    write: jest.fn(),
  })),
  Paths: { cache: 'file:///cache' },
}));

const { appendQualityTestSnapshot, QUALITY_TEST_RESULTS_FILE_NAME } =
  require('./quality-test-results') as typeof import('./quality-test-results');
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
  });

  it('appends exactly one sanitized payload line in the simulator cache', () => {
    appendQualityTestSnapshot(payload);

    expect(fileSystem.File).toHaveBeenCalledWith('file:///cache', QUALITY_TEST_RESULTS_FILE_NAME);
    const file = fileSystem.File.mock.results.at(-1)?.value as { write: jest.Mock };
    expect(file.write).toHaveBeenCalledTimes(1);
    expect(file.write).toHaveBeenCalledWith(`${JSON.stringify(payload)}\n`, { append: true });
  });
});
