import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import type React from 'react';
import { resetCategoryPreference, resolveCategoryForItem, setCategoryPreference } from './api';
import { useResetCategoryPreferenceMutation, useSetCategoryPreferenceMutation } from './hooks';

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
});
