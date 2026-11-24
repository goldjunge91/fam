import { reportError } from '@/lib/telemetry';

const ONBOARDING_KEY = 'fam_onboarding_completed_v1';

/** In-Memory-Flag: verhindert Onboarding-Schleife innerhalb einer App-Sitzung. */
let completedForUserId: string | null = null;

const memoryStorage = new Map<string, string>();

function readValue(key: string): string | null {
  try {
    if (typeof window !== 'undefined') return window.localStorage.getItem(key);
  } catch {
    // Browser storage may be unavailable (for example in private or blocked contexts).
  }
  return memoryStorage.get(key) ?? null;
}

function writeValue(key: string, value: string): void {
  try {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(key, value);
      return;
    }
  } catch {
    // Fall back to the current page session when persistent browser storage is unavailable.
  }
  memoryStorage.set(key, value);
}

export function markOnboardingSessionCompleted(userId: string): void {
  completedForUserId = userId;
}

export function isOnboardingSessionCompleted(userId: string | undefined): boolean {
  return userId !== undefined && completedForUserId === userId;
}

/**
 * Persists the device-wide onboarding marker in browser storage.
 */
export async function persistSeenOnboarding(): Promise<void> {
  try {
    writeValue(ONBOARDING_KEY, 'true');
  } catch (error) {
    reportError(error, {
      operation: 'onboarding.completion.write',
      error_code: 'onboarding_completion_write_failed',
    });
  }
}

/**
 * Persists the onboarding marker in browser storage after the account completed
 * the flow. Native builds use the platform SecureStore implementation from the
 * sibling native file.
 */
export async function persistOnboardingCompleted(userId: string): Promise<void> {
  markOnboardingSessionCompleted(userId);
  await persistSeenOnboarding();
}

export async function hasSeenOnboarding(): Promise<boolean> {
  try {
    return readValue(ONBOARDING_KEY) === 'true';
  } catch (error) {
    reportError(error, {
      operation: 'onboarding.completion.read',
      error_code: 'onboarding_completion_read_failed',
    });
    return false;
  }
}
