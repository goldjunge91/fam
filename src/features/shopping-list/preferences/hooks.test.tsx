import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import type React from 'react';
import { getDatabase } from '@/lib/db/local-client';
import { resetCategoryPreference, resolveCategoryForItem, setCategoryPreference } from './api';
import {
  useResetCategoryPreferenceMutation,
  useSaveShoppingItemMutation,
  useSetCategoryPreferenceMutation,
} from './hooks';
import { saveShoppingItemAtomically } from './save-shopping-item';

jest.mock('@/lib/db/local-client', () => ({ getDatabase: jest.fn().mockResolvedValue({}) }));

jest.mock('./save-shopping-item', () => ({
  saveShoppingItemAtomically: jest.fn().mockResolvedValue({
    preferenceId: null,
    preferenceChanged: false,
    mutationCount: 1,
  }),
}));

jest.mock('./api', () => ({
  setCategoryPreference: jest.fn().mockResolvedValue('pref-1'),
  resetCategoryPreference: jest.fn().mockResolvedValue(undefined),
  resolveCategoryForItem: jest.fn().mockResolvedValue({
    categoryId: 'dairy',
    source: 'name_fallback',
    classifierVersion: '1',
  }),
}));

describe('preferences/hooks', () => {
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

  it('useSetCategoryPreferenceMutation delegiert an setCategoryPreference', async () => {
    const { result } = await renderHook(() => useSetCategoryPreferenceMutation(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        householdId: 'hh-1',
        keyType: 'name',
        keyValue: 'Hafermilch',
        categoryId: 'dairy',
        createdBy: 'user-1',
      });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(setCategoryPreference).toHaveBeenCalledWith(
      expect.objectContaining({ householdId: 'hh-1', categoryId: 'dairy' }),
    );
  });

  it('useResetCategoryPreferenceMutation loescht die Praeferenz und liefert das neue Auto-Ergebnis', async () => {
    const { result } = await renderHook(() => useResetCategoryPreferenceMutation(), { wrapper });

    let returned: unknown;
    await act(async () => {
      returned = await result.current.mutateAsync({
        householdId: 'hh-1',
        keyType: 'name',
        keyValue: 'Hafermilch',
        name: 'Hafermilch',
      });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(resetCategoryPreference).toHaveBeenCalledWith(
      expect.objectContaining({ householdId: 'hh-1', keyValue: 'Hafermilch' }),
    );
    expect(resolveCategoryForItem).toHaveBeenCalledWith(
      expect.objectContaining({ householdId: 'hh-1', name: 'Hafermilch' }),
    );
    expect(returned).toMatchObject({ categoryId: 'dairy', source: 'name_fallback' });
  });

  it('speichert den Artikel und invalidiert Shopping-Liste und Sync-Status', async () => {
    const invalidateQueries = jest.spyOn(queryClient, 'invalidateQueries');
    const { result } = await renderHook(() => useSaveShoppingItemMutation(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        householdId: 'hh-1',
        itemMutation: {
          entity: 'shopping_list_items',
          entityId: 'item-1',
          op: 'update',
          payload: { id: 'item-1', household_id: 'hh-1' },
          applyLocally: async () => {},
        },
      });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(getDatabase).toHaveBeenCalledTimes(1);
    expect(saveShoppingItemAtomically).toHaveBeenCalledWith(
      expect.objectContaining({ db: expect.anything(), itemMutation: expect.anything() }),
    );
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['shopping_list_items', 'hh-1'] });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['sync-status'] });
    expect(invalidateQueries).not.toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: expect.arrayContaining(['category-preferences']) }),
    );
  });

  it('invalidiert beim Speichern auch den betroffenen Haushalts- und Marktfilter', async () => {
    const invalidateQueries = jest.spyOn(queryClient, 'invalidateQueries');
    const { result } = await renderHook(() => useSaveShoppingItemMutation(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        householdId: 'hh-1',
        itemMutation: {
          entity: 'shopping_list_items',
          entityId: 'item-1',
          op: 'update',
          payload: { id: 'item-1', household_id: 'hh-1' },
          applyLocally: async () => {},
        },
        preference: {
          type: 'set',
          input: {
            householdId: 'hh-1',
            storeId: 'store-1',
            keyType: 'name',
            keyValue: 'Hafermilch',
            categoryId: 'dairy',
            createdBy: 'user-1',
          },
        },
      });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: ['category-preferences', 'hh-1', 'store-1'],
    });
  });
});
