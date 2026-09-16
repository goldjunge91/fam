import * as SecureStore from 'expo-secure-store';

import { reportError } from '@/lib/telemetry';
import {
  hasSeenOnboarding,
  isOnboardingSessionCompleted,
  persistOnboardingCompleted,
} from './onboarding-completion';

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
}));

jest.mock('@/lib/telemetry', () => ({
  reportError: jest.fn(),
}));

describe('Onboarding-Abschluss', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(SecureStore.getItemAsync).mockResolvedValue(null);
    jest.mocked(SecureStore.setItemAsync).mockResolvedValue(undefined);
  });

  it('persistiert und liest den Abschlussmarker erfolgreich', async () => {
    await persistOnboardingCompleted();
    jest.mocked(SecureStore.getItemAsync).mockResolvedValue('true');

    await expect(hasSeenOnboarding()).resolves.toBe(true);

    expect(SecureStore.setItemAsync).toHaveBeenCalledWith('fam_onboarding_completed_v1', 'true');
    expect(isOnboardingSessionCompleted()).toBe(true);
    expect(reportError).not.toHaveBeenCalled();
  });

  it('meldet Schreibfehler, ohne den In-Memory-Abschluss zurückzunehmen', async () => {
    const error = new Error('SecureStore write failed');
    jest.mocked(SecureStore.setItemAsync).mockRejectedValue(error);

    await expect(persistOnboardingCompleted()).resolves.toBeUndefined();

    expect(reportError).toHaveBeenCalledWith(error, {
      operation: 'onboarding.completion.write',
      error_code: 'onboarding_completion_write_failed',
    });
    expect(isOnboardingSessionCompleted()).toBe(true);
  });

  it('meldet Lesefehler und behandelt den Marker als nicht gesehen', async () => {
    const error = new Error('SecureStore read failed');
    jest.mocked(SecureStore.getItemAsync).mockRejectedValue(error);

    await expect(hasSeenOnboarding()).resolves.toBe(false);

    expect(reportError).toHaveBeenCalledWith(error, {
      operation: 'onboarding.completion.read',
      error_code: 'onboarding_completion_read_failed',
    });
  });
});
