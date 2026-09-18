import {
  getNaturalLanguageAdditionBetaState,
  saveNaturalLanguageAdditionBetaState,
} from '@/features/shopping-list/natuerliches-hinzufuegen-von-einkaufsartikeln-beta/beta-storage';
import { setBetaConsent } from '@/features/shopping-list/natuerliches-hinzufuegen-von-einkaufsartikeln-beta/domain/consent';
import type { BetaConsentState } from '@/features/shopping-list/natuerliches-hinzufuegen-von-einkaufsartikeln-beta/types';

export type NaturalLanguageBetaAutomaticApplicationConsent = 'undecided' | 'granted' | 'revoked';
export type NaturalLanguageBetaConsentDimension = keyof BetaConsentState;
export type NaturalLanguageBetaConsentValue = BetaConsentState[NaturalLanguageBetaConsentDimension];

/**
 * Kleine Import-Grenze fuer die Settings-UI.
 *
 * Die UI kennt dadurch die drei getrennten Beta-Dimensionen und beruehrt
 * weder Feedback noch produktive Einstellungen. Die Zustandsaenderung laeuft
 * ueber die vorhandene Domain-Funktion `domain/consent.ts`.
 */
export type NaturalLanguageBetaConsentPort = {
  getAutomaticApplicationConsent: (
    userId: string,
  ) => Promise<NaturalLanguageBetaAutomaticApplicationConsent>;
  setAutomaticApplicationConsent: (
    userId: string,
    consent: Exclude<NaturalLanguageBetaAutomaticApplicationConsent, 'undecided'>,
  ) => Promise<void>;
  getQualityMetricsConsent: (userId: string) => Promise<NaturalLanguageBetaConsentValue>;
  setQualityMetricsConsent: (
    userId: string,
    consent: Exclude<NaturalLanguageBetaConsentValue, 'undecided'>,
  ) => Promise<void>;
  getContentDataConsent: (userId: string) => Promise<NaturalLanguageBetaConsentValue>;
  setContentDataConsent: (
    userId: string,
    consent: Exclude<NaturalLanguageBetaConsentValue, 'undecided'>,
  ) => Promise<void>;
};

async function getConsent(
  userId: string,
  dimension: NaturalLanguageBetaConsentDimension,
): Promise<NaturalLanguageBetaConsentValue> {
  const state = await getNaturalLanguageAdditionBetaState(userId);
  return state.consent[dimension];
}

async function setConsent(
  userId: string,
  dimension: NaturalLanguageBetaConsentDimension,
  consent: Exclude<NaturalLanguageBetaConsentValue, 'undecided'>,
): Promise<void> {
  const state = await getNaturalLanguageAdditionBetaState(userId);
  await saveNaturalLanguageAdditionBetaState(userId, setBetaConsent(state, dimension, consent));
}

export const naturalLanguageBetaConsentPort: NaturalLanguageBetaConsentPort = {
  getAutomaticApplicationConsent: (userId) => getConsent(userId, 'automaticApplication'),
  setAutomaticApplicationConsent: (userId, consent) =>
    setConsent(userId, 'automaticApplication', consent),
  getQualityMetricsConsent: (userId) => getConsent(userId, 'qualityMetrics'),
  setQualityMetricsConsent: (userId, consent) => setConsent(userId, 'qualityMetrics', consent),
  getContentDataConsent: (userId) => getConsent(userId, 'contentData'),
  setContentDataConsent: (userId, consent) => setConsent(userId, 'contentData', consent),
};
