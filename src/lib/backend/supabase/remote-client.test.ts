import { AppState, type AppStateStatus, type NativeEventSubscription } from 'react-native';

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

import { getSupabase, startSupabaseAutoRefresh } from '@/lib/backend/supabase/remote-client';

describe('Supabase Native Lifecycle', () => {
  let appStateListener: ((state: AppStateStatus) => void) | undefined;
  const remove = jest.fn();

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
  });

  it('nutzt expo/fetch als Transport, nicht den globalen RN-fetch', () => {
    // Modul-Singleton zuruecksetzen, damit dieser Test createClient selbst
    // ausloest und nicht vom Laufzeit-Zustand des anderen Tests abhaengt.
    jest.resetModules();
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- jest.resetModules verlangt require statt dynamic import
    const { getSupabase: freshGetSupabase } =
      require('@/lib/backend/supabase/remote-client') as typeof import('@/lib/backend/supabase/remote-client');
    freshGetSupabase();

    const options = mockCreateClient.mock.calls[0]?.[2] as { global?: { fetch?: unknown } };
    // Der globale fetch ist der XHR-Polyfill, der binaere Upload-Bodies
    // mit "Network request failed" brechen kann (harness/storage-upload-matrix).
    expect(options.global?.fetch).not.toBe(globalThis.fetch);
    // Der serverClock-Wrapper kapselt expo/fetch: ein Aufruf muss durchreichen.
    expect(mockExpoFetch).not.toHaveBeenCalled();
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
});

async function flushMicrotasks(): Promise<void> {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    await Promise.resolve();
  }
}
