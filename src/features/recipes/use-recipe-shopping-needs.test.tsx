import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react-native';
import type React from 'react';

import {
  type RecipeShoppingNeed,
  useRecipeShoppingNeeds,
} from '@/features/recipes/use-recipe-shopping-needs';
import type { RecipeDetail } from '@/features/recipes/use-recipes';

const mockDbGetAllAsync = jest.fn();
const mockDbGetFirstAsync = jest.fn().mockResolvedValue(null);

jest.mock('@/lib/db/client', () => ({
  getDatabase: jest.fn().mockResolvedValue({
    getAllAsync: (...args: unknown[]) => mockDbGetAllAsync(...args),
    getFirstAsync: (...args: unknown[]) => mockDbGetFirstAsync(...args),
  }),
}));

describe('useRecipeShoppingNeeds', () => {
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

  const mockRecipe: RecipeDetail = {
    recipe: {
      id: 'rec-1',
      household_id: 'hh-1',
      title: 'Pesto Pasta',
      instructions: null,
      cover_image_path: null,
      cook_time_minutes: 15,
      difficulty: 'easy',
      dish_types: ['dinner'],
      dietary_tags: ['vegetarian'],
      hashtags: [],
      default_servings: 2,
      created_by: 'user-1',
      created_at: null,
    },
    components: [
      {
        id: 'comp-1',
        recipe_id: 'rec-1',
        name: 'Hauptzutaten',
        serving_grams: 50,
      },
    ],
    items: [
      {
        id: 'item-1',
        component_id: 'comp-1',
        product_id: 'prod-basilikum',
        sub_component_id: null,
        grams: 50,
        quantity: 50,
        unit: 'g',
      },
    ],
    steps: [],
    productsById: new Map(),
  };

  it('berechnet Fehlmengen basierend auf dem Vorratsbestand', async () => {
    mockDbGetAllAsync
      .mockResolvedValueOnce([{ product_id: 'prod-basilikum', quantity: 20, unit: 'g' }])
      .mockResolvedValueOnce([{ id: 'prod-basilikum', name: 'Basilikum', serving_size_g: 50 }])
      .mockResolvedValueOnce([]);

    const { result } = await renderHook(() => useRecipeShoppingNeeds(mockRecipe, 2, true), {
      wrapper,
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    const needs: RecipeShoppingNeed[] = result.current.data ?? [];
    expect(needs).toHaveLength(1);
    expect(needs[0].missingGrams).toBe(80);
  });
});
