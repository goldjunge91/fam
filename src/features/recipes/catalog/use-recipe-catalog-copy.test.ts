import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react-native';
import { createElement, type ReactNode } from 'react';
import type { NutritionTotal } from '@/features/recipes/domain/nutrition';
import { type CatalogDetail, useCopyCatalogRecipeMutation } from './use-recipe-catalog';

const mockAddRecipe = jest.fn();
const mockStorageCopy = jest.fn();

jest.mock('@/features/auth/session-provider', () => ({
  useSession: () => ({ session: { user: { id: 'user-1' } } }),
}));

jest.mock('@/features/household/active-household-provider', () => ({
  useActiveHousehold: () => ({ activeHouseholdId: 'household-1' }),
}));

jest.mock('@/features/inventory/use-product-mutations', () => ({
  useAddProductMutation: () => ({ mutateAsync: jest.fn() }),
}));

jest.mock('@/features/recipes/hooks/use-recipe-components', () => ({
  useAddComponentMutation: () => ({ mutateAsync: jest.fn() }),
  useAddItemMutation: () => ({ mutateAsync: jest.fn() }),
}));

jest.mock('@/features/recipes/hooks/use-recipe-steps', () => ({
  useAddStepIngredientMutation: () => ({ mutateAsync: jest.fn() }),
  useAddStepMutation: () => ({ mutateAsync: jest.fn() }),
  useUpdateStepMutation: () => ({ mutateAsync: jest.fn() }),
}));

jest.mock('@/features/recipes/hooks/use-recipes', () => ({
  useAddRecipeMutation: () => ({ mutateAsync: mockAddRecipe }),
  useDeleteRecipeMutation: () => ({ mutateAsync: jest.fn() }),
  useUpdateRecipeMutation: () => ({ mutateAsync: jest.fn() }),
}));

jest.mock('@/lib/backend/supabase/client', () => ({
  getSupabase: () => ({
    storage: {
      from: () => ({ copy: mockStorageCopy }),
    },
  }),
}));

const nutrition: NutritionTotal = {
  grams: 0,
  kcal: 0,
  protein_g: 0,
  carbs_g: 0,
  fat_g: 0,
};

let queryClient: QueryClient;

const detail: CatalogDetail = {
  recipe: {
    id: 'catalog-1',
    external_id: 'waivy:banana-peanut-butter-quesadilla',
    slug: 'banana-peanut-butter-quesadilla',
    title: 'Banana Peanut Butter Quesadilla',
    instructions: null,
    prep_time_minutes: null,
    cook_time_minutes: null,
    storage_instructions: null,
    reheating_instructions: null,
    cheap_tips: [],
    substitutions: [],
    crispiness_level: null,
    air_fryer_time_minutes: null,
    air_fryer_temperature_f: null,
    variant_group: null,
    variant_type: null,
    dorm_friendly: null,
    meal_prep_friendly: null,
    why_cheap: null,
    healthier_tips: [],
    batch_prep_tips: [],
    optional_add_ins: [],
    difficulty: null,
    dish_types: [],
    dietary_tags: [],
    hashtags: [],
    default_servings: 1,
    status: 'published',
    sort_order: 1,
    source_url: 'https://justinsuo.github.io/waivy/recipes/banana-peanut-butter-quesadilla/',
    cover_image_path: null,
  },
  components: [],
  items: [],
  steps: [],
  stepIngredients: [],
  images: [
    {
      id: 'image-1',
      recipe_id: 'catalog-1',
      storage_path: null,
      source_url: 'https://images.example/banana-peanut-butter-quesadilla.jpg',
      source_page_url: null,
      source_name: null,
      license: null,
      attribution_required: false,
      attribution_text: null,
      verified_match: false,
      alt_text: null,
      position: 0,
    },
  ],
  stepImages: [],
  productsById: new Map(),
  nutrition,
};

function wrapper({ children }: { children: ReactNode }) {
  return createElement(QueryClientProvider, { client: queryClient }, children);
}

describe('useCopyCatalogRecipeMutation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: Number.POSITIVE_INFINITY },
        mutations: { retry: false, gcTime: Number.POSITIVE_INFINITY },
      },
    });
    mockAddRecipe.mockResolvedValue({ id: 'household-recipe-1' });
    mockStorageCopy.mockResolvedValue({
      data: null,
      error: { message: 'Object not found' },
    });
  });

  afterEach(() => {
    queryClient.clear();
  });

  it('übernimmt ein Rezept mit externer Bildquelle ohne Storage-Kopie', async () => {
    const { result } = await renderHook(() => useCopyCatalogRecipeMutation(), { wrapper });

    await expect(result.current.mutateAsync(detail)).resolves.toEqual({
      id: 'household-recipe-1',
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockStorageCopy).not.toHaveBeenCalled();
    expect(mockAddRecipe).toHaveBeenCalledWith(expect.objectContaining({ cover_image_path: null }));
  });
});
