import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react-native';
import { createElement, type ReactNode } from 'react';

import { useLocalFoodUsage } from '@/features/calorie-tracking/use-local-food-usage';
import { getDatabase } from '@/lib/db/local-client';
import { getFrequentProductUsage } from '@/lib/db/product-usage';

jest.mock('@/lib/db/local-client', () => ({
  getDatabase: jest.fn(),
}));

jest.mock('@/lib/db/product-usage', () => ({
  getFrequentProductUsage: jest.fn(),
}));

let queryClient: QueryClient;

function wrapper({ children }: { children: ReactNode }) {
  return createElement(QueryClientProvider, { client: queryClient }, children);
}

beforeEach(() => {
  jest.clearAllMocks();
  queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Number.POSITIVE_INFINITY },
      mutations: { retry: false, gcTime: Number.POSITIVE_INFINITY },
    },
  });
  jest.mocked(getDatabase).mockResolvedValue({} as Awaited<ReturnType<typeof getDatabase>>);
  jest.mocked(getFrequentProductUsage).mockResolvedValue([]);
});

afterEach(() => queryClient.clear());

test('maps local frequent foods and applies defaults to optional values', async () => {
  jest.mocked(getFrequentProductUsage).mockResolvedValue([
    {
      name: 'Oats',
      brand: null,
      barcode: null,
      product_id: null,
      unit: null,
      quantity: null,
      kcal: 150,
      protein_g: 5,
      carbs_g: 27,
      fat_g: 3,
      used_at: '2026-10-10T10:00:00.000Z',
    },
    {
      name: 'Yogurt',
      brand: 'Farm',
      barcode: '123',
      product_id: 'product-1',
      unit: 'g',
      quantity: 120,
      kcal: null,
      protein_g: null,
      carbs_g: null,
      fat_g: null,
      used_at: '2026-10-10T09:00:00.000Z',
    },
  ]);

  const { result } = await renderHook(() => useLocalFoodUsage('user-1', 'breakfast'), { wrapper });
  await waitFor(() => expect(result.current.data).toHaveLength(2));

  expect(result.current.data).toEqual([
    { name: 'Oats', kcal: 150, proteinG: 5, carbsG: 27, fatG: 3, quantity: 1, unit: 'piece' },
    {
      name: 'Yogurt',
      kcal: null,
      proteinG: null,
      carbsG: null,
      fatG: null,
      quantity: 120,
      unit: 'g',
    },
  ]);
  expect(getFrequentProductUsage).toHaveBeenCalledWith(expect.anything(), {
    userId: 'user-1',
    feature: 'diary',
    mealType: 'breakfast',
  });
});

test('does not access the local database until an account is available', async () => {
  const { result } = await renderHook(() => useLocalFoodUsage(undefined, undefined), { wrapper });

  expect(result.current.fetchStatus).toBe('idle');
  expect(getDatabase).not.toHaveBeenCalled();
  expect(getFrequentProductUsage).not.toHaveBeenCalled();
});

test('surfaces errors from the local usage query', async () => {
  jest.mocked(getFrequentProductUsage).mockRejectedValue(new Error('local database unavailable'));
  const { result } = await renderHook(() => useLocalFoodUsage('user-1', undefined), { wrapper });

  await waitFor(() => expect(result.current.isError).toBe(true));
  expect(result.current.error).toEqual(new Error('local database unavailable'));
});
