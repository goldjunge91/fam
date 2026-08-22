import { render, renderHook, screen } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { Text } from 'react-native';

const mockPostHogConstructor = jest.fn();
const mockUseFeatureFlagSdk = jest.fn();
const mockPostHogProvider = jest.fn(({ children }) => children);

jest.mock('posthog-react-native', () => ({
  __esModule: true,
  default: class MockPostHog {
    constructor(...args: unknown[]) {
      mockPostHogConstructor(...args);
    }
  },
  useFeatureFlag: (...args: unknown[]) => mockUseFeatureFlagSdk(...args),
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
    jest.clearAllMocks();
  });

  it('bleibt ohne API-Key ein No-op', () => {
    delete process.env.EXPO_PUBLIC_POSTHOG_API_KEY;
    const { initPostHog, isPostHogConfigured } = require('@/lib/posthog');

    initPostHog();

    expect(isPostHogConfigured()).toBe(false);
    expect(mockPostHogConstructor).not.toHaveBeenCalled();
  });

  it('konfiguriert den Client mit API-Key und Host', () => {
    process.env.EXPO_PUBLIC_POSTHOG_API_KEY = 'phc_testkey';
    process.env.EXPO_PUBLIC_POSTHOG_HOST = 'https://eu.i.posthog.com';
    const { initPostHog, isPostHogConfigured } = require('@/lib/posthog');

    initPostHog();

    expect(isPostHogConfigured()).toBe(true);
    expect(mockPostHogConstructor).toHaveBeenCalledWith(
      'phc_testkey',
      expect.objectContaining({ host: 'https://eu.i.posthog.com' }),
    );
  });

  it('stuerzt nicht ab, wenn der Konstruktor wirft, und wiederholt den Fehler nicht', () => {
    process.env.EXPO_PUBLIC_POSTHOG_API_KEY = 'phc_testkey';
    mockPostHogConstructor.mockImplementationOnce(() => {
      throw new Error('natives Storage-Modul fehlt');
    });
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    const { initPostHog, isPostHogConfigured } = require('@/lib/posthog');

    expect(() => initPostHog()).not.toThrow();
    expect(isPostHogConfigured()).toBe(false);

    // Zweiter Aufruf darf den Fehler nicht erneut werfen (attempted-Flag).
    expect(() => initPostHog()).not.toThrow();
    expect(mockPostHogConstructor).toHaveBeenCalledTimes(1);

    consoleError.mockRestore();
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

  it('haengt <PostHogProvider> mit dem konfigurierten Client ein, wenn ein API-Key gesetzt ist', async () => {
    process.env.EXPO_PUBLIC_POSTHOG_API_KEY = 'phc_testkey';
    const { PostHogAppProvider, initPostHog, getPostHogClient } = require('@/lib/posthog');
    initPostHog();

    await render(
      <PostHogAppProvider>
        <Text>Inhalt</Text>
      </PostHogAppProvider>,
    );

    expect(mockPostHogProvider).toHaveBeenCalledWith(
      expect.objectContaining({ client: getPostHogClient() }),
    );
  });
});

describe('useFeatureFlag', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('liefert defaultValue wenn noch kein Wert vom Server bestaetigt wurde', async () => {
    mockUseFeatureFlagSdk.mockReturnValue(undefined);
    const { useFeatureFlag } = require('@/lib/posthog');

    const { result } = await renderHook(() => useFeatureFlag('test-feature', true));

    expect(result.current).toBe(true);
  });

  it('liefert true wenn das Flag serverseitig aktiv ist', async () => {
    mockUseFeatureFlagSdk.mockReturnValue(true);
    const { useFeatureFlag } = require('@/lib/posthog');

    const { result } = await renderHook(() => useFeatureFlag('test-feature', false));

    expect(result.current).toBe(true);
  });

  it('liefert false wenn das Flag serverseitig inaktiv ist, unabhaengig vom defaultValue', async () => {
    mockUseFeatureFlagSdk.mockReturnValue(false);
    const { useFeatureFlag } = require('@/lib/posthog');

    const { result } = await renderHook(() => useFeatureFlag('test-feature', true));

    expect(result.current).toBe(false);
  });

  it('liefert defaultValue wenn kein Key uebergeben wurde, unabhaengig vom SDK-Rueckgabewert', async () => {
    // SDK-Mock liefert bewusst das Gegenteil von defaultValue: nur wenn der
    // Wrapper den SDK-Rueckgabewert ignoriert und direkt defaultValue
    // zurueckgibt, kommt hier `true` heraus statt `false`.
    mockUseFeatureFlagSdk.mockReturnValue(false);
    const { useFeatureFlag } = require('@/lib/posthog');

    const { result } = await renderHook(() => useFeatureFlag(undefined, true));

    expect(result.current).toBe(true);
  });
});
