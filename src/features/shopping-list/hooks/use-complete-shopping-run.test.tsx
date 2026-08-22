import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react-native';
import type React from 'react';

import { useCompleteShoppingRun } from '@/features/shopping-list/hooks/use-complete-shopping-run';
import type { LocalShoppingItem } from '@/features/shopping-list/hooks/use-shopping-list';
import { enqueueMutation } from '@/lib/db/outbox';

const mockDbGetAllAsync = jest.fn();
const mockDbRunAsync = jest.fn().mockResolvedValue({ changes: 1, lastInsertRowId: 1 });

jest.mock('@/lib/db/client', () => ({
  getDatabase: jest.fn().mockResolvedValue({
    getAllAsync: (...args: unknown[]) => mockDbGetAllAsync(...args),
    runAsync: (...args: unknown[]) => mockDbRunAsync(...args),
  }),
}));

jest.mock('@/lib/db/outbox', () => ({
  enqueueMutation: jest.fn().mockResolvedValue(undefined),
}));

describe('useCompleteShoppingRun', () => {
  let queryClient: QueryClient;

  function wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  }

  beforeEach(() => {
    jest.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
  });

  it('überträgt abgehakte Artikel in den Vorrat und schließt den Einkauf ab', async () => {
    const mockItem: LocalShoppingItem = {
      id: 'item-1',
      household_id: 'hh-1',
      product_id: 'prod-hafer',
      name: 'Hafermilch',
      quantity: 2,
      unit: 'l',
      package_size: null,
      package_size_unit: null,
      category_id: 'dairy',
      category_source: 'name_fallback',
      category_classifier_version: '2026-08-22',
      category: 'Milchprodukte & Eier',
      store_id: null,
      price_estimate: 2.49,
      recipe_names: [],
      checked_at: '2026-08-20T12:00:00Z',
      checked_by: 'user-1',
      sort_index: 0,
      created_at: '2026-08-20T12:00:00Z',
      updated_at: '2026-08-20T12:00:00Z',
    };

    const { result } = await renderHook(() => useCompleteShoppingRun('hh-1'), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        householdId: 'hh-1',
        userId: 'user-1',
        checkedItems: [mockItem],
        transfers: [
          {
            shoppingItemId: 'item-1',
            productId: 'prod-hafer',
            name: 'Hafermilch',
            quantity: 2,
            unit: 'l',
            packageSize: null,
            packageSizeUnit: null,
            locationKind: 'fridge',
            expiryDate: null,
          },
        ],
      });
    });

    expect(enqueueMutation).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        entity: 'fridge_items',
        op: 'insert',
      }),
    );
  });
});
