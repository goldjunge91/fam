import * as SecureStore from 'expo-secure-store';

const ONBOARDING_KEY = 'fam_onboarding_completed_v1';

let completedInCurrentSession = false;

export function markOnboardingSessionCompleted() {
  completedInCurrentSession = true;
}

export function isOnboardingSessionCompleted() {
  return completedInCurrentSession;
}

export async function persistOnboardingCompleted(): Promise<void> {
  markOnboardingSessionCompleted();
  try {
    await SecureStore.setItemAsync(ONBOARDING_KEY, 'true');
  } catch {
    // Ein Speicherfehler zeigt hoechstens beim naechsten Kaltstart erneut das Onboarding.
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
