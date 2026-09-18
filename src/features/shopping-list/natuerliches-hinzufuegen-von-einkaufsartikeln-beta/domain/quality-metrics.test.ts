import { createEmptyNaturalLanguageAdditionBetaState } from '../beta-storage';
import type { BetaStorageState } from '../types';
import {
  buildBetaQualityPayload,
  getBetaQualityMetricSnapshot,
  recordBetaQualityObservations,
} from './quality-metrics';

function grantedState(): BetaStorageState {
  const state = createEmptyNaturalLanguageAdditionBetaState();
  return {
    ...state,
    consent: { ...state.consent, qualityMetrics: 'granted' },
  };
}

describe('natural-language addition beta quality metrics', () => {
  it('keeps quality observations local when quality consent is not granted', () => {
    const state = createEmptyNaturalLanguageAdditionBetaState();

    const nextState = recordBetaQualityObservations(state, [
      {
        id: 'observation-1',
        sessionId: 'session-1',
        predictedAutomatically: true,
        assignmentCorrect: true,
        manuallyCorrected: false,
        durationMs: 4_000,
      },
    ]);

    expect(nextState).toBe(state);
    expect(nextState.qualityMetrics.confirmedItemCount).toBe(0);
    expect(buildBetaQualityPayload(nextState)).toBeNull();
  });

  it('aggregates accuracy, false-list assignments, corrections, and median time', () => {
    let state = grantedState();
    state = recordBetaQualityObservations(state, [
      {
        id: 'observation-1',
        sessionId: 'session-1',
        predictedAutomatically: true,
        assignmentCorrect: true,
        manuallyCorrected: false,
        durationMs: 5_000,
      },
      {
        id: 'observation-2',
        sessionId: 'session-1',
        predictedAutomatically: false,
        assignmentCorrect: false,
        manuallyCorrected: true,
        durationMs: 5_000,
      },
      {
        id: 'observation-3',
        sessionId: 'session-2',
        predictedAutomatically: true,
        assignmentCorrect: false,
        manuallyCorrected: true,
        durationMs: 7_000,
      },
    ]);

    expect(getBetaQualityMetricSnapshot(state.qualityMetrics)).toEqual({
      automaticAccuracyPercent: 50,
      falseListPercent: 50,
      manualCorrectionPercent: expect.closeTo(66.6666666667, 10),
      medianTimeToAddMs: 6_000,
    });
    expect(
      recordBetaQualityObservations(state, [
        {
          id: 'observation-3',
          sessionId: 'session-2',
          predictedAutomatically: true,
          assignmentCorrect: false,
          manuallyCorrected: true,
          durationMs: 7_000,
        },
      ]),
    ).toBe(state);
  });

  it('builds an aggregate payload without content or identifiers', () => {
    const state = recordBetaQualityObservations(grantedState(), [
      {
        id: 'observation-haferdrink',
        sessionId: 'session-with-shopping-content',
        predictedAutomatically: true,
        assignmentCorrect: true,
        manuallyCorrected: false,
        durationMs: 3_000,
      },
    ]);

    const payload = buildBetaQualityPayload(state);

    expect(payload).toEqual({
      schemaVersion: 1,
      confirmedItemCount: 1,
      automaticAssignmentCount: 1,
      automaticAccuracyPercent: 100,
      falseListPercent: 0,
      manualCorrectionPercent: 0,
      medianTimeToAddMs: 3_000,
    });
    expect(JSON.stringify(payload)).not.toContain('Haferdrink');
    expect(JSON.stringify(payload)).not.toContain('session-with-shopping-content');
    expect(JSON.stringify(payload)).not.toContain('audio');
    expect(JSON.stringify(payload)).not.toContain('transcript');
  });

  it('does not require content consent for an aggregate quality payload', () => {
    const state = recordBetaQualityObservations(
      {
        ...grantedState(),
        consent: { ...grantedState().consent, contentData: 'revoked' },
      },
      [
        {
          id: 'observation-1',
          sessionId: 'session-1',
          predictedAutomatically: true,
          assignmentCorrect: true,
          manuallyCorrected: false,
          durationMs: 1_000,
        },
      ],
    );

    expect(buildBetaQualityPayload(state)).not.toBeNull();
  });

  it('bounds the local duration sample while keeping aggregate counters', () => {
    const observations = Array.from({ length: 70 }, (_, index) => ({
      id: `observation-${index}`,
      sessionId: `session-${index}`,
      predictedAutomatically: true,
      assignmentCorrect: true,
      manuallyCorrected: false,
      durationMs: index * 100,
    }));
    const state = recordBetaQualityObservations(grantedState(), observations);

    expect(state.qualityMetrics.confirmedItemCount).toBe(70);
    expect(state.qualityMetrics.completionDurationsMs).toHaveLength(64);
    expect(state.qualityMetrics.completionDurationsMs.at(0)).toBe(600);
    expect(state.qualityMetrics.completionDurationsMs.at(-1)).toBe(6_900);
  });
});
