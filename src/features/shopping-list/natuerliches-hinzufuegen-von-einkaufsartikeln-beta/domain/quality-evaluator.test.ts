import { DEFAULT_MINIMUM_QUALITY_SAMPLE_COUNT, evaluateQualitySnapshot } from './quality-evaluator';
import type { SanitizedQualityPayload } from './quality-snapshot';

function payload(
  metricOverrides: Partial<SanitizedQualityPayload['metrics']> = {},
): SanitizedQualityPayload {
  return {
    schemaVersion: 2,
    snapshotVersion: 1,
    metricDefinitionVersion: 1,
    captureKind: 'quality-snapshot',
    fixtureSetVersion: 'fixture-v1',
    experimentVariant: 'baseline',
    createdAt: '2026-09-18T10:00:00.000Z',
    confirmedItemCount: 20,
    automaticAssignmentCount: 20,
    correctAutomaticAssignmentCount: 19,
    falseListAssignmentCount: 1,
    manualCorrectionCount: 2,
    durationSamplesMs: [4_000, 5_000, 6_000, 7_000, 8_000, 5_000, 5_000, 5_000, 5_000, 5_000],
    qualityFlags: {
      unparsedTextPresent: 0,
      ambiguousItemBoundary: 0,
      semanticItemMismatch: 0,
      incorrectAutomaticAssignment: 1,
      manualCorrection: 2,
    },
    metrics: {
      automaticAccuracyPercent: {
        value: 95,
        numerator: 19,
        denominator: 20,
        sampleCount: 20,
      },
      falseListPercent: {
        value: 5,
        numerator: 1,
        denominator: 20,
        sampleCount: 20,
      },
      manualCorrectionPercent: {
        value: 10,
        numerator: 2,
        denominator: 20,
        sampleCount: 20,
      },
      medianTimeToAddMs: {
        value: 5_000,
        numerator: null,
        denominator: null,
        sampleCount: 10,
      },
      ...metricOverrides,
    },
  };
}

describe('evaluateQualitySnapshot', () => {
  it('evaluates all four metrics with their target direction and basis', () => {
    const result = evaluateQualitySnapshot(payload());

    expect(result.automaticAccuracyPercent).toMatchObject({
      value: 95,
      targetValue: 95,
      targetDirection: 'atLeast',
      numerator: 19,
      denominator: 20,
      sampleCount: 20,
      minimumSampleCount: DEFAULT_MINIMUM_QUALITY_SAMPLE_COUNT,
      status: 'pass',
    });
    expect(result.falseListPercent.status).toBe('fail');
    expect(result.manualCorrectionPercent.status).toBe('pass');
    expect(result.medianTimeToAddMs).toMatchObject({
      value: 5_000,
      unit: 'milliseconds',
      targetValue: 6_000,
      targetDirection: 'atMost',
      numerator: null,
      denominator: null,
      sampleCount: 10,
      status: 'pass',
    });
  });

  it('keeps a measured zero distinct from missing data', () => {
    const result = evaluateQualitySnapshot(
      payload({
        falseListPercent: {
          value: 0,
          numerator: 0,
          denominator: 10,
          sampleCount: 10,
        },
        manualCorrectionPercent: {
          value: null,
          numerator: 0,
          denominator: 0,
          sampleCount: 0,
        },
        medianTimeToAddMs: {
          value: 0,
          numerator: null,
          denominator: null,
          sampleCount: 10,
        },
      }),
    );

    expect(result.falseListPercent).toMatchObject({ value: 0, status: 'pass' });
    expect(result.manualCorrectionPercent.status).toBe('unavailable');
    expect(result.medianTimeToAddMs).toMatchObject({ value: 0, status: 'pass' });
  });

  it('shows measured values as insufficient below the minimum sample count', () => {
    const result = evaluateQualitySnapshot(
      payload({
        automaticAccuracyPercent: {
          value: 100,
          numerator: 9,
          denominator: 9,
          sampleCount: 9,
        },
        falseListPercent: {
          value: 0,
          numerator: 0,
          denominator: 9,
          sampleCount: 9,
        },
        manualCorrectionPercent: {
          value: 0,
          numerator: 0,
          denominator: 9,
          sampleCount: 9,
        },
        medianTimeToAddMs: {
          value: 1_000,
          numerator: null,
          denominator: null,
          sampleCount: 9,
        },
      }),
    );

    expect(result.automaticAccuracyPercent).toMatchObject({ value: 100, status: 'insufficient' });
    expect(result.falseListPercent.status).toBe('insufficient');
    expect(result.manualCorrectionPercent.status).toBe('insufficient');
    expect(result.medianTimeToAddMs.status).toBe('insufficient');
  });

  it('does not pass an invalid or inconsistent metric snapshot', () => {
    const result = evaluateQualitySnapshot(
      payload({
        automaticAccuracyPercent: {
          value: 101,
          numerator: 21,
          denominator: 20,
          sampleCount: 20,
        },
        falseListPercent: {
          value: Number.NaN,
          numerator: 0,
          denominator: 20,
          sampleCount: 20,
        },
        medianTimeToAddMs: {
          value: -1,
          numerator: null,
          denominator: null,
          sampleCount: 20,
        },
      }),
    );

    expect(result.automaticAccuracyPercent.status).toBe('unavailable');
    expect(result.falseListPercent.status).toBe('unavailable');
    expect(result.medianTimeToAddMs.status).toBe('unavailable');
    expect(
      [result.automaticAccuracyPercent, result.falseListPercent, result.medianTimeToAddMs].some(
        (metric) => metric.status === 'pass',
      ),
    ).toBe(false);
  });

  it('rejects a percentage that disagrees with its counters', () => {
    const result = evaluateQualitySnapshot(
      payload({
        automaticAccuracyPercent: {
          value: 100,
          numerator: 0,
          denominator: 20,
          sampleCount: 20,
        },
      }),
    );

    expect(result.automaticAccuracyPercent.status).toBe('unavailable');
  });
});
