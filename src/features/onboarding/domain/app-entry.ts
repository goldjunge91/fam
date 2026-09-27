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
  profileError?: boolean;
}): AppEntryDecision {
  // Der explizite Entwicklungs-Override respektiert weiterhin das
  // Startup-Gate, überschreibt danach aber Session- und Geraetezustand.
  if (input.forceOnboarding) {
    if (input.isLoading) return { kind: 'warten' };
    if (input.householdsError && input.householdCount === 0) return { kind: 'fehler' };
    return { kind: 'umleiten', to: '/onboarding' };
  }

  // Ohne Session zuerst Onboarding oder Anmeldung öffnen.
  if (!input.hasSession) {
    return { kind: 'umleiten', to: input.hasSeenOnboarding ? '/sign-in' : '/onboarding' };
  }

  // Während des Ladens keine Haushaltsentscheidung treffen.
  if (input.isLoading) return { kind: 'warten' };

  // Profilfehler gehören nicht zum Offline-Fallback des Haushalts-Pulls.
  if (input.profileError) return { kind: 'fehler' };

  // Ohne lokalen Haushalt kann ein Fehler nicht sicher von einem leeren
  // Haushalt unterschieden werden. Mit lokalem Bestand bleibt Offline-Start
  // möglich; der Bootstrap-Pull synchronisiert später erneut.
  if (input.householdsError && input.householdCount === 0) return { kind: 'fehler' };

  // Profil-Onboarding hat erst nach einem belastbaren Startzustand Vorrang
  // vor der Haushaltsauswahl.
  if (input.shouldPromptOnboarding) {
    return { kind: 'umleiten', to: '/onboarding' };
  }

  // Angemeldete Nutzer ohne Haushalt legen einen neuen Haushalt an.
  if (input.householdCount === 0) return { kind: 'umleiten', to: '/household/create' };

  return { kind: 'weiter' };
}
