import { createEmptyNaturalLanguageAdditionBetaState } from '../beta-storage';
import type { BetaFeedbackEvent } from '../types';
import {
  canAutomaticallyApplyLearning,
  recordBetaFeedback,
  setBetaConsent,
  shouldAskForAutomaticApplication,
} from './consent';

describe('natural-language addition beta consent', () => {
  it('asks only after the unique-assignment threshold while consent is undecided', () => {
    const consent = {
      qualityMetrics: 'undecided' as const,
      contentData: 'undecided' as const,
      automaticApplication: 'undecided' as const,
    };

    expect(
      shouldAskForAutomaticApplication({
        progress: { uniqueAssignments: 9, thresholdReached: false },
        consent,
      }),
    ).toBe(false);
    expect(
      shouldAskForAutomaticApplication({
        progress: { uniqueAssignments: 10, thresholdReached: true },
        consent,
      }),
    ).toBe(true);
  });

  it('does not ask again after the user grants or revokes automatic application', () => {
    const progress = { uniqueAssignments: 12, thresholdReached: true };

    expect(
      shouldAskForAutomaticApplication({
        progress,
        consent: {
          qualityMetrics: 'undecided',
          contentData: 'undecided',
          automaticApplication: 'granted',
        },
      }),
    ).toBe(false);
    expect(
      shouldAskForAutomaticApplication({
        progress,
        consent: {
          qualityMetrics: 'undecided',
          contentData: 'undecided',
          automaticApplication: 'revoked',
        },
      }),
    ).toBe(false);
  });

  it('allows learned routing only for an explicitly granted user consent', () => {
    expect(canAutomaticallyApplyLearning({ automaticApplication: 'undecided' })).toBe(false);
    expect(canAutomaticallyApplyLearning({ automaticApplication: 'revoked' })).toBe(false);
    expect(canAutomaticallyApplyLearning({ automaticApplication: 'granted' })).toBe(true);
  });

  it('updates one consent without changing the other consent dimensions', () => {
    const state = createEmptyNaturalLanguageAdditionBetaState();
    const nextState = setBetaConsent(state, 'automaticApplication', 'revoked');

    expect(nextState.consent).toEqual({
      qualityMetrics: 'undecided',
      contentData: 'undecided',
      automaticApplication: 'revoked',
    });
    expect(state.consent.automaticApplication).toBe('undecided');
  });

  it('clears locally aggregated quality metrics when quality consent is revoked', () => {
    const state = {
      ...createEmptyNaturalLanguageAdditionBetaState(),
      consent: {
        qualityMetrics: 'granted' as const,
        contentData: 'granted' as const,
        automaticApplication: 'undecided' as const,
      },
      qualityMetrics: {
        ...createEmptyNaturalLanguageAdditionBetaState().qualityMetrics,
        confirmedItemCount: 4,
      },
    };

    const nextState = setBetaConsent(state, 'qualityMetrics', 'revoked');

    expect(nextState.qualityMetrics.confirmedItemCount).toBe(0);
    expect(nextState.consent.contentData).toBe('granted');
  });

  it('keeps feedback separate, local, and idempotent by event id', () => {
    const state = createEmptyNaturalLanguageAdditionBetaState();
    const event: BetaFeedbackEvent = {
      id: 'feedback-1',
      sessionId: 'session-1',
      kind: 'corrected',
      createdAt: '2026-09-18T12:00:00.000Z',
    };

    const once = recordBetaFeedback(state, event);
    const twice = recordBetaFeedback(once, event);

    expect(once.feedback).toEqual([event]);
    expect(twice.feedback).toEqual([event]);
    expect(twice.confirmations).toEqual([]);
    expect(twice.consent).toEqual(once.consent);
  });
});
