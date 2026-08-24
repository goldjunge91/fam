import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import type React from 'react';

import {
  useDeleteShoppingItem,
  useToggleShoppingItem,
  useUpdateShoppingItem,
} from '@/features/shopping-list/hooks/use-shopping-list-mutations';
import { saveShoppingItemAtomically } from '@/features/shopping-list/preferences/save-shopping-item';
import { enqueueMutation } from '@/lib/db/outbox';

const mockDbRunAsync = jest.fn().mockResolvedValue({ changes: 1, lastInsertRowId: 1 });

jest.mock('@/lib/db/client', () => ({
  getDatabase: jest.fn().mockResolvedValue({
    runAsync: (...args: unknown[]) => mockDbRunAsync(...args),
  }),
}));

jest.mock('@/lib/db/outbox', () => ({
  enqueueMutation: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/features/shopping-list/preferences/save-shopping-item', () => ({
  saveShoppingItemAtomically: jest.fn().mockResolvedValue({
    preferenceId: null,
    preferenceChanged: false,
    mutationCount: 1,
  }),
}));

describe('use-shopping-list-mutations', () => {
  let queryClient: QueryClient;

  function wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  }

  beforeEach(() => {
    jest.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: Number.POSITIVE_INFINITY },
        mutations: { retry: false, gcTime: Number.POSITIVE_INFINITY },
      },
    });
  });

  it('toggelt den checked-Status eines Eintrags', async () => {
    const { result } = await renderHook(() => useToggleShoppingItem(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        id: 'item-1',
        household_id: 'hh-1',
        checked_at: '2026-08-20T12:00:00Z',
        checked_by: 'user-1',
      });
    });

    // TanStack Query veroeffentlicht den sichtbaren Mutation-Status asynchron.
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(enqueueMutation).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        entity: 'shopping_list_items',
        op: 'update',
        entityId: 'item-1',
      }),
    );
  });

  it('löscht einen Eintrag per Soft-Delete', async () => {
    const { result } = await renderHook(() => useDeleteShoppingItem(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        id: 'item-1',
        household_id: 'hh-1',
      });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(enqueueMutation).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        entity: 'shopping_list_items',
        op: 'delete',
        entityId: 'item-1',
      }),
    );
  });

  it('aktualisiert Name und Menge eines Eintrags', async () => {
    const { result } = await renderHook(() => useUpdateShoppingItem(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        id: 'item-1',
        household_id: 'hh-1',
        name: 'Haferflocken Großpackung',
        quantity: 1000,
        unit: 'g',
        package_size: null,
        package_size_unit: null,
        category_id: null,
        category_source: 'store_preference',
        category_classifier_version: null,
        store_id: null,
        price_estimate: null,
      });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(saveShoppingItemAtomically).toHaveBeenCalledWith(
      expect.objectContaining({
        itemMutation: expect.objectContaining({
          entity: 'shopping_list_items',
          op: 'update',
          entityId: 'item-1',
          payload: expect.objectContaining({ category_source: 'store_preference' }),
        }),
      }),
    );
  });
});
