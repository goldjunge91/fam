import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { getEncryptedAccountStorage } from '@/lib/storage/local-account-storage';
import {
  DEFAULT_SHOW_PRICE_IN_MARKET_VIEW,
  getShowPriceInMarketView,
  setShowPriceInMarketView,
  showPriceInMarketViewQueryKey,
  useSetShowPriceInMarketView,
  useShowPriceInMarketView,
} from './display-settings';

jest.mock('@/lib/storage/local-account-storage', () => ({
  getEncryptedAccountStorage: jest.fn(),
}));

const mockStorage = {
  getBoolean: jest.fn<boolean | undefined, [string]>(),
  set: jest.fn<void, [string, boolean]>(),
};

let activeQueryClient: QueryClient | undefined;

function createQueryClient() {
  activeQueryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Number.POSITIVE_INFINITY },
      mutations: { retry: false, gcTime: Number.POSITIVE_INFINITY },
    },
  });
  return activeQueryClient;
}

function createWrapper(queryClient: QueryClient) {
  return function QueryWrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe('shopping-list market price preference', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockStorage.getBoolean.mockReturnValue(undefined);
    jest
      .mocked(getEncryptedAccountStorage)
      .mockResolvedValue(
        mockStorage as unknown as Awaited<ReturnType<typeof getEncryptedAccountStorage>>,
      );
  });

  afterEach(async () => {
    await act(async () => activeQueryClient?.clear());
    activeQueryClient = undefined;
  });

  it('uses the default when the value is absent or account storage cannot be read', async () => {
    await expect(getShowPriceInMarketView('account-1')).resolves.toBe(
      DEFAULT_SHOW_PRICE_IN_MARKET_VIEW,
    );

    mockStorage.getBoolean.mockReturnValue(true);
    await expect(getShowPriceInMarketView('account-1')).resolves.toBe(true);

    jest.mocked(getEncryptedAccountStorage).mockRejectedValue(new Error('storage unavailable'));
    await expect(getShowPriceInMarketView('account-1')).resolves.toBe(
      DEFAULT_SHOW_PRICE_IN_MARKET_VIEW,
    );
  });

  it('writes a value and tolerates storage errors', async () => {
    await expect(setShowPriceInMarketView('account-1', true)).resolves.toBeUndefined();
    expect(mockStorage.set).toHaveBeenCalledWith('shopping-list.show-price-in-market-view', true);

    jest.mocked(getEncryptedAccountStorage).mockRejectedValue(new Error('storage unavailable'));
    await expect(setShowPriceInMarketView('account-1', false)).resolves.toBeUndefined();
  });

  it('loads an account value and uses a disabled default query without an account', async () => {
    const queryClient = createQueryClient();
    mockStorage.getBoolean.mockReturnValue(true);
    const accountQuery = await renderHook(() => useShowPriceInMarketView('account-1'), {
      wrapper: createWrapper(queryClient),
    });
    await waitFor(() => expect(accountQuery.result.current.data).toBe(true));
    expect(showPriceInMarketViewQueryKey()).toEqual([
      'settings',
      'shopping-list',
      'show-price-in-market-view',
      'anonymous',
    ]);

    const anonymousQuery = await renderHook(() => useShowPriceInMarketView(), {
      wrapper: createWrapper(queryClient),
    });
    expect(anonymousQuery.result.current.data).toBe(DEFAULT_SHOW_PRICE_IN_MARKET_VIEW);
    expect(anonymousQuery.result.current.fetchStatus).toBe('idle');
  });

  it('persists mutations only for an account and updates the matching cache key', async () => {
    const queryClient = createQueryClient();
    const accountSetter = await renderHook(() => useSetShowPriceInMarketView('account-1'), {
      wrapper: createWrapper(queryClient),
    });
    await act(async () => accountSetter.result.current.mutateAsync(true));
    expect(mockStorage.set).toHaveBeenCalledWith('shopping-list.show-price-in-market-view', true);
    expect(queryClient.getQueryData(showPriceInMarketViewQueryKey('account-1'))).toBe(true);

    mockStorage.set.mockClear();
    const anonymousSetter = await renderHook(() => useSetShowPriceInMarketView(), {
      wrapper: createWrapper(queryClient),
    });
    await act(async () => anonymousSetter.result.current.mutateAsync(false));
    expect(mockStorage.set).not.toHaveBeenCalled();
    expect(queryClient.getQueryData(showPriceInMarketViewQueryKey())).toBe(false);
  });
});
