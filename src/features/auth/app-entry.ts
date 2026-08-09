/**
 * Was beim Betreten des angemeldeten Bereichs passieren soll.
 *
 * Als reine Funktion, weil die Reihenfolge der Regeln hier die eigentliche
 * Aussage ist — und weil genau daran ein Fehler hing: Ohne die Session-Regel
 * landete ein neu installierter, nicht angemeldeter Nutzer im
 * Haushalt-anlegen-Formular und bekam beim Absenden
 * `permission denied for function create_household`. Der RPC ist nur an
 * `authenticated` vergeben (siehe `supabase/schemas/04_privileges.sql`), der
 * Aufruf lief also als `anon`.
 *
 * Verdeckt wurde das von `EXPO_PUBLIC_FORCE_ONBOARDING=true`: Damit war
 * `shouldPromptOnboarding` immer wahr und hat vor der Haushalts-Weiche nach
 * `/onboarding` umgeleitet. Ohne das Flag fiel der Fall durch.
 */

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
}): AppEntryDecision {
  // Regel 1: In den angemeldeten Bereich gehoert nur, wer angemeldet ist. Das
  // Root-Layout laesst die Gruppe fuer neu installierte Geraete offen
  // (`!!session || isNewUser`), damit das Onboarding ueberhaupt erreichbar
  // ist; es leitet aber niemanden dorthin. Das passiert hier.
  //
  // Wohin, haengt daran, ob das Geraet die App schon kennt: Ein neu
  // installiertes Geraet startet im Onboarding (dort ist auch die
  // Registrierung), ein bekanntes zeigt den Anmelde-Bildschirm.
  //
  // Bewusst vor `isLoading`: Ohne Session gibt es nichts zu laden, auf das zu
  // warten sich lohnte. Ein Ladezustand waere hier eine Sackgasse.
  if (!input.hasSession) {
    return { kind: 'umleiten', to: input.hasSeenOnboarding ? '/sign-in' : '/onboarding' };
  }

  // Bewusst KEINE Regel "wer das Onboarding nie gesehen hat, muss durch" fuer
  // angemeldete Nutzer. Das SecureStore-Flag dahinter setzt ausschliesslich
  // `persistOnboardingCompleted()` am Ende des Flows — wessen Konto auf einem
  // anderen Weg entstanden ist (oder vor Einfuehrung des Flags), hat es nie
  // bekommen. Eine solche Regel schickte genau diese Nutzer bei jedem Start
  // ins Onboarding, obwohl sie angemeldet sind und einen Haushalt haben.
  //
  // Ob ein angemeldeter Nutzer das Onboarding braucht, entscheidet stattdessen
  // `shouldPromptOnboarding` weiter unten — das haengt an
  // `profiles.onboarding_completed_at`, also am Konto statt am Geraet.

  if (input.isLoading) return { kind: 'warten' };

  if (input.shouldPromptOnboarding) return { kind: 'umleiten', to: '/onboarding' };

  // Angemeldet, aber in keinem Haushalt Mitglied. Jetzt ist das Formular
  // richtig — und der RPC dahinter darf laufen.
  if (input.householdCount === 0) return { kind: 'umleiten', to: '/household/create' };

  return { kind: 'weiter' };
}
