import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react-native';
import type React from 'react';

import {
  SUGGESTION_QUERY_LIMIT,
  useShoppingProductSuggestions,
} from './use-shopping-product-suggestions';

const mockGetAllAsync = jest.fn();
const mockGetDatabase = jest.fn();

jest.mock('@/lib/db/local-client', () => ({
  getDatabase: (...args: unknown[]) => mockGetDatabase(...args),
}));

describe('useShoppingProductSuggestions', () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Number.POSITIVE_INFINITY } },
  });

  function wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  }

  beforeEach(() => {
    mockGetAllAsync.mockReset();
    mockGetDatabase.mockReset().mockResolvedValue({ getAllAsync: mockGetAllAsync });
    queryClient.clear();
  });

  test('returns an empty result without opening SQLite when no user is available', async () => {
    const { result } = await renderHook(
      () =>
        useShoppingProductSuggestions({ userId: undefined, householdId: 'hh-1', mode: 'recent' }),
      { wrapper },
    );

    const refreshResult = await result.current.refetch();

    expect(refreshResult.data).toEqual([]);
    expect(mockGetDatabase).not.toHaveBeenCalled();
  });

  test.each([
    ['recent', 'used_at desc'],
    ['frequent', 'frequency desc, used_at desc'],
  ] as const)('orders %s suggestions correctly', async (mode, orderBy) => {
    const suggestions = [{ name: 'Hafermilch', product_id: 'product-1' }];
    mockGetAllAsync.mockResolvedValue(suggestions);

    const { result } = await renderHook(
      () => useShoppingProductSuggestions({ userId: 'user-1', householdId: 'hh-1', mode }),
      { wrapper },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(suggestions);
    expect(mockGetAllAsync).toHaveBeenCalledWith(expect.stringContaining(`order by ${orderBy}`), [
      'user-1',
      'hh-1',
      'hh-1',
      'hh-1',
    ]);
    expect(mockGetAllAsync.mock.calls[0]?.[0]).toContain(`limit ${SUGGESTION_QUERY_LIMIT}`);
  });
});
