import * as SecureStore from 'expo-secure-store';

import { reportError } from '@/lib/telemetry';

const ONBOARDING_KEY = 'fam_onboarding_completed_v1';

/** In-Memory-Flag: verhindert Onboarding-Schleife innerhalb einer App-Sitzung. */
let completedForUserId: string | null = null;

export function markOnboardingSessionCompleted(userId: string) {
  completedForUserId = userId;
}

export function isOnboardingSessionCompleted(userId: string | undefined) {
  return userId !== undefined && completedForUserId === userId;
}

/**
 * Persistiert den geräteweiten Hinweis, dass der Onboarding-Einstieg gesehen wurde.
 */
export async function persistSeenOnboarding(): Promise<void> {
  try {
    await SecureStore.setItemAsync(ONBOARDING_KEY, 'true');
  } catch (error) {
    reportError(error, {
      operation: 'onboarding.completion.write',
      error_code: 'onboarding_completion_write_failed',
    });
    // Graceful Fallback: Im Schlimmsten Fall sieht der User das Onboarding
    // beim nächsten Kaltstart erneut — kein datenverlust.
  }
}

/**
 * Persistiert den Onboarding-Abschluss in SecureStore.
 * Aufzurufen nach erfolgreichem Abschluss des Onboardings.
 */
export async function persistOnboardingCompleted(userId: string): Promise<void> {
  markOnboardingSessionCompleted(userId);
  await persistSeenOnboarding();
}

export async function hasSeenOnboarding(): Promise<boolean> {
  try {
    const value = await SecureStore.getItemAsync(ONBOARDING_KEY);
    return value === 'true';
  } catch (error) {
    reportError(error, {
      operation: 'onboarding.completion.read',
      error_code: 'onboarding_completion_read_failed',
    });
    return false;
  }
}
