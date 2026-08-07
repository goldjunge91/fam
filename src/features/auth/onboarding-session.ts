/**
 * Verfolgt, ob das Onboarding jemals abgeschlossen wurde.
 *
 * Zwei Ebenen:
 * 1. In-Memory-Flag (currentSession): Verhindert, dass ein eingeloggter User
 *    das Onboarding bei jedem App-Start wieder sieht, solange die App läuft.
 *
 * 2. Persistierter Flag via SecureStore: Unterscheidet zwischen einem
 *    NEUEN User (App-Erstinstallation, kein Flag) und einem BEKANNTEN User,
 *    der sich ausgeloggt hat (Flag vorhanden → Login-Screen zeigen).
 *
 * Fluss für neuen User:
 *   App-Start → kein persistierter Flag → direkt Onboarding
 *
 * Fluss für bekannten User (ausgeloggt):
 *   App-Start → Flag vorhanden → Login-Screen
 */

import * as SecureStore from 'expo-secure-store';

const ONBOARDING_KEY = 'fam_onboarding_completed_v1';

/** In-Memory-Flag: verhindert Onboarding-Schleife innerhalb einer App-Sitzung. */
let completedInCurrentSession = false;

export function markOnboardingSessionCompleted() {
  completedInCurrentSession = true;
}

export function isOnboardingSessionCompleted() {
  return completedInCurrentSession;
}

/**
 * Persistiert den Onboarding-Abschluss in SecureStore.
 * Aufzurufen nach erfolgreichem Abschluss des Onboardings.
 */
export async function persistOnboardingCompleted(): Promise<void> {
  markOnboardingSessionCompleted();
  try {
    await SecureStore.setItemAsync(ONBOARDING_KEY, 'true');
  } catch {
    // Graceful Fallback: Im Schlimmsten Fall sieht der User das Onboarding
    // beim nächsten Kaltstart erneut — kein datenverlust.
  }
}

/**
 * Prüft ob der User die App schon einmal benutzt hat (Onboarding gesehen).
 * false = neuer User (Erstinstallation) → direkt Onboarding zeigen
 * true  = bekannter User (ausgeloggt) → Login-Screen zeigen
 */
export async function hasSeenOnboarding(): Promise<boolean> {
  try {
    const value = await SecureStore.getItemAsync(ONBOARDING_KEY);
    return value === 'true';
  } catch {
    return false;
  }
}
