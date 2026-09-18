import type { BetaConsentState, BetaFeedbackEvent, BetaStorageState } from '../types';
import { createEmptyBetaQualityMetrics } from './quality-metrics';
import type { ShoppingLearningProgress } from './routing';

export type BetaConsentKey = keyof BetaConsentState;

type ConsentValue = BetaConsentState[BetaConsentKey];

export function shouldAskForAutomaticApplication(input: {
  progress: ShoppingLearningProgress;
  consent: BetaConsentState;
}): boolean {
  return input.progress.thresholdReached && input.consent.automaticApplication === 'undecided';
}

export function canAutomaticallyApplyLearning(
  consent: Pick<BetaConsentState, 'automaticApplication'>,
): boolean {
  return consent.automaticApplication === 'granted';
}

export function setBetaConsent(
  state: BetaStorageState,
  key: BetaConsentKey,
  value: ConsentValue,
): BetaStorageState {
  const nextState = {
    ...state,
    consent: {
      ...state.consent,
      [key]: value,
    },
  };

  if (key === 'qualityMetrics' && value === 'revoked') {
    return { ...nextState, qualityMetrics: createEmptyBetaQualityMetrics() };
  }

  return nextState;
}

export function recordBetaFeedback(
  state: BetaStorageState,
  event: BetaFeedbackEvent,
): BetaStorageState {
  if (state.feedback.some((existing) => existing.id === event.id)) return state;
  return {
    ...state,
    feedback: [...state.feedback, event],
  };
}
