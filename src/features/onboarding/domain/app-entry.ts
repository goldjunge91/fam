export type AppEntryDecision =
  | { kind: 'warten' }
  | { kind: 'fehler' }
  | { kind: 'weiter' }
  | { kind: 'umleiten'; to: '/onboarding' | '/sign-in' | '/household/create' };

export function resolveAppEntry(input: {
  hasSession: boolean;
  hasSeenOnboarding: boolean;
  isLoading: boolean;
  shouldPromptOnboarding: boolean;
  forceOnboarding?: boolean;
  householdCount: number;

  householdsError?: boolean;
}): AppEntryDecision {
  // Der explizite Entwicklungs-Override respektiert weiterhin das
  // Startup-Gate, überschreibt danach aber Session- und Geraetezustand.
  if (input.forceOnboarding) {
    if (input.isLoading) return { kind: 'warten' };
    if (input.householdsError) return { kind: 'fehler' };
    return { kind: 'umleiten', to: '/onboarding' };
  }

  // Ohne Session zuerst Onboarding oder Anmeldung öffnen.
  if (!input.hasSession) {
    return { kind: 'umleiten', to: input.hasSeenOnboarding ? '/sign-in' : '/onboarding' };
  }

  // Während des Ladens keine Haushaltsentscheidung treffen.
  if (input.isLoading) return { kind: 'warten' };

  // Fehler nicht als leeren Haushalt interpretieren oder stillschweigend
  // weiterladen. Die UI zeigt einen expliziten Retry-Zustand.
  if (input.householdsError) return { kind: 'fehler' };

  // Profil-Onboarding hat erst nach einem belastbaren Startzustand Vorrang
  // vor der Haushaltsauswahl.
  if (input.shouldPromptOnboarding) {
    return { kind: 'umleiten', to: '/onboarding' };
  }

  // Angemeldete Nutzer ohne Haushalt legen einen neuen Haushalt an.
  if (input.householdCount === 0) return { kind: 'umleiten', to: '/household/create' };

  return { kind: 'weiter' };
}
