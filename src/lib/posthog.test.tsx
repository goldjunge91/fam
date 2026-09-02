import { render, renderHook, screen } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { Text } from 'react-native';

// Die Tests laden das Modul nach `jest.resetModules()` erneut. React muss
// dabei dieselbe Instanz behalten, sonst interpretiert React die Hooks aus
// dem neu geladenen Modul als Hook-Aufruf aus einer fremden React-Instanz.
const cachedReact = jest.requireActual<typeof import('react')>('react');
jest.doMock('react', () => cachedReact);

const mockPostHogConstructor = jest.fn();
const mockGetFeatureFlags = jest.fn();
const mockReloadFeatureFlagsAsync = jest.fn();
const mockPostHogProvider = jest.fn(({ children }) => children);

jest.mock('posthog-react-native', () => ({
  __esModule: true,
  default: class MockPostHog {
    constructor(...args: unknown[]) {
      mockPostHogConstructor(...args);
    }

    getFeatureFlags() {
      return mockGetFeatureFlags();
    }

    getDistinctId() {
      return 'test-user';
    }

    reloadFeatureFlagsAsync() {
      return mockReloadFeatureFlagsAsync();
    }

    onFeatureFlags() {
      return () => {};
    }
  },
  PostHogProvider: (props: { children: ReactNode; client: unknown }) => mockPostHogProvider(props),
}));

describe('initPostHog / isPostHogConfigured', () => {
  const originalKey = process.env.EXPO_PUBLIC_POSTHOG_API_KEY;

  afterEach(() => {
    if (originalKey === undefined) {
      delete process.env.EXPO_PUBLIC_POSTHOG_API_KEY;
    } else {
      process.env.EXPO_PUBLIC_POSTHOG_API_KEY = originalKey;
    }
    jest.resetModules();
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  it('bleibt ohne API-Key ein No-op', () => {
    delete process.env.EXPO_PUBLIC_POSTHOG_API_KEY;
    const consoleWarn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const { initPostHog, isPostHogConfigured } = require('@/lib/posthog');

    initPostHog();

    expect(isPostHogConfigured()).toBe(false);
    expect(mockPostHogConstructor).not.toHaveBeenCalled();
    expect(consoleWarn).toHaveBeenCalledWith(expect.stringContaining('POSTHOG_API_KEY fehlt'));
  });

  it('konfiguriert den Client mit API-Key und Host', () => {
    process.env.EXPO_PUBLIC_POSTHOG_API_KEY = 'phc_testkey';
    process.env.EXPO_PUBLIC_POSTHOG_HOST = 'https://eu.i.posthog.com';
    const { initPostHog, isPostHogConfigured } = require('@/lib/posthog');

    initPostHog();

    expect(isPostHogConfigured()).toBe(true);
    expect(mockPostHogConstructor).toHaveBeenCalledWith(
      'phc_testkey',
      expect.objectContaining({
        host: 'https://eu.i.posthog.com',
        captureAppLifecycleEvents: true,
        enableSessionReplay: false,
        errorTracking: {
          autocapture: {
            nativeCrashes: true,
            uncaughtExceptions: true,
            unhandledRejections: true,
          },
        },
      }),
    );
  });

  it('konstruiert keinen Client, wenn PostHog lokal deaktiviert ist', () => {
    process.env.EXPO_PUBLIC_POSTHOG_API_KEY = 'phc_testkey';
    const { useAnalyticsSettingsStore } = require('@/constants/analytics');
    useAnalyticsSettingsStore.getState().setOverride('providers.posthog', false);
    const { initPostHog, isPostHogConfigured } = require('@/lib/posthog');

    initPostHog();

    expect(isPostHogConfigured()).toBe(false);
    expect(mockPostHogConstructor).not.toHaveBeenCalled();
  });

  it('stuerzt nicht ab, wenn der Konstruktor wirft, und wiederholt den Fehler nicht', () => {
    process.env.EXPO_PUBLIC_POSTHOG_API_KEY = 'phc_testkey';
    mockPostHogConstructor.mockImplementationOnce(() => {
      throw new Error('natives Storage-Modul fehlt');
    });
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    const {
      getPostHogInitializationError,
      initPostHog,
      isPostHogConfigured,
    } = require('@/lib/posthog');

    expect(() => initPostHog()).not.toThrow();
    expect(isPostHogConfigured()).toBe(false);
    expect(getPostHogInitializationError()).toBe('natives Storage-Modul fehlt');

    // Zweiter Aufruf darf den Fehler nicht erneut werfen (attempted-Flag).
    expect(() => initPostHog()).not.toThrow();
    expect(mockPostHogConstructor).toHaveBeenCalledTimes(1);

    consoleError.mockRestore();
  });

  it('gibt Fehler des Flag-Reloads an den Aufrufer weiter', async () => {
    process.env.EXPO_PUBLIC_POSTHOG_API_KEY = 'phc_testkey';
    const networkError = new Error('Netzwerk nicht erreichbar');
    mockReloadFeatureFlagsAsync.mockRejectedValueOnce(networkError);
    const { initPostHog, reloadPostHogFeatureFlags } = require('@/lib/posthog');

    initPostHog();

    await expect(reloadPostHogFeatureFlags()).rejects.toThrow('Netzwerk nicht erreichbar');
  });

  it('fragt keine Flags ab, wenn PostHog lokal deaktiviert ist', async () => {
    process.env.EXPO_PUBLIC_POSTHOG_API_KEY = 'phc_testkey';
    const { useAnalyticsSettingsStore } = require('@/constants/analytics');
    useAnalyticsSettingsStore.getState().setOverride('providers.posthog', false);
    const { reloadPostHogFeatureFlags } = require('@/lib/posthog');

    await expect(reloadPostHogFeatureFlags()).rejects.toThrow(
      'Analytics-Einstellungen deaktiviert',
    );
    expect(mockReloadFeatureFlagsAsync).not.toHaveBeenCalled();
  });

  it('meldet eine fehlende SDK-Antwort als Konfigurations- oder Netzwerkfehler', async () => {
    process.env.EXPO_PUBLIC_POSTHOG_API_KEY = 'phc_testkey';
    mockReloadFeatureFlagsAsync.mockResolvedValueOnce(undefined);
    const { initPostHog, reloadPostHogFeatureFlags } = require('@/lib/posthog');

    initPostHog();

    await expect(reloadPostHogFeatureFlags()).rejects.toThrow('Project API Key, Host und Netzwerk');
  });

  it('bricht einen haengenden Flag-Reload nach 15 Sekunden ab', async () => {
    jest.useFakeTimers();
    try {
      process.env.EXPO_PUBLIC_POSTHOG_API_KEY = 'phc_testkey';
      mockReloadFeatureFlagsAsync.mockReturnValueOnce(new Promise(() => {}));
      const { initPostHog, reloadPostHogFeatureFlags } = require('@/lib/posthog');
      initPostHog();

      const reload = reloadPostHogFeatureFlags();
      const expectedRejection = expect(reload).rejects.toThrow('nach 15 Sekunden');
      await jest.advanceTimersByTimeAsync(15_000);

      await expectedRejection;
    } finally {
      jest.useRealTimers();
    }
  });
});

describe('PostHogAppProvider', () => {
  const originalKey = process.env.EXPO_PUBLIC_POSTHOG_API_KEY;

  afterEach(() => {
    if (originalKey === undefined) {
      delete process.env.EXPO_PUBLIC_POSTHOG_API_KEY;
    } else {
      process.env.EXPO_PUBLIC_POSTHOG_API_KEY = originalKey;
    }
    jest.resetModules();
    jest.clearAllMocks();
  });

  it('rendert Children ohne <PostHogProvider>, wenn kein API-Key konfiguriert ist', async () => {
    delete process.env.EXPO_PUBLIC_POSTHOG_API_KEY;
    const { PostHogAppProvider } = require('@/lib/posthog');

    await render(
      <PostHogAppProvider>
        <Text>Inhalt</Text>
      </PostHogAppProvider>,
    );

    expect(screen.getByText('Inhalt')).toBeOnTheScreen();
    expect(mockPostHogProvider).not.toHaveBeenCalled();
  });

  it('haengt <PostHogProvider> mit dem konfigurierten Client und Touch-Autocapture ein', async () => {
    process.env.EXPO_PUBLIC_POSTHOG_API_KEY = 'phc_testkey';
    const { PostHogAppProvider, initPostHog, getPostHogClient } = require('@/lib/posthog');
    initPostHog();

    await render(
      <PostHogAppProvider>
        <Text>Inhalt</Text>
      </PostHogAppProvider>,
    );

    expect(mockPostHogProvider).toHaveBeenCalledWith(
      expect.objectContaining({
        client: getPostHogClient(),
        autocapture: { captureTouches: true, captureScreens: false },
      }),
    );
  });
});

describe('useFeatureFlag', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('liefert defaultValue wenn noch kein Wert vom Server bestaetigt wurde', async () => {
    const { useFeatureFlag } = require('@/lib/posthog');

    const { result } = await renderHook(() => useFeatureFlag('test-feature', true));

    expect(result.current).toBe(true);
  });

  it('liefert true wenn das Flag serverseitig aktiv ist', async () => {
    process.env.EXPO_PUBLIC_POSTHOG_API_KEY = 'phc_testkey';
    mockGetFeatureFlags.mockReturnValue({ 'test-feature': true });
    const { PostHogAppProvider, initPostHog, useFeatureFlag } = require('@/lib/posthog');
    initPostHog();

    const { result } = await renderHook(() => useFeatureFlag('test-feature', false), {
      wrapper: ({ children }) => <PostHogAppProvider>{children}</PostHogAppProvider>,
    });

    expect(result.current).toBe(true);
  });

  it('liefert false wenn das Flag serverseitig inaktiv ist, unabhaengig vom defaultValue', async () => {
    process.env.EXPO_PUBLIC_POSTHOG_API_KEY = 'phc_testkey';
    mockGetFeatureFlags.mockReturnValue({ 'test-feature': false });
    const { PostHogAppProvider, initPostHog, useFeatureFlag } = require('@/lib/posthog');
    initPostHog();

    const { result } = await renderHook(() => useFeatureFlag('test-feature', true), {
      wrapper: ({ children }) => <PostHogAppProvider>{children}</PostHogAppProvider>,
    });

    expect(result.current).toBe(false);
  });

  it('liefert defaultValue wenn kein Key uebergeben wurde, unabhaengig vom SDK-Rueckgabewert', async () => {
    // SDK-Mock liefert bewusst das Gegenteil von defaultValue: nur wenn der
    // Wrapper den SDK-Rueckgabewert ignoriert und direkt defaultValue
    // zurueckgibt, kommt hier `true` heraus statt `false`.
    const { useFeatureFlag } = require('@/lib/posthog');

    const { result } = await renderHook(() => useFeatureFlag(undefined, true));

    expect(result.current).toBe(true);
  });
});

describe('useFeatureFlagState', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('liefert undefined solange kein Wert vom Server bestaetigt wurde', async () => {
    const { useFeatureFlagState } = require('@/lib/posthog');

    const { result } = await renderHook(() => useFeatureFlagState('test-feature'));

    expect(result.current).toBeUndefined();
  });

  it('liefert true wenn das Flag serverseitig aktiv ist', async () => {
    process.env.EXPO_PUBLIC_POSTHOG_API_KEY = 'phc_testkey';
    mockGetFeatureFlags.mockReturnValue({ 'test-feature': true });
    const { PostHogAppProvider, initPostHog, useFeatureFlagState } = require('@/lib/posthog');
    initPostHog();

    const { result } = await renderHook(() => useFeatureFlagState('test-feature'), {
      wrapper: ({ children }) => <PostHogAppProvider>{children}</PostHogAppProvider>,
    });

    expect(result.current).toBe(true);
  });

  it('liefert false wenn das Flag serverseitig inaktiv ist', async () => {
    process.env.EXPO_PUBLIC_POSTHOG_API_KEY = 'phc_testkey';
    mockGetFeatureFlags.mockReturnValue({ 'test-feature': false });
    const { PostHogAppProvider, initPostHog, useFeatureFlagState } = require('@/lib/posthog');
    initPostHog();

    const { result } = await renderHook(() => useFeatureFlagState('test-feature'), {
      wrapper: ({ children }) => <PostHogAppProvider>{children}</PostHogAppProvider>,
    });

    expect(result.current).toBe(false);
  });

  it('liefert undefined ohne Key, unabhaengig vom SDK-Rueckgabewert', async () => {
    const { useFeatureFlagState } = require('@/lib/posthog');

    const { result } = await renderHook(() => useFeatureFlagState(undefined));

    expect(result.current).toBeUndefined();
  });
});

describe('useFeatureFlags', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('liefert alle aktiven Flags aus dem SDK', async () => {
    process.env.EXPO_PUBLIC_POSTHOG_API_KEY = 'phc_testkey';
    mockGetFeatureFlags.mockReturnValue({ 'module-recipes': true, 'workout-log': false });
    const { PostHogAppProvider, initPostHog, useFeatureFlags } = require('@/lib/posthog');
    initPostHog();

    const { result } = await renderHook(() => useFeatureFlags(), {
      wrapper: ({ children }) => <PostHogAppProvider>{children}</PostHogAppProvider>,
    });

    expect(result.current).toEqual({ 'module-recipes': true, 'workout-log': false });
  });

  it('liefert undefined wenn noch keine Flags geladen sind', async () => {
    const { useFeatureFlags } = require('@/lib/posthog');

    const { result } = await renderHook(() => useFeatureFlags());

    expect(result.current).toBeUndefined();
  });
});
