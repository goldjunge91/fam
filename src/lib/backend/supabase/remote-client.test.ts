import {
  AppState,
  type AppStateStatus,
  type NativeEventSubscription,
  Platform,
} from 'react-native';

const mockStartAutoRefresh = jest.fn().mockResolvedValue(undefined);
const mockStopAutoRefresh = jest.fn().mockResolvedValue(undefined);
const mockCreateClient = jest.fn((..._args: unknown[]) => ({
  auth: {
    startAutoRefresh: mockStartAutoRefresh,
    stopAutoRefresh: mockStopAutoRefresh,
  },
}));

jest.mock('@supabase/supabase-js', () => ({
  createClient: (...args: unknown[]) => mockCreateClient(...args),
}));

jest.mock('@/lib/config/env', () => ({
  env: {
    supabaseUrl: 'https://example.supabase.co',
    supabaseKey: 'test-key',
  },
}));

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn().mockResolvedValue(null),
  setItemAsync: jest.fn().mockResolvedValue(undefined),
  deleteItemAsync: jest.fn().mockResolvedValue(undefined),
}));

const mockExpoFetch = jest.fn();
jest.mock('expo/fetch', () => ({ fetch: (...args: unknown[]) => mockExpoFetch(...args) }));

const mockDebugWarn = jest.fn();
jest.mock('@/lib/observability/debug-log', () => ({
  debugWarn: (...args: unknown[]) => mockDebugWarn(...args),
}));

import {
  createPasswordRecoveryClient,
  getSupabase,
  serverClock,
  startSupabaseAutoRefresh,
} from '@/lib/backend/supabase/remote-client';

describe('Supabase Native Lifecycle', () => {
  let appStateListener: ((state: AppStateStatus) => void) | undefined;
  const remove = jest.fn();
  const originalPlatform = Platform.OS;

  beforeEach(() => {
    jest.clearAllMocks();
    appStateListener = undefined;
    jest.spyOn(AppState, 'addEventListener').mockImplementation((_event, listener) => {
      appStateListener = listener;
      return { remove } as NativeEventSubscription;
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
    Object.defineProperty(Platform, 'OS', { configurable: true, value: originalPlatform });
  });

  it('nutzt expo/fetch als Transport, nicht den globalen RN-fetch', () => {
    // Modul-Singleton zuruecksetzen, damit dieser Test createClient selbst
    // ausloest und nicht vom Laufzeit-Zustand des anderen Tests abhaengt.
    jest.resetModules();
    const { getSupabase: freshGetSupabase, serverClock: freshServerClock } =
      require('@/lib/backend/supabase/remote-client') as typeof import('@/lib/backend/supabase/remote-client');
    freshGetSupabase();

    const options = mockCreateClient.mock.calls[0]?.[2] as { global?: { fetch?: unknown } };
    // Der native Supabase-Client muss den begrenzten Expo-Fetch-Wrapper nutzen.
    expect(options.global?.fetch).toBe(freshServerClock.fetch);
    // Der serverClock-Wrapper kapselt expo/fetch: ein Aufruf muss durchreichen.
    expect(mockExpoFetch).not.toHaveBeenCalled();
  });

  it('leitet Uint8Array-Upload-Bodies unverändert an expo/fetch weiter', async () => {
    const bytes = new Uint8Array([0, 17, 128, 255]);
    const init = { method: 'POST', body: bytes } as RequestInit;
    mockExpoFetch.mockResolvedValueOnce({
      body: null,
      headers: { get: () => null },
      status: 204,
    });

    await serverClock.fetch('https://example.supabase.co/storage/v1/object/test', init);

    const call = mockExpoFetch.mock.calls[0];
    expect(call?.[0]).toBe('https://example.supabase.co/storage/v1/object/test');
    expect(call?.[1]).toMatchObject({ method: 'POST', body: bytes });
    expect((call?.[1] as RequestInit | undefined)?.signal).toBeInstanceOf(AbortSignal);
  });

  it('propagiert Netzwerkfehler von expo/fetch an den Supabase-Client', async () => {
    const failure = new TypeError('connection dropped while reading response');
    mockExpoFetch.mockRejectedValueOnce(failure);

    await expect(serverClock.fetch('https://example.supabase.co/rest/v1/households')).rejects.toBe(
      failure,
    );
  });

  it('deaktiviert den Konstruktor-Timer und stoppt Auto-Refresh beim Cleanup', async () => {
    getSupabase();

    expect(mockCreateClient).toHaveBeenCalledWith(
      'https://example.supabase.co',
      'test-key',
      expect.objectContaining({
        auth: expect.objectContaining({ autoRefreshToken: false }),
      }),
    );

    const stopLifecycle = startSupabaseAutoRefresh();

    appStateListener?.('active');
    appStateListener?.('background');
    stopLifecycle();
    await flushMicrotasks();

    expect(mockStartAutoRefresh).toHaveBeenCalled();
    expect(mockStopAutoRefresh).toHaveBeenCalled();
    expect(remove).toHaveBeenCalledTimes(1);
    expect(mockStopAutoRefresh.mock.invocationCallOrder.at(-1)).toBeGreaterThan(
      mockStartAutoRefresh.mock.invocationCallOrder.at(-1) ?? 0,
    );
  });

  it('creates a non-persistent recovery client without auth timers', () => {
    createPasswordRecoveryClient();

    expect(mockCreateClient).toHaveBeenCalledWith(
      'https://example.supabase.co',
      'test-key',
      expect.objectContaining({
        auth: expect.objectContaining({
          autoRefreshToken: false,
          detectSessionInUrl: false,
          persistSession: false,
          storageKey: 'fam-password-recovery',
        }),
      }),
    );
  });

  it('skips native lifecycle listeners on web', () => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'web' });
    const stopLifecycle = startSupabaseAutoRefresh();
    stopLifecycle();

    expect(AppState.addEventListener).not.toHaveBeenCalled();
  });

  it('logs native auto-refresh transitions that reject', async () => {
    mockStartAutoRefresh.mockRejectedValueOnce(new Error('refresh failed'));
    getSupabase();
    const stopLifecycle = startSupabaseAutoRefresh();
    appStateListener?.('active');
    await flushMicrotasks();
    stopLifecycle();
    await flushMicrotasks();

    expect(mockDebugWarn).toHaveBeenCalledWith(
      '[supabase] Auto-Refresh-Zustandswechsel fehlgeschlagen:',
      expect.any(Error),
    );
  });
});

async function flushMicrotasks(): Promise<void> {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    await Promise.resolve();
  }
}
