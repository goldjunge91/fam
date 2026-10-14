import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react-native';
import type React from 'react';

import { type LocalProduct, useProduct } from './use-product';

const mockGetFirstAsync = jest.fn();

jest.mock('@/lib/db/local-client', () => ({
  getDatabase: jest.fn().mockResolvedValue({
    getFirstAsync: (...args: unknown[]) => mockGetFirstAsync(...args),
  }),
}));

describe('useProduct', () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Number.POSITIVE_INFINITY } },
  });

  function wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  }

  beforeEach(() => {
    mockGetFirstAsync.mockReset();
    queryClient.clear();
  });

  test('does not query SQLite until a product id is available', async () => {
    const { result } = await renderHook(() => useProduct(null), { wrapper });

    expect(result.current.fetchStatus).toBe('idle');
    expect(mockGetFirstAsync).not.toHaveBeenCalled();
  });

  test('uses a null product id when a disabled query is explicitly refreshed', async () => {
    mockGetFirstAsync.mockResolvedValue(null);
    const { result } = await renderHook(() => useProduct(null), { wrapper });

    await result.current.refetch();

    expect(mockGetFirstAsync).toHaveBeenCalledWith('select * from products where id = ?', [null]);
  });

  test('loads the product by id from the local database', async () => {
    const product: LocalProduct = {
      id: 'product-1',
      barcode: null,
      name: 'Hafermilch',
      brand: null,
      kcal_per_100: 46,
      protein_g_per_100: 1,
      carbs_g_per_100: 6,
      fat_g_per_100: 2,
      fiber_g_per_100: 0,
      sugar_g_per_100: 3,
      salt_g_per_100: 0.1,
      serving_size_g: 100,
      source: 'manual',
    };
    mockGetFirstAsync.mockResolvedValue(product);

    const { result } = await renderHook(() => useProduct('product-1'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(product);
    expect(mockGetFirstAsync).toHaveBeenCalledWith('select * from products where id = ?', [
      'product-1',
    ]);
  });
});
