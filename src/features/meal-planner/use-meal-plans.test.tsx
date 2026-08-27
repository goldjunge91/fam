import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import type React from 'react';

import {
  useAddEntryMutation,
  useEnsureMealPlanMutation,
} from '@/features/meal-planner/use-meal-plans';
import { enqueueMutation } from '@/lib/db/outbox';

const mockDbRunAsync = jest.fn().mockResolvedValue({ changes: 1, lastInsertRowId: 1 });
const mockDbGetFirstAsync = jest.fn().mockResolvedValue(null);
const mockDbGetAllAsync = jest.fn().mockResolvedValue([]);

jest.mock('@/lib/analytics', () => ({ trackAnalyticsEvent: jest.fn() }));

jest.mock('@/lib/db/client', () => ({
  getDatabase: jest.fn().mockResolvedValue({
    runAsync: (...args: unknown[]) => mockDbRunAsync(...args),
    getFirstAsync: (...args: unknown[]) => mockDbGetFirstAsync(...args),
    getAllAsync: (...args: unknown[]) => mockDbGetAllAsync(...args),
  }),
}));

jest.mock('@/lib/db/outbox', () => ({
  enqueueMutation: jest.fn().mockResolvedValue(undefined),
}));

describe('use-meal-plans mutations', () => {
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

  it('stellt sicher, dass ein MealPlan existiert', async () => {
    const { result } = await renderHook(() => useEnsureMealPlanMutation(), {
      wrapper,
    });

    await act(async () => {
      await result.current.mutateAsync({
        household_id: 'hh-1',
        week_start_date: '2026-08-24',
        created_by: 'user-1',
      });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(enqueueMutation).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        entity: 'meal_plans',
        op: 'insert',
        payload: expect.objectContaining({
          household_id: 'hh-1',
          week_start_date: '2026-08-24',
        }),
      }),
    );
  });

  it('fügt einen Eintrag zum Essensplan hinzu', async () => {
    const { result } = await renderHook(() => useAddEntryMutation(), {
      wrapper,
    });

    await act(async () => {
      await result.current.mutateAsync({
        meal_plan_id: 'plan-1',
        household_id: 'hh-1',
        recipe_id: 'rec-1',
        entry_date: '2026-08-24',
        meal_slot: 'lunch',
        servings_mode: 'portions',
        portions: 3,
        people_count: null,
        created_by: 'user-1',
      });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(enqueueMutation).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        entity: 'meal_plan_entries',
        op: 'insert',
        payload: expect.objectContaining({
          recipe_id: 'rec-1',
          portions: 3,
        }),
      }),
    );
  });
});
