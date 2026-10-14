import { onlineManager, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import type React from 'react';

import {
  useAddRecipeMutation,
  useDeleteRecipeMutation,
  useRecipeDetail,
  useRecipes,
  useUpdateRecipeMutation,
} from '@/features/recipes/hooks/use-recipes';
import { enqueueMutation } from '@/lib/db/outbox';
import type { SqlDatabase } from '@/lib/db/types';
import { applyLocalMirrorWrite } from '@/lib/sync/mirror-write';

const mockDbRunAsync = jest.fn().mockResolvedValue({ changes: 1, lastInsertRowId: 1 });
const mockDbGetAllAsync = jest.fn().mockResolvedValue([]);
const mockDbGetFirstAsync = jest.fn().mockResolvedValue(null);

jest.mock('@/lib/analytics', () => ({ trackAnalyticsEvent: jest.fn() }));

jest.mock('@/lib/db/local-client', () => ({
  getDatabase: jest.fn().mockResolvedValue({
    runAsync: (...args: unknown[]) => mockDbRunAsync(...args),
    getAllAsync: (...args: unknown[]) => mockDbGetAllAsync(...args),
    getFirstAsync: (...args: unknown[]) => mockDbGetFirstAsync(...args),
  }),
}));

jest.mock('@/lib/db/outbox', () => ({
  enqueueMutation: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/lib/sync/mirror-write', () => ({
  applyLocalMirrorWrite: jest.fn().mockResolvedValue(undefined),
}));

describe('use-recipes mutations', () => {
  let queryClient: QueryClient;

  function wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  }

  beforeEach(() => {
    jest.clearAllMocks();
    onlineManager.setOnline(true);
    mockDbGetAllAsync.mockResolvedValue([]);
    mockDbGetFirstAsync.mockResolvedValue(null);
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: Number.POSITIVE_INFINITY },
        mutations: { retry: false, gcTime: Number.POSITIVE_INFINITY },
      },
    });
  });

  afterEach(() => {
    onlineManager.setOnline(true);
    queryClient.clear();
  });

  it('erstellt ein neues Rezept und reiht es in die Outbox ein', async () => {
    const { result } = await renderHook(() => useAddRecipeMutation(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        household_id: 'hh-1',
        title: 'Gemuesepfanne',
        instructions: 'Alles anbraten.',
        created_by: 'user-1',
      });
    });

    // TanStack Query veroeffentlicht den finalen Mutation-Status in einem spaeteren Tick.
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(enqueueMutation).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        entity: 'recipes',
        op: 'insert',
        payload: expect.objectContaining({
          title: 'Gemuesepfanne',
        }),
      }),
    );

    const mutation = jest.mocked(enqueueMutation).mock.lastCall?.[1];
    await mutation?.applyLocally({} as SqlDatabase);
    expect(applyLocalMirrorWrite).toHaveBeenCalledWith(
      expect.anything(),
      'recipes',
      'insert',
      expect.objectContaining({ title: 'Gemuesepfanne' }),
      expect.any(Number),
    );
  });

  it('loescht ein Rezept per Soft-Delete und schreibt in Outbox', async () => {
    const { result } = await renderHook(() => useDeleteRecipeMutation(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ id: 'rec-1', household_id: 'hh-1' });
    });

    // Erst nach diesem sichtbaren Hook-Zustand ist die Mutation vollstaendig abgeschlossen.
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(enqueueMutation).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        entity: 'recipes',
        entityId: 'rec-1',
      }),
    );

    for (const [, mutation] of jest.mocked(enqueueMutation).mock.calls) {
      await mutation.applyLocally({} as SqlDatabase);
    }
    expect(applyLocalMirrorWrite).toHaveBeenCalledWith(
      expect.anything(),
      'recipes',
      'delete',
      { id: 'rec-1' },
      expect.any(Number),
    );
  });

  it('reiht ein neues Rezept auch offline in die Outbox ein', async () => {
    onlineManager.setOnline(false);
    const { result } = await renderHook(() => useAddRecipeMutation(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        household_id: 'hh-1',
        title: 'Offline-Rezept',
        instructions: 'Lokal speichern.',
        created_by: 'user-1',
      });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(enqueueMutation).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        entity: 'recipes',
        op: 'insert',
      }),
    );
  });

  it('lädt Rezeptlisten samt Nährwerten und bildet optionale Felder ab', async () => {
    const row = {
      id: 'recipe-1',
      household_id: 'hh-1',
      title: 'Gemuesepfanne',
      instructions: null,
      cover_image_path: null,
      prep_time_minutes: 10,
      cook_time_minutes: 20,
      storage_instructions: null,
      reheating_instructions: null,
      cheap_tips: '["Saisonware"]',
      substitutions: '[]',
      crispiness_level: null,
      air_fryer_time_minutes: null,
      air_fryer_temperature_f: null,
      variant_group: null,
      variant_type: null,
      dorm_friendly: 1,
      meal_prep_friendly: 0,
      why_cheap: null,
      healthier_tips: '[]',
      batch_prep_tips: '[]',
      optional_add_ins: '[]',
      difficulty: 'easy',
      dish_types: '["main"]',
      dietary_tags: '[]',
      hashtags: '["schnell"]',
      default_servings: 2,
      created_by: 'user-1',
      created_at: '2026-08-18T12:00:00.000Z',
    };
    mockDbGetAllAsync
      .mockResolvedValueOnce([row])
      .mockResolvedValueOnce([{ id: 'component-1', recipe_id: 'recipe-1', serving_grams: 100 }])
      .mockResolvedValueOnce([
        {
          component_id: 'component-1',
          product_id: 'product-1',
          sub_component_id: null,
          grams: 100,
          recipe_id: 'recipe-1',
        },
      ])
      .mockResolvedValueOnce([
        {
          id: 'product-1',
          kcal_per_100: 200,
          protein_g_per_100: 10,
          carbs_g_per_100: 20,
          fat_g_per_100: 5,
        },
      ]);

    const { result } = await renderHook(() => useRecipes('hh-1'), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual([
      expect.objectContaining({
        id: 'recipe-1',
        cheap_tips: ['Saisonware'],
        dish_types: ['main'],
        hashtags: ['schnell'],
        dorm_friendly: true,
        meal_prep_friendly: false,
        kcalPerServing: 200,
        proteinGPerServing: 10,
        carbsGPerServing: 20,
      }),
    ]);
  });

  it('liefert eine leere Rezeptliste ohne Nährwertabfragen und lädt keine Rezepte ohne Haushalt', async () => {
    mockDbGetAllAsync.mockResolvedValueOnce([]);

    const { result } = await renderHook(() => useRecipes('hh-1'), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([]);
    expect(mockDbGetAllAsync).toHaveBeenCalledTimes(1);

    const disabled = await renderHook(() => useRecipes(undefined), { wrapper });
    expect(disabled.result.current.fetchStatus).toBe('idle');
  });

  it('lädt Rezeptdetails samt Zutaten, Schrittbildern und Produktdaten', async () => {
    const row = {
      id: 'recipe-1',
      household_id: 'hh-1',
      title: 'Gemuesepfanne',
      instructions: null,
      cover_image_path: null,
      prep_time_minutes: null,
      cook_time_minutes: 20,
      storage_instructions: null,
      reheating_instructions: null,
      cheap_tips: '[]',
      substitutions: '[]',
      crispiness_level: null,
      air_fryer_time_minutes: null,
      air_fryer_temperature_f: null,
      variant_group: null,
      variant_type: null,
      dorm_friendly: null,
      meal_prep_friendly: null,
      why_cheap: null,
      healthier_tips: '[]',
      batch_prep_tips: '[]',
      optional_add_ins: '[]',
      difficulty: null,
      dish_types: '[]',
      dietary_tags: '[]',
      hashtags: '[]',
      default_servings: 2,
      created_by: 'user-1',
      created_at: '2026-08-18T12:00:00.000Z',
    };
    mockDbGetFirstAsync.mockResolvedValueOnce(row);
    mockDbGetAllAsync
      .mockResolvedValueOnce([
        { id: 'component-1', recipe_id: 'recipe-1', name: 'Gemüse', serving_grams: 100 },
      ])
      .mockResolvedValueOnce([
        {
          id: 'item-1',
          component_id: 'component-1',
          product_id: 'product-1',
          sub_component_id: null,
          grams: 100,
          quantity: 1,
          unit: 'Stück',
          optional: 1,
          note: 'gewürfelt',
        },
      ])
      .mockResolvedValueOnce([
        {
          id: 'step-1',
          recipe_id: 'recipe-1',
          position: 0,
          text: 'Schneiden',
          image_path: null,
          timer_minutes: 5,
        },
      ])
      .mockResolvedValueOnce([
        {
          id: 'image-1',
          step_id: 'step-1',
          recipe_id: 'recipe-1',
          household_id: 'hh-1',
          storage_path: 'step.jpg',
          position: 0,
        },
      ])
      .mockResolvedValueOnce([{ step_id: 'step-1', item_id: 'item-1' }])
      .mockResolvedValueOnce([
        {
          id: 'product-1',
          name: 'Karotte',
          kcal_per_100: 40,
          protein_g_per_100: 1,
          carbs_g_per_100: 9,
          fat_g_per_100: 0,
        },
      ]);

    const { result } = await renderHook(() => useRecipeDetail('recipe-1'), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.recipe).toEqual(
      expect.objectContaining({ id: 'recipe-1', dorm_friendly: null }),
    );
    expect(result.current.data?.items).toEqual([
      expect.objectContaining({ optional: true, note: 'gewürfelt' }),
    ]);
    expect(result.current.data?.steps).toEqual([
      expect.objectContaining({
        images: [expect.objectContaining({ id: 'image-1' })],
        ingredientIds: ['item-1'],
      }),
    ]);
    expect(result.current.data?.productsById.get('product-1')).toEqual(
      expect.objectContaining({ name: 'Karotte' }),
    );

    mockDbGetFirstAsync.mockResolvedValueOnce(null);
    const missing = await renderHook(() => useRecipeDetail('missing'), { wrapper });
    await waitFor(() => expect(missing.result.current.isSuccess).toBe(true));
    expect(missing.result.current.data).toBeNull();
  });

  it('reiht Rezeptänderungen samt Metadaten in die Outbox ein', async () => {
    const { result } = await renderHook(() => useUpdateRecipeMutation(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        id: 'recipe-1',
        household_id: 'hh-1',
        title: 'Neue Pfanne',
        prep_time_minutes: 10,
        storage_instructions: 'Kühl lagern',
        reheating_instructions: 'In der Pfanne erwärmen',
        cheap_tips: ['Saisonware'],
        substitutions: [{ forIngredientId: 'carrot', swap: 'Kürbis' }],
        crispiness_level: 'knusprig',
        air_fryer_time_minutes: 12,
        air_fryer_temperature_f: 390,
        variant_group: 'basis',
        variant_type: 'classic',
        dorm_friendly: true,
        meal_prep_friendly: false,
        why_cheap: 'Günstig erhältlich',
        healthier_tips: ['Mehr Gemüse'],
        batch_prep_tips: ['Doppelte Menge kochen'],
        optional_add_ins: ['Käse'],
      });
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(enqueueMutation).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        entity: 'recipes',
        entityId: 'recipe-1',
        op: 'update',
        payload: expect.objectContaining({
          prep_time_minutes: 10,
          storage_instructions: 'Kühl lagern',
          substitutions: [{ forIngredientId: 'carrot', swap: 'Kürbis' }],
          dorm_friendly: true,
          meal_prep_friendly: false,
        }),
      }),
    );
    const mutation = jest.mocked(enqueueMutation).mock.lastCall?.[1];
    await mutation?.applyLocally({} as SqlDatabase);
    expect(applyLocalMirrorWrite).toHaveBeenCalledWith(
      expect.anything(),
      'recipes',
      'update',
      expect.objectContaining({ id: 'recipe-1', title: 'Neue Pfanne' }),
      expect.any(Number),
    );
  });

  it('loescht vorhandene Rezeptunterdaten in sicherer Kaskadenreihenfolge', async () => {
    mockDbGetAllAsync
      .mockResolvedValueOnce([{ id: 'component-1' }])
      .mockResolvedValueOnce([{ id: 'item-1' }])
      .mockResolvedValueOnce([{ id: 'step-1' }])
      .mockResolvedValueOnce([{ id: 'step-ingredient-1' }]);

    const { result } = await renderHook(() => useDeleteRecipeMutation(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync({ id: 'recipe-1', household_id: 'hh-1' });
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(jest.mocked(enqueueMutation).mock.calls.map(([, input]) => input.entity)).toEqual([
      'recipe_step_ingredients',
      'recipe_steps',
      'recipe_component_items',
      'recipe_components',
      'recipes',
    ]);
    for (const [, mutation] of jest.mocked(enqueueMutation).mock.calls) {
      await mutation.applyLocally({} as SqlDatabase);
    }
    expect(applyLocalMirrorWrite).toHaveBeenCalledTimes(5);
  });
});
