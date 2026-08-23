import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react-native';
import type React from 'react';

import { useMealPlanShoppingNeeds } from '@/features/meal-planner/use-shopping-needs';

const mockDbGetAllAsync = jest.fn();
const mockDbGetFirstAsync = jest.fn().mockResolvedValue(null);

jest.mock('@/lib/db/client', () => ({
  getDatabase: jest.fn().mockResolvedValue({
    getAllAsync: (...args: unknown[]) => mockDbGetAllAsync(...args),
    getFirstAsync: (...args: unknown[]) => mockDbGetFirstAsync(...args),
  }),
}));

describe('useMealPlanShoppingNeeds', () => {
  let queryClient: QueryClient;

  function wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  }

  beforeEach(() => {
    jest.clearAllMocks();
    mockDbGetFirstAsync.mockResolvedValue(null);
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: Number.POSITIVE_INFINITY },
        mutations: { retry: false, gcTime: Number.POSITIVE_INFINITY },
      },
    });
  });

  it('berechnet fehlende Zutaten für den Wochenplan', async () => {
    mockDbGetAllAsync
      .mockResolvedValueOnce([{ recipe_id: 'rec-1', portions: 1 }])
      .mockResolvedValueOnce([{ id: 'comp-1', recipe_id: 'rec-1', serving_grams: 100 }])
      .mockResolvedValueOnce([
        {
          component_id: 'comp-1',
          recipe_id: 'rec-1',
          product_id: 'prod-zucker',
          sub_component_id: null,
          grams: 100,
        },
      ])
      .mockResolvedValueOnce([{ id: 'rec-1', title: 'Kuchen' }])
      .mockResolvedValueOnce([{ product_id: 'prod-zucker', quantity: 20, unit: 'g' }])
      .mockResolvedValueOnce([{ id: 'prod-zucker', name: 'Zucker', serving_size_g: 100 }]);

    const { result } = await renderHook(() => useMealPlanShoppingNeeds('plan-1', 'hh-1', true), {
      wrapper,
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toHaveLength(1);
    expect(result.current.data?.[0]).toEqual(
      expect.objectContaining({
        productId: 'prod-zucker',
        missingGrams: 80,
      }),
    );
  });
});
