import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import {
  QUALITY_COHORT_REPORT_FILE_NAMES,
  runQualityCohortReport,
} from '../../../../../scripts/quality-cohort-report';

const validSnapshot = {
  schemaVersion: 2,
  snapshotVersion: 1,
  metricDefinitionVersion: 1,
  captureKind: 'quality-snapshot',
  fixtureSetVersion: null,
  experimentVariant: 'baseline',
  createdAt: '2026-09-19T10:00:00.000Z',
  confirmedItemCount: 10,
  automaticAssignmentCount: 10,
  correctAutomaticAssignmentCount: 10,
  falseListAssignmentCount: 0,
  manualCorrectionCount: 0,
  durationSamplesMs: Array.from({ length: 10 }, () => 1_000),
  qualityFlags: {
    unparsedTextPresent: 0,
    ambiguousItemBoundary: 0,
    semanticItemMismatch: 0,
    incorrectAutomaticAssignment: 0,
    manualCorrection: 0,
  },
  metrics: {
    automaticAccuracyPercent: { value: 100, numerator: 10, denominator: 10, sampleCount: 10 },
    falseListPercent: { value: 0, numerator: 0, denominator: 10, sampleCount: 10 },
    manualCorrectionPercent: { value: 0, numerator: 0, denominator: 10, sampleCount: 10 },
    medianTimeToAddMs: { value: 1_000, numerator: null, denominator: null, sampleCount: 10 },
  },
};

describe('quality-cohort-report CLI', () => {
  let directory: string;

  beforeEach(async () => {
    directory = await mkdtemp(path.join(os.tmpdir(), 'fam-quality-cohort-report-'));
  });

  afterEach(async () => {
    await rm(directory, { recursive: true, force: true });
  });

  it('writes JSON, text and HTML reports from JSONL', async () => {
    const inputPath = path.join(directory, 'snapshots.jsonl');
    const outputDirectory = path.join(directory, 'report');
    await writeFile(inputPath, `${JSON.stringify(validSnapshot)}\n`, 'utf8');

    const report = await runQualityCohortReport(inputPath, outputDirectory);

    expect(report.snapshotCount).toBe(1);
    expect(
      JSON.parse(
        await readFile(path.join(outputDirectory, QUALITY_COHORT_REPORT_FILE_NAMES.json), 'utf8'),
      ),
    ).toMatchObject({ snapshotCount: 1 });
    expect(
      await readFile(path.join(outputDirectory, QUALITY_COHORT_REPORT_FILE_NAMES.text), 'utf8'),
    ).toContain('Automatische Genauigkeit');
    expect(
      await readFile(path.join(outputDirectory, QUALITY_COHORT_REPORT_FILE_NAMES.html), 'utf8'),
    ).toContain('&quot;reportSchemaVersion&quot;');
  });
});
