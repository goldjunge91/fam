import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import type React from 'react';

import { useCompleteShoppingRun } from '@/features/shopping-list/hooks/use-complete-shopping-run';
import type { LocalShoppingItem } from '@/features/shopping-list/hooks/use-shopping-list';
import { enqueueMutation } from '@/lib/db/outbox';
import { celebrate } from '@/lib/haptics';
import { recordActivity } from '@/lib/streak';

// `useStorageLocations` erwartet immer eine Liste; `undefined` ist fuer TanStack Query ungueltig.
const mockDbGetAllAsync = jest.fn().mockResolvedValue([]);
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

jest.mock('@/lib/streak', () => ({
  recordActivity: jest.fn(() => ({ count: 1, increased: true, milestone: false })),
}));

jest.mock('@/lib/haptics', () => ({
  celebrate: jest.fn(),
}));

describe('useCompleteShoppingRun', () => {
  let queryClient: QueryClient;

  function wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  }

  beforeEach(() => {
    jest.clearAllMocks();
    mockDbGetAllAsync.mockResolvedValue([]);
    jest.mocked(recordActivity).mockReturnValue({ count: 1, increased: true, milestone: false });
    jest.mocked(celebrate).mockClear();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: Number.POSITIVE_INFINITY },
        mutations: { retry: false, gcTime: Number.POSITIVE_INFINITY },
      },
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

    // Die Mutation ist erst nach dem veroeffentlichten Hook-Status vollstaendig sichtbar.
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(enqueueMutation).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        entity: 'fridge_items',
        op: 'insert',
      }),
    );
    expect(recordActivity).toHaveBeenCalledTimes(1);
  });

  it('feiert einen erreichten Streak-Meilenstein beim Einkaufsabschluss', async () => {
    jest.mocked(recordActivity).mockReturnValue({ count: 7, increased: true, milestone: true });
    const { result } = await renderHook(() => useCompleteShoppingRun('hh-1'), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        householdId: 'hh-1',
        userId: 'user-1',
        checkedItems: [
          {
            id: 'item-1',
            household_id: 'hh-1',
            product_id: null,
            name: 'Brot',
            quantity: 1,
            unit: 'piece',
            package_size: null,
            package_size_unit: null,
            category_id: 'bakery',
            category_source: 'name_fallback',
            category_classifier_version: '2026-08-22',
            category: 'Brot & Backwaren',
            store_id: null,
            price_estimate: null,
            recipe_names: [],
            checked_at: null,
            checked_by: null,
            sort_index: 0,
            created_at: '2026-08-20T12:00:00Z',
            updated_at: '2026-08-20T12:00:00Z',
          },
        ],
        transfers: [],
      });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(celebrate).toHaveBeenCalledTimes(1);
  });

  it('lässt den Einkaufsabschluss erfolgreich bleiben, wenn Haptik nicht verfügbar ist', async () => {
    jest.mocked(recordActivity).mockReturnValue({ count: 7, increased: true, milestone: true });
    jest.mocked(celebrate).mockImplementation(() => {
      throw new Error('Taptic Engine unavailable');
    });
    const { result } = await renderHook(() => useCompleteShoppingRun('hh-1'), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        householdId: 'hh-1',
        userId: 'user-1',
        checkedItems: [
          {
            id: 'item-1',
            household_id: 'hh-1',
            product_id: null,
            name: 'Brot',
            quantity: 1,
            unit: 'piece',
            package_size: null,
            package_size_unit: null,
            category_id: 'bakery',
            category_source: 'name_fallback',
            category_classifier_version: '2026-08-22',
            category: 'Brot & Backwaren',
            store_id: null,
            price_estimate: null,
            recipe_names: [],
            checked_at: '2026-08-20T12:00:00Z',
            checked_by: 'user-1',
            sort_index: 0,
            created_at: '2026-08-20T12:00:00Z',
            updated_at: '2026-08-20T12:00:00Z',
          },
        ],
        transfers: [],
      });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });
});
