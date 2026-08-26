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

  householdsError?: boolean;
}): AppEntryDecision {
  // Ohne Session zuerst Onboarding oder Anmeldung öffnen.
  if (!input.hasSession) {
    return { kind: 'umleiten', to: input.hasSeenOnboarding ? '/sign-in' : '/onboarding' };
  }

  // Während des Ladens keine Haushaltsentscheidung treffen.
  if (input.isLoading) return { kind: 'warten' };

  // Profil-Onboarding hat Vorrang vor der Haushaltsauswahl.
  if (input.shouldPromptOnboarding) return { kind: 'umleiten', to: '/onboarding' };

  // Fehler nicht als leeren Haushalt interpretieren.
  if (input.householdsError) return { kind: 'warten' };

  // Angemeldete Nutzer ohne Haushalt legen einen neuen Haushalt an.
  if (input.householdCount === 0) return { kind: 'umleiten', to: '/household/create' };

  return { kind: 'weiter' };
}
