/** Entscheidet in fester Reihenfolge ueber den Einstieg in den App-Bereich. */

export type AppEntryDecision =
  | { kind: 'warten' }
  | { kind: 'weiter' }
  | { kind: 'umleiten'; to: '/onboarding' | '/sign-in' | '/household/create' };

export function resolveAppEntry(input: {
  hasSession: boolean;
  hasSeenOnboarding: boolean;
  isLoading: boolean;
  shouldPromptOnboarding: boolean;
  householdCount: number;
  /** Trennt einen fehlgeschlagenen Request von einer leeren Haushaltsliste. */
  householdsError?: boolean;
}): AppEntryDecision {
  // Ohne Session hat `isLoading` keinen erreichbaren Zielzustand.
  if (!input.hasSession) {
    return { kind: 'umleiten', to: input.hasSeenOnboarding ? '/sign-in' : '/onboarding' };
  }

  // Fuer angemeldete Nutzer entscheidet das kontoweite Profil, nicht das Geraete-Flag.
  if (input.isLoading) return { kind: 'warten' };

  if (input.shouldPromptOnboarding) return { kind: 'umleiten', to: '/onboarding' };

  // Ein fehlgeschlagener Request ist kein Beleg fuer einen fehlenden Haushalt.
  if (input.householdsError) return { kind: 'warten' };

  if (input.householdCount === 0) return { kind: 'umleiten', to: '/household/create' };

  return { kind: 'weiter' };
}
