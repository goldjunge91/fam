import { render } from '@testing-library/react-native';
import { AppState } from 'react-native';

let mockSession: { user: { id: string } } | null = null;
let mockIsLoading = false;

jest.mock('@/features/auth/session-provider', () => ({
  useSession: () => ({ session: mockSession, isLoading: mockIsLoading }),
}));

const mockIdentify = jest.fn();
const mockReset = jest.fn();
const mockReloadFeatureFlags = jest.fn();
let mockConfigured = true;

jest.mock('@/lib/posthog', () => ({
  isPostHogConfigured: () => mockConfigured,
  getPostHogClient: () =>
    mockConfigured
      ? { identify: mockIdentify, reset: mockReset, reloadFeatureFlags: mockReloadFeatureFlags }
      : undefined,
}));

let mockAppStateHandler: ((state: string) => void) | undefined;
const mockAppStateRemove = jest.fn();
let currentTime = 0;

import { PostHogIdentitySync } from '@/features/auth/posthog-identity-sync';

describe('PostHogIdentitySync', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    currentTime = 0;
    jest.spyOn(Date, 'now').mockImplementation(() => currentTime);
    mockSession = null;
    mockIsLoading = false;
    mockConfigured = true;
    mockAppStateHandler = undefined;
    jest.spyOn(AppState, 'addEventListener').mockImplementation((_event, handler) => {
      mockAppStateHandler = handler as (state: string) => void;
      return { remove: mockAppStateRemove } as ReturnType<typeof AppState.addEventListener>;
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('ruft identify() mit der Supabase-User-ID auf, sobald eine Session vorliegt', async () => {
    mockSession = { user: { id: 'user-1' } };

    await render(<PostHogIdentitySync />);

    expect(mockIdentify).toHaveBeenCalledWith('user-1');
    expect(mockReset).not.toHaveBeenCalled();
  });

  it('ruft reset() auf wenn keine Session (mehr) vorliegt', async () => {
    mockSession = null;

    await render(<PostHogIdentitySync />);

    expect(mockReset).toHaveBeenCalled();
    expect(mockIdentify).not.toHaveBeenCalled();
  });

  it('tut nichts solange die Session noch laedt', async () => {
    mockIsLoading = true;
    mockSession = null;

    await render(<PostHogIdentitySync />);

    expect(mockIdentify).not.toHaveBeenCalled();
    expect(mockReset).not.toHaveBeenCalled();
  });

  it('tut nichts ohne konfigurierten PostHog-Client', async () => {
    mockConfigured = false;
    mockSession = { user: { id: 'user-1' } };

    await render(<PostHogIdentitySync />);

    expect(mockIdentify).not.toHaveBeenCalled();
    expect(mockReset).not.toHaveBeenCalled();
  });

  it('laedt Feature-Flags nicht innerhalb des automatischen 12-Stunden-Intervalls', async () => {
    await render(<PostHogIdentitySync />);

    expect(AppState.addEventListener).toHaveBeenCalledWith('change', expect.any(Function));
    expect(mockReloadFeatureFlags).not.toHaveBeenCalled();

    mockAppStateHandler?.('active');

    expect(mockReloadFeatureFlags).not.toHaveBeenCalled();
  });

  it('laedt Feature-Flags nach Ablauf des automatischen 12-Stunden-Intervalls neu', async () => {
    await render(<PostHogIdentitySync />);

    currentTime = 12 * 60 * 60 * 1000;
    mockAppStateHandler?.('active');

    expect(mockReloadFeatureFlags).toHaveBeenCalledTimes(1);

    currentTime += 1;
    mockAppStateHandler?.('active');

    expect(mockReloadFeatureFlags).toHaveBeenCalledTimes(1);
  });

  it('laedt beim Wechsel in den Hintergrund keine Feature-Flags neu', async () => {
    await render(<PostHogIdentitySync />);

    mockAppStateHandler?.('background');

    expect(mockReloadFeatureFlags).not.toHaveBeenCalled();
  });

  it('registriert keinen AppState-Listener ohne konfigurierten PostHog-Client', async () => {
    mockConfigured = false;

    await render(<PostHogIdentitySync />);

    expect(AppState.addEventListener).not.toHaveBeenCalled();
  });
});
