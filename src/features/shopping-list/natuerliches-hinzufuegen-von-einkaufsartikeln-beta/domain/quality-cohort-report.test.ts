import type { BetaQualityMetrics } from '../types';
import {
  buildQualityCohortReport,
  parseQualitySnapshotInput,
  renderQualityCohortText,
} from './quality-cohort-report';
import { getBetaQualityMetricSnapshots } from './quality-metrics';
import type { SanitizedQualityPayload } from './quality-snapshot';
import type { ExperimentVariant } from './speech-experiment';

function snapshot(
  overrides: Partial<BetaQualityMetrics> = {},
  metadata: Partial<Pick<SanitizedQualityPayload, 'experimentVariant' | 'fixtureSetVersion'>> = {},
): SanitizedQualityPayload {
  const metrics: BetaQualityMetrics = {
    confirmedItemCount: 10,
    automaticAssignmentCount: 10,
    correctAutomaticAssignmentCount: 10,
    falseListAssignmentCount: 0,
    manualCorrectionCount: 0,
    qualityFlagCounts: {
      unparsed_text_present: 0,
      ambiguous_item_boundary: 0,
      semantic_item_mismatch: 0,
      incorrect_automatic_assignment: 0,
      manual_correction: 0,
    },
    completionDurationsMs: Array.from({ length: 10 }, () => 1_000),
    recordedObservationIds: [],
    measuredSessionIds: [],
    ...overrides,
  };

  return {
    schemaVersion: 2,
    snapshotVersion: 1,
    metricDefinitionVersion: 1,
    captureKind: 'quality-snapshot',
    fixtureSetVersion: metadata.fixtureSetVersion ?? null,
    experimentVariant: metadata.experimentVariant ?? 'baseline',
    createdAt: '2026-09-19T10:00:00.000Z',
    confirmedItemCount: metrics.confirmedItemCount,
    automaticAssignmentCount: metrics.automaticAssignmentCount,
    correctAutomaticAssignmentCount: metrics.correctAutomaticAssignmentCount,
    falseListAssignmentCount: metrics.falseListAssignmentCount,
    manualCorrectionCount: metrics.manualCorrectionCount,
    durationSamplesMs: metrics.completionDurationsMs,
    qualityFlags: {
      unparsedTextPresent: metrics.qualityFlagCounts.unparsed_text_present,
      ambiguousItemBoundary: metrics.qualityFlagCounts.ambiguous_item_boundary,
      semanticItemMismatch: metrics.qualityFlagCounts.semantic_item_mismatch,
      incorrectAutomaticAssignment: metrics.qualityFlagCounts.incorrect_automatic_assignment,
      manualCorrection: metrics.qualityFlagCounts.manual_correction,
    },
    metrics: getBetaQualityMetricSnapshots(metrics),
  };
}

describe('quality-cohort-report', () => {
  it('accepts one JSON object, a JSON array and JSONL', () => {
    const first = snapshot();
    const second = snapshot({ confirmedItemCount: 20, completionDurationsMs: [2_000] });

    expect(parseQualitySnapshotInput(JSON.stringify(first))).toHaveLength(1);
    expect(parseQualitySnapshotInput(JSON.stringify([first, second]))).toHaveLength(2);
    expect(
      parseQualitySnapshotInput(`${JSON.stringify(first)}\n${JSON.stringify(second)}\n`),
    ).toHaveLength(2);
    expect(parseQualitySnapshotInput('  \n')).toEqual([]);
  });

  it('rejects unknown private fields and inconsistent metric snapshots', () => {
    expect(() =>
      parseQualitySnapshotInput(JSON.stringify({ ...snapshot(), userId: 'private' })),
    ).toThrow(/unbekannt|unknown|unerlaubt/i);

    const invalid = snapshot();
    invalid.metrics.automaticAccuracyPercent.value = 12;
    expect(() => parseQualitySnapshotInput(JSON.stringify(invalid))).toThrow(
      /inkonsistent|inconsistent/i,
    );

    const invalidCounter = snapshot({
      automaticAssignmentCount: 1,
      correctAutomaticAssignmentCount: 2,
    });
    expect(() => parseQualitySnapshotInput(JSON.stringify(invalidCounter))).toThrow(
      /überschreiten|exceed/i,
    );

    const invalidConfirmedCounter = snapshot({
      confirmedItemCount: 1,
      automaticAssignmentCount: 2,
      correctAutomaticAssignmentCount: 1,
      falseListAssignmentCount: 1,
    });
    expect(() => parseQualitySnapshotInput(JSON.stringify(invalidConfirmedCounter))).toThrow(
      /bestätigte Artikel|confirmed/i,
    );

    const invalidAutomaticBreakdown = snapshot({
      automaticAssignmentCount: 2,
      correctAutomaticAssignmentCount: 2,
      falseListAssignmentCount: 1,
    });
    expect(() => parseQualitySnapshotInput(JSON.stringify(invalidAutomaticBreakdown))).toThrow(
      /automatische Zuordnungen|automatic/i,
    );

    const incompleteAutomaticBreakdown = snapshot({
      automaticAssignmentCount: 2,
      correctAutomaticAssignmentCount: 1,
      falseListAssignmentCount: 0,
    });
    expect(() => parseQualitySnapshotInput(JSON.stringify(incompleteAutomaticBreakdown))).toThrow(
      /vollständig|complete|automatische Zuordnungen/i,
    );
  });

  it('marks an empty cohort unavailable instead of treating it as a pass', () => {
    const report = buildQualityCohortReport([]);

    expect(report).toMatchObject({
      snapshotCount: 0,
      overallStatus: 'unavailable',
      dataQuality: { sufficientSampleForAllMetrics: false },
    });
    expect(renderQualityCohortText(report)).toContain('Keine Snapshots');
  });

  it('aggregates counters with weights instead of averaging percentages', () => {
    const report = buildQualityCohortReport([
      snapshot(),
      snapshot({
        automaticAssignmentCount: 90,
        correctAutomaticAssignmentCount: 45,
        falseListAssignmentCount: 45,
        manualCorrectionCount: 5,
      }),
    ]);

    expect(report.aggregation.automaticAssignmentCount).toBe(100);
    expect(report.aggregation.manualCorrectionCount).toBe(5);
    expect(report.metrics.automaticAccuracyPercent).toMatchObject({
      numerator: 55,
      denominator: 100,
      status: 'fail',
    });
    expect(report.metrics.automaticAccuracyPercent.value).toBeCloseTo(55, 10);
    expect(report.metrics.falseListPercent).toMatchObject({
      value: 45,
      numerator: 45,
      denominator: 100,
      status: 'fail',
    });
    expect(report.metrics.automaticAccuracyPercent.value).not.toBeCloseTo(75, 10);
  });

  it('keeps small samples insufficient and missing denominators unavailable', () => {
    const small = buildQualityCohortReport([
      snapshot({
        confirmedItemCount: 2,
        automaticAssignmentCount: 2,
        correctAutomaticAssignmentCount: 2,
        completionDurationsMs: [500],
      }),
    ]);
    expect(small.overallStatus).toBe('insufficient');
    expect(small.metrics.automaticAccuracyPercent.status).toBe('insufficient');

    const missing = buildQualityCohortReport([
      snapshot({
        automaticAssignmentCount: 0,
        correctAutomaticAssignmentCount: 0,
        falseListAssignmentCount: 0,
      }),
    ]);
    expect(missing.metrics.automaticAccuracyPercent.status).toBe('unavailable');
    expect(missing.metrics.falseListPercent.status).toBe('unavailable');
  });

  it('rejects mixed capture types, experiment variants and fixture sets', () => {
    const contextualVariant: ExperimentVariant = 'contextual-strings';

    expect(() =>
      buildQualityCohortReport([
        snapshot(),
        snapshot({}, { experimentVariant: contextualVariant }),
      ]),
    ).toThrow(/Experiment-Varianten|variant/i);

    expect(() =>
      buildQualityCohortReport([
        snapshot({}, { fixtureSetVersion: 'fixture-a' }),
        snapshot({}, { fixtureSetVersion: 'fixture-b' }),
      ]),
    ).toThrow(/Fixture-Sets|fixture/i);

    expect(() =>
      buildQualityCohortReport([
        snapshot(),
        { ...snapshot(), captureKind: 'maestro-preview-test' },
      ]),
    ).toThrow(/Capture-Typ|capture/i);
  });
});
