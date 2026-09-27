import { onlineManager, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react-native';
import * as React from 'react';

import { findStoreByName, useStores } from '@/features/shopping-list/hooks/use-stores';

const mockDbGetAllAsync = jest.fn();

jest.mock('@/lib/db/local-client', () => ({
  getDatabase: jest.fn().mockResolvedValue({
    getAllAsync: (...args: unknown[]) => mockDbGetAllAsync(...args),
  }),
}));

describe('use-stores', () => {
  let queryClient: QueryClient;

  function wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children);
  }

  beforeEach(() => {
    onlineManager.setOnline(true);
    mockDbGetAllAsync.mockReset();
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: Number.POSITIVE_INFINITY } },
    });
  });

  afterEach(() => {
    onlineManager.setOnline(true);
    queryClient.clear();
  });

  it('zeigt gespeicherte Supermärkte auch offline aus SQLite an', async () => {
    mockDbGetAllAsync.mockResolvedValue([
      {
        id: 'store-1',
        household_id: 'hh-1',
        name: 'Supermarkt',
        color: 'mauve',
        sort_order: 0,
        category_order: null,
      },
    ]);
    onlineManager.setOnline(false);

    const { result } = await renderHook(() => useStores('hh-1'), { wrapper });

    await waitFor(() => expect(result.current.data?.[0]?.name).toBe('Supermarkt'));
    expect(mockDbGetAllAsync).toHaveBeenCalledTimes(1);
  });

  describe('findStoreByName', () => {
    it('findet einen Store unabhängig von Groß-/Kleinschreibung und Leerzeichen', () => {
      const stores = [
        {
          id: 'store-1',
          household_id: 'hh-1',
          name: 'Rewe Center',
          color: '#E53E3E',
          sort_order: 0,
          category_order: null,
        },
        {
          id: 'store-2',
          household_id: 'hh-1',
          name: 'Aldi Süd',
          color: '#3182CE',
          sort_order: 1,
          category_order: null,
        },
      ];

      expect(findStoreByName(stores, 'rewe center')?.id).toBe('store-1');
      expect(findStoreByName(stores, '  ALDI SÜD  ')?.id).toBe('store-2');
      expect(findStoreByName(stores, 'Lidl')).toBeUndefined();
    });
  });
});
