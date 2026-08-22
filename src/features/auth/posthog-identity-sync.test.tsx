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

import { PostHogIdentitySync } from '@/features/auth/posthog-identity-sync';

describe('PostHogIdentitySync', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSession = null;
    mockIsLoading = false;
    mockConfigured = true;
    mockAppStateHandler = undefined;
    // Der Listener liest `AppState.currentState` als Startzustand — fix auf
    // 'active' setzen, damit die Sequenzen unten deterministisch sind.
    (AppState as { currentState: string }).currentState = 'active';
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

  it('laedt Feature-Flags neu beim Wechsel Hintergrund -> Vordergrund', async () => {
    await render(<PostHogIdentitySync />);

    expect(AppState.addEventListener).toHaveBeenCalledWith('change', expect.any(Function));
    expect(mockReloadFeatureFlags).not.toHaveBeenCalled();

    mockAppStateHandler?.('background');
    mockAppStateHandler?.('active');

    expect(mockReloadFeatureFlags).toHaveBeenCalledTimes(1);
  });

  it('laedt beim Wechsel in den Hintergrund keine Feature-Flags neu', async () => {
    await render(<PostHogIdentitySync />);

    mockAppStateHandler?.('background');

    expect(mockReloadFeatureFlags).not.toHaveBeenCalled();
  });

  it('ignoriert ein erneutes active-Event ohne vorheriges Backgrounding', async () => {
    await render(<PostHogIdentitySync />);

    // Kein echter Vordergrund-Wechsel: Control-Center-Zug, Berechtigungs-
    // Dialog oder redundantes AppState-Event, die App war nie im Hintergrund.
    mockAppStateHandler?.('active');

    expect(mockReloadFeatureFlags).not.toHaveBeenCalled();
  });

  it('deckelt rasche Vordergrund-Wechsel auf einen Reload pro Mindestabstand', async () => {
    const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(1_000_000);
    await render(<PostHogIdentitySync />);

    mockAppStateHandler?.('background');
    mockAppStateHandler?.('active');
    expect(mockReloadFeatureFlags).toHaveBeenCalledTimes(1);

    // Zweiter Vordergrund-Wechsel 30s spaeter, innerhalb des Mindestabstands:
    // kein Reload.
    nowSpy.mockReturnValue(1_030_000);
    mockAppStateHandler?.('background');
    mockAppStateHandler?.('active');
    expect(mockReloadFeatureFlags).toHaveBeenCalledTimes(1);

    // 90s nach dem ersten Reload — Mindestabstand ueberschritten, wieder erlaubt.
    nowSpy.mockReturnValue(1_090_000);
    mockAppStateHandler?.('background');
    mockAppStateHandler?.('active');
    expect(mockReloadFeatureFlags).toHaveBeenCalledTimes(2);
  });

  it('registriert keinen AppState-Listener ohne konfigurierten PostHog-Client', async () => {
    mockConfigured = false;

    await render(<PostHogIdentitySync />);

    expect(AppState.addEventListener).not.toHaveBeenCalled();
  });
});
