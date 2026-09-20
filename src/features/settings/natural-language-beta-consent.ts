import {
  getNaturalLanguageAdditionBetaState,
  saveNaturalLanguageAdditionBetaState,
} from '@/features/shopping-list/stt-beta/beta-storage';
import { setBetaConsent } from '@/features/shopping-list/stt-beta/domain/consent';
import type { BetaConsentState } from '@/features/shopping-list/stt-beta/types';

export type NaturalLanguageBetaAutomaticApplicationConsent =
  BetaConsentState['automaticApplication'];

export type NaturalLanguageBetaConsentPort = {
  getAutomaticApplicationConsent: (
    userId: string,
  ) => Promise<NaturalLanguageBetaAutomaticApplicationConsent>;
  setAutomaticApplicationConsent: (
    userId: string,
    consent: Exclude<NaturalLanguageBetaAutomaticApplicationConsent, 'undecided'>,
  ) => Promise<void>;
};

export const naturalLanguageBetaConsentPort: NaturalLanguageBetaConsentPort = {
  getAutomaticApplicationConsent: async (userId) => {
    const state = await getNaturalLanguageAdditionBetaState(userId);
    return state.consent.automaticApplication;
  },
  setAutomaticApplicationConsent: async (userId, consent) => {
    const state = await getNaturalLanguageAdditionBetaState(userId);
    await saveNaturalLanguageAdditionBetaState(
      userId,
      setBetaConsent(state, 'automaticApplication', consent),
    );
  },
};
