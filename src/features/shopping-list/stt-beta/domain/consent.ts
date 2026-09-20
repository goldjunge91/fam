import type { BetaConsentState, BetaStorageState } from '../types';
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
  return {
    ...state,
    consent: {
      ...state.consent,
      [key]: value,
    },
  };
}
