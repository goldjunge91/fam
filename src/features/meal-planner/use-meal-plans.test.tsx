import { onlineManager, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import type React from 'react';

import {
  useAddEntryMutation,
  useDeleteEntryMutation,
  useEnsureMealPlanMutation,
  useMealPlan,
  useMealPlanEntries,
  useMealPlanEntriesInRange,
  useReuseLastWeekMutation,
  useUpdateEntryMutation,
} from '@/features/meal-planner/use-meal-plans';
import { enqueueMutation } from '@/lib/db/outbox';

const mockDbRunAsync = jest.fn().mockResolvedValue({ changes: 1, lastInsertRowId: 1 });
const mockDbGetFirstAsync = jest.fn().mockResolvedValue(null);
const mockDbGetAllAsync = jest.fn().mockResolvedValue([]);

jest.mock('@/lib/analytics', () => ({ trackAnalyticsEvent: jest.fn() }));

jest.mock('@/lib/db/local-client', () => ({
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
    onlineManager.setOnline(true);
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: Number.POSITIVE_INFINITY },
        mutations: { retry: false, gcTime: Number.POSITIVE_INFINITY },
      },
    });
  });

  afterEach(async () => {
    onlineManager.setOnline(true);
    await act(async () => queryClient.clear());
  });

  it('lädt einen Wochenplan und liest Einträge mit strukturierten Freitextzutaten', async () => {
    mockDbGetFirstAsync.mockResolvedValueOnce({
      id: 'plan-1',
      household_id: 'hh-1',
      name: 'Woche 35',
      week_start_date: '2026-08-24',
    });
    const planHook = await renderHook(() => useMealPlan('hh-1', '2026-08-24'), { wrapper });

    await waitFor(() => expect(planHook.result.current.data?.id).toBe('plan-1'));
    await planHook.unmount();

    const storedEntry = {
      id: 'entry-1',
      meal_plan_id: 'plan-1',
      household_id: 'hh-1',
      recipe_id: null,
      custom_title: 'Gemüsepfanne',
      custom_ingredients: '[{"name":"Paprika","quantity":2,"unit":"piece"}]',
      entry_date: '2026-08-25',
      meal_slot: 'dinner' as const,
      servings_mode: 'portions' as const,
      portions: 2,
      people_count: null,
      recipe_title: 'Gemüsepfanne',
      recipe_cover_image_path: null,
    };
    mockDbGetAllAsync.mockResolvedValueOnce([storedEntry]);
    const entriesHook = await renderHook(() => useMealPlanEntries('plan-1'), { wrapper });

    await waitFor(() => expect(entriesHook.result.current.data).toHaveLength(1));
    expect(entriesHook.result.current.data?.[0]?.custom_ingredients).toEqual([
      { name: 'Paprika', quantity: 2, unit: 'piece' },
    ]);
    await entriesHook.unmount();
  });

  it('liest Einträge im gewählten Datumsbereich', async () => {
    mockDbGetAllAsync.mockResolvedValueOnce([
      {
        id: 'entry-2',
        meal_plan_id: 'plan-1',
        household_id: 'hh-1',
        recipe_id: 'recipe-1',
        custom_title: null,
        custom_ingredients: null,
        entry_date: '2026-08-26',
        meal_slot: 'lunch',
        servings_mode: 'people',
        portions: 1,
        people_count: 3,
        recipe_title: 'Linsensuppe',
        recipe_cover_image_path: null,
      },
    ]);
    const rangeHook = await renderHook(
      () => useMealPlanEntriesInRange('hh-1', '2026-08-24', '2026-08-30'),
      { wrapper },
    );

    await waitFor(() => expect(rangeHook.result.current.data).toHaveLength(1));
    expect(rangeHook.result.current.data?.[0]).toEqual(
      expect.objectContaining({ recipe_title: 'Linsensuppe', custom_ingredients: [] }),
    );

    await rangeHook.unmount();
  });

  it('liefert null, wenn für eine Kalenderwoche kein Plan gespeichert ist', async () => {
    mockDbGetFirstAsync.mockResolvedValueOnce(null);
    const { result, unmount } = await renderHook(() => useMealPlan('hh-1', '2026-08-24'), {
      wrapper,
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBeNull();
    await unmount();
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

  it('verwendet einen vorhandenen Wochenplan ohne einen weiteren Eintrag anzulegen', async () => {
    const existing = {
      id: 'existing-plan',
      household_id: 'hh-1',
      name: 'Woche 35',
      week_start_date: '2026-08-24',
    };
    mockDbGetFirstAsync.mockResolvedValueOnce(existing);
    const { result } = await renderHook(() => useEnsureMealPlanMutation(), { wrapper });

    await act(async () => {
      await expect(
        result.current.mutateAsync({
          household_id: 'hh-1',
          week_start_date: '2026-08-24',
          created_by: 'user-1',
        }),
      ).resolves.toEqual(existing);
    });

    expect(enqueueMutation).not.toHaveBeenCalled();
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

  it('weist eine ungültige Portionsmenge zurück, bevor sie in die Outbox gelangt', async () => {
    const { result } = await renderHook(() => useAddEntryMutation(), { wrapper });

    await act(async () => {
      await expect(
        result.current.mutateAsync({
          meal_plan_id: 'plan-1',
          household_id: 'hh-1',
          recipe_id: 'recipe-1',
          entry_date: '2026-08-24',
          meal_slot: 'dinner',
          servings_mode: 'portions',
          portions: 0,
          people_count: null,
          created_by: 'user-1',
        }),
      ).rejects.toThrow('Portionen müssen positiv sein.');
    });

    expect(enqueueMutation).not.toHaveBeenCalled();
  });

  it('fügt ein Freitextgericht mit Zutaten lokal und in der Outbox hinzu', async () => {
    const { result } = await renderHook(() => useAddEntryMutation(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        meal_plan_id: 'plan-1',
        household_id: 'hh-1',
        recipe_id: null,
        custom_title: 'Gemüsepfanne',
        custom_ingredients: [{ name: 'Paprika', quantity: 2, unit: 'piece' }],
        entry_date: '2026-08-24',
        meal_slot: 'lunch',
        servings_mode: 'portions',
        portions: 2,
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
          recipe_id: null,
          custom_title: 'Gemüsepfanne',
          custom_ingredients: [{ name: 'Paprika', quantity: 2, unit: 'piece' }],
        }),
      }),
    );
  });

  it('aktualisiert Name und Zutaten eines Freitextgerichts gemeinsam', async () => {
    const { result } = await renderHook(() => useUpdateEntryMutation(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        id: 'entry-1',
        meal_plan_id: 'plan-1',
        household_id: 'hh-1',
        custom_title: 'Paprika-Reis',
        custom_ingredients: [{ name: 'Paprika', quantity: 1, unit: 'piece' }],
      });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(enqueueMutation).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        entity: 'meal_plan_entries',
        op: 'update',
        payload: expect.objectContaining({
          id: 'entry-1',
          custom_title: 'Paprika-Reis',
          custom_ingredients: [{ name: 'Paprika', quantity: 1, unit: 'piece' }],
        }),
      }),
    );
  });

  it('aktualisiert Portionsdaten für ein Rezept und löscht einen Eintrag', async () => {
    const updateHook = await renderHook(() => useUpdateEntryMutation(), { wrapper });
    await act(async () => {
      await updateHook.result.current.mutateAsync({
        id: 'entry-2',
        meal_plan_id: 'plan-1',
        household_id: 'hh-1',
        servings_mode: 'people',
        portions: 4,
        people_count: 4,
      });
    });

    expect(enqueueMutation).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        entity: 'meal_plan_entries',
        op: 'update',
        payload: expect.objectContaining({ id: 'entry-2', servings_mode: 'people', portions: 4 }),
      }),
    );

    const deleteHook = await renderHook(() => useDeleteEntryMutation(), { wrapper });
    await act(async () => {
      await deleteHook.result.current.mutateAsync({
        id: 'entry-2',
        meal_plan_id: 'plan-1',
        household_id: 'hh-1',
      });
    });

    expect(enqueueMutation).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.objectContaining({
        entity: 'meal_plan_entries',
        op: 'delete',
        payload: expect.objectContaining({ id: 'entry-2', deleted_at: expect.any(String) }),
      }),
    );
  });

  it('aktualisiert Portionen zusammen mit Name und Zutaten eines Freitextgerichts', async () => {
    const { result } = await renderHook(() => useUpdateEntryMutation(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        id: 'entry-custom',
        meal_plan_id: 'plan-1',
        household_id: 'hh-1',
        custom_title: 'Ofengemüse',
        custom_ingredients: [{ name: 'Möhre', quantity: 2, unit: 'piece' }],
        portions: 3,
        people_count: 3,
      });
    });

    expect(enqueueMutation).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        entity: 'meal_plan_entries',
        op: 'update',
        payload: expect.objectContaining({
          id: 'entry-custom',
          custom_title: 'Ofengemüse',
          servings_mode: 'portions',
          portions: 3,
          people_count: 3,
        }),
      }),
    );
  });

  it('übernimmt Freitextname und Zutaten beim Kopieren der Vorwoche', async () => {
    mockDbGetFirstAsync.mockResolvedValueOnce({ id: 'last-plan' });
    mockDbGetAllAsync.mockResolvedValueOnce([
      {
        recipe_id: null,
        custom_title: 'Gemüsepfanne',
        custom_ingredients: '[{"name":"Paprika","quantity":2,"unit":"piece"}]',
        entry_date: '2026-08-27',
        meal_slot: 'dinner',
        servings_mode: 'portions',
        portions: 2,
        people_count: null,
      },
    ]);
    const { result } = await renderHook(() => useReuseLastWeekMutation(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        household_id: 'hh-1',
        week_start_date: '2026-08-31',
        target_meal_plan_id: 'plan-current',
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
          meal_plan_id: 'plan-current',
          recipe_id: null,
          custom_title: 'Gemüsepfanne',
          custom_ingredients: [{ name: 'Paprika', quantity: 2, unit: 'piece' }],
          entry_date: '2026-09-03',
        }),
      }),
    );
  });

  it('meldet null kopierte Einträge, wenn es keine Vorwoche gibt', async () => {
    mockDbGetFirstAsync.mockResolvedValueOnce(null);
    const { result } = await renderHook(() => useReuseLastWeekMutation(), { wrapper });

    await act(async () => {
      await expect(
        result.current.mutateAsync({
          household_id: 'hh-1',
          week_start_date: '2026-08-31',
          target_meal_plan_id: 'plan-current',
          created_by: 'user-1',
        }),
      ).resolves.toEqual({ copied: 0 });
    });

    expect(mockDbGetAllAsync).not.toHaveBeenCalled();
    expect(enqueueMutation).not.toHaveBeenCalled();
  });

  it('meldet null kopierte Einträge bei einer leeren Vorwoche', async () => {
    mockDbGetFirstAsync.mockResolvedValueOnce({ id: 'last-plan' });
    mockDbGetAllAsync.mockResolvedValueOnce([]);
    const { result } = await renderHook(() => useReuseLastWeekMutation(), { wrapper });

    await act(async () => {
      await expect(
        result.current.mutateAsync({
          household_id: 'hh-1',
          week_start_date: '2026-08-31',
          target_meal_plan_id: 'plan-current',
          created_by: 'user-1',
        }),
      ).resolves.toEqual({ copied: 0 });
    });

    expect(enqueueMutation).not.toHaveBeenCalled();
  });

  it('reiht einen neuen Essensplan-Eintrag auch offline in die Outbox ein', async () => {
    onlineManager.setOnline(false);
    const { result } = await renderHook(() => useAddEntryMutation(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        meal_plan_id: 'plan-offline',
        household_id: 'hh-1',
        recipe_id: 'rec-1',
        entry_date: '2026-08-24',
        meal_slot: 'dinner',
        servings_mode: 'portions',
        portions: 2,
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
      }),
    );
  });
});
