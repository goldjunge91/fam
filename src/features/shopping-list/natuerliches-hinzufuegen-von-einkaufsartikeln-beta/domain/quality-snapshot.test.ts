import { createEmptyBetaQualityMetrics } from './quality-metrics';
import { type QualitySnapshotInput, sanitizeQualitySnapshot } from './quality-snapshot';

function snapshotInput(): QualitySnapshotInput {
  const metrics = createEmptyBetaQualityMetrics();

  return {
    metrics: {
      ...metrics,
      confirmedItemCount: 2,
      automaticAssignmentCount: 2,
      correctAutomaticAssignmentCount: 1,
      falseListAssignmentCount: 1,
      manualCorrectionCount: 1,
      qualityFlagCounts: {
        unparsed_text_present: 1,
        ambiguous_item_boundary: 0,
        semantic_item_mismatch: 1,
        incorrect_automatic_assignment: 1,
        manual_correction: 1,
      },
      completionDurationsMs: [1_000, Number.NaN, Number.POSITIVE_INFINITY, 3_000, -1],
      recordedObservationIds: ['observation-sensitive'],
      measuredSessionIds: ['session-sensitive'],
    },
    captureKind: 'quality-snapshot',
    fixtureSetVersion: '20-saetze-neu-v1',
    experimentVariant: 'baseline',
    createdAt: '2026-09-18T10:00:00.000Z',
  };
}

describe('sanitizeQualitySnapshot', () => {
  it('returns only the approved versioned structure and bounded finite samples', () => {
    const payload = sanitizeQualitySnapshot(snapshotInput());

    expect(payload).toEqual({
      schemaVersion: 2,
      snapshotVersion: 1,
      metricDefinitionVersion: 1,
      captureKind: 'quality-snapshot',
      fixtureSetVersion: '20-saetze-neu-v1',
      experimentVariant: 'baseline',
      createdAt: '2026-09-18T10:00:00.000Z',
      confirmedItemCount: 2,
      automaticAssignmentCount: 2,
      correctAutomaticAssignmentCount: 1,
      falseListAssignmentCount: 1,
      manualCorrectionCount: 1,
      durationSamplesMs: [1_000, 3_000],
      qualityFlags: {
        unparsedTextPresent: 1,
        ambiguousItemBoundary: 0,
        semanticItemMismatch: 1,
        incorrectAutomaticAssignment: 1,
        manualCorrection: 1,
      },
      metrics: {
        automaticAccuracyPercent: {
          value: 50,
          numerator: 1,
          denominator: 2,
          sampleCount: 2,
        },
        falseListPercent: {
          value: 50,
          numerator: 1,
          denominator: 2,
          sampleCount: 2,
        },
        manualCorrectionPercent: {
          value: 50,
          numerator: 1,
          denominator: 2,
          sampleCount: 2,
        },
        medianTimeToAddMs: {
          value: 2_000,
          numerator: null,
          denominator: null,
          sampleCount: 2,
        },
      },
    });

    expect(payload && Object.keys(payload).sort()).toEqual([
      'automaticAssignmentCount',
      'captureKind',
      'confirmedItemCount',
      'correctAutomaticAssignmentCount',
      'createdAt',
      'durationSamplesMs',
      'experimentVariant',
      'falseListAssignmentCount',
      'fixtureSetVersion',
      'manualCorrectionCount',
      'metricDefinitionVersion',
      'metrics',
      'qualityFlags',
      'schemaVersion',
      'snapshotVersion',
    ]);
    expect(JSON.stringify(payload)).not.toContain('observation-sensitive');
    expect(JSON.stringify(payload)).not.toContain('session-sensitive');
    expect(JSON.stringify(payload)).not.toContain('transcript');
    expect(JSON.stringify(payload)).not.toContain('audio');
  });

  it('caps duration samples at the newest 64 valid values', () => {
    const input = snapshotInput();
    const payload = sanitizeQualitySnapshot({
      ...input,
      metrics: {
        ...input.metrics,
        completionDurationsMs: Array.from({ length: 70 }, (_, index) => index),
      },
    });

    expect(payload?.durationSamplesMs).toHaveLength(64);
    expect(payload?.durationSamplesMs[0]).toBe(6);
    expect(payload?.durationSamplesMs.at(-1)).toBe(69);
  });

  it('returns null for invalid capture metadata', () => {
    expect(sanitizeQualitySnapshot({ ...snapshotInput(), createdAt: 'not-a-date' })).toBeNull();
  });
});
