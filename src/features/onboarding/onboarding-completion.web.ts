import { reportError } from '@/lib/telemetry';

const ONBOARDING_KEY = 'fam_onboarding_completed_v1';

/** In-Memory-Flag: verhindert Onboarding-Schleife innerhalb einer App-Sitzung. */
let completedInCurrentSession = false;

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

export function markOnboardingSessionCompleted(): void {
  completedInCurrentSession = true;
}

export function isOnboardingSessionCompleted(): boolean {
  return completedInCurrentSession;
}

/**
 * Persists the onboarding marker in browser storage. Native builds use the
 * platform SecureStore implementation from the sibling native file.
 */
export async function persistOnboardingCompleted(): Promise<void> {
  markOnboardingSessionCompleted();
  try {
    writeValue(ONBOARDING_KEY, 'true');
  } catch (error) {
    reportError(error, {
      operation: 'onboarding.completion.write',
      error_code: 'onboarding_completion_write_failed',
    });
  }
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
