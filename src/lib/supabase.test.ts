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

jest.mock('@/lib/env', () => ({
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

import { getSupabase, startSupabaseAutoRefresh } from '@/lib/supabase';

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
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(mockStartAutoRefresh).toHaveBeenCalled();
    expect(mockStopAutoRefresh).toHaveBeenCalled();
    expect(remove).toHaveBeenCalledTimes(1);
    expect(mockStopAutoRefresh.mock.invocationCallOrder.at(-1)).toBeGreaterThan(
      mockStartAutoRefresh.mock.invocationCallOrder.at(-1) ?? 0,
    );
  });
});
