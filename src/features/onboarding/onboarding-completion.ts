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

export async function hasSeenOnboarding(): Promise<boolean> {
  try {
    const value = await SecureStore.getItemAsync(ONBOARDING_KEY);
    return value === 'true';
  } catch {
    return false;
  }
}
