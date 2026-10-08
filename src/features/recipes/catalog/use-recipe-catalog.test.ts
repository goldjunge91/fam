import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { createElement, type ReactNode } from 'react';
import { getSupabase } from '@/lib/backend/supabase/remote-client';
import {
  CATALOG_RECIPE_PAGE_SIZE,
  type CatalogDetail,
  getCatalogImageReference,
  getNextCatalogPageParam,
  resolveCatalogImageUrl,
  toCookingRecipeDetail,
  useCatalogImageUrl,
  useCatalogRecipes,
} from './use-recipe-catalog';

const mockFrom = jest.fn();
const mockRecipeOrder = jest.fn();
const mockRecipeRange = jest.fn();
const mockRecipeOverlaps = jest.fn();
const mockRecipeIlike = jest.fn();
const mockImageIn = jest.fn();
const mockImageOrder = jest.fn();
const mockSignedUrl = jest.fn();
const mockStorageFrom = jest.fn(() => ({ createSignedUrl: mockSignedUrl }));

jest.mock('@/lib/backend/supabase/remote-client', () => ({
  getSupabase: jest.fn(),
}));

function createRecipeBuilder() {
  const builder = {
    select: jest.fn(),
    eq: jest.fn(),
    overlaps: mockRecipeOverlaps,
    ilike: mockRecipeIlike,
    order: mockRecipeOrder,
    range: mockRecipeRange,
  };
  builder.select.mockReturnValue(builder);
  builder.eq.mockReturnValue(builder);
  builder.overlaps.mockReturnValue(builder);
  builder.ilike.mockReturnValue(builder);
  builder.order.mockReturnValue(builder);
  return builder;
}

function createImageBuilder() {
  const builder = {
    select: jest.fn(),
    in: mockImageIn,
    order: mockImageOrder,
  };
  builder.select.mockReturnValue(builder);
  builder.in.mockReturnValue(builder);
  return builder;
}

function makeCatalogRow(id: string, sortOrder: number) {
  return {
    id,
    external_id: `template:${id}`,
    slug: id,
    title: `Rezept ${id}`,
    cook_time_minutes: null,
    difficulty: null,
    dish_types: ['breakfast'],
    dietary_tags: [],
    default_servings: 2,
    status: 'published' as const,
    sort_order: sortOrder,
  };
}

let queryClient: QueryClient;

function QueryProviders({ children }: { children: ReactNode }) {
  return createElement(QueryClientProvider, { client: queryClient }, children);
}

beforeEach(() => {
  jest.clearAllMocks();
  queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Number.POSITIVE_INFINITY } },
  });

  const recipeBuilder = createRecipeBuilder();
  const imageBuilder = createImageBuilder();
  mockFrom.mockImplementation((table: string) =>
    table === 'catalog_recipes' ? recipeBuilder : imageBuilder,
  );
  mockRecipeRange.mockReturnValue({ data: [], error: null });
  mockImageOrder.mockReturnValue({ data: [], error: null });
  jest.mocked(getSupabase).mockReturnValue({
    from: mockFrom,
    storage: { from: mockStorageFrom },
  } as unknown as ReturnType<typeof getSupabase>);
});

afterEach(() => {
  queryClient.clear();
});

describe('useCatalogRecipes', () => {
  it('fragt eine Mahlzeitenkategorie mit stabiler Sortierung und Seitenbereich ab', async () => {
    mockRecipeRange.mockReturnValue({
      data: [makeCatalogRow('breakfast-1', 1)],
      error: null,
    });

    const { result } = await renderHook(
      () => useCatalogRecipes({ dishTypes: ['breakfast'], searchQuery: 'Porridge' }),
      { wrapper: QueryProviders },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockRecipeOverlaps).toHaveBeenCalledWith('dish_types', ['breakfast']);
    expect(mockRecipeIlike).toHaveBeenCalledWith('title', '%Porridge%');
    expect(mockRecipeOrder).toHaveBeenNthCalledWith(1, 'sort_order', { ascending: true });
    expect(mockRecipeOrder).toHaveBeenNthCalledWith(2, 'title', { ascending: true });
    expect(mockRecipeOrder).toHaveBeenNthCalledWith(3, 'id', { ascending: true });
    expect(mockRecipeRange).toHaveBeenCalledWith(0, CATALOG_RECIPE_PAGE_SIZE - 1);
    expect(mockImageIn).toHaveBeenCalledWith('recipe_id', ['breakfast-1']);
  });

  it('holt die nächste Seite mit dem nächsten Offset und fragt nur deren Bilder ab', async () => {
    const firstPage = Array.from({ length: CATALOG_RECIPE_PAGE_SIZE }, (_, index) =>
      makeCatalogRow(`recipe-${index + 1}`, index + 1),
    );
    const secondPageRow = makeCatalogRow('recipe-21', 21);
    mockRecipeRange
      .mockReturnValueOnce({ data: firstPage, error: null })
      .mockReturnValueOnce({ data: [secondPageRow], error: null });

    const { result } = await renderHook(() => useCatalogRecipes(), { wrapper: QueryProviders });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toHaveLength(CATALOG_RECIPE_PAGE_SIZE);
    expect(result.current.hasNextPage).toBe(true);

    await act(async () => {
      await result.current.fetchNextPage();
    });

    expect(mockRecipeRange).toHaveBeenNthCalledWith(
      2,
      CATALOG_RECIPE_PAGE_SIZE,
      CATALOG_RECIPE_PAGE_SIZE * 2 - 1,
    );
    await waitFor(() => expect(result.current.data).toHaveLength(CATALOG_RECIPE_PAGE_SIZE + 1));
    expect(mockImageIn).toHaveBeenNthCalledWith(2, 'recipe_id', ['recipe-21']);
  });
});

describe('getNextCatalogPageParam', () => {
  it('advances by one page while more catalog recipes exist', () => {
    expect(getNextCatalogPageParam({ recipes: [], hasMore: true }, CATALOG_RECIPE_PAGE_SIZE)).toBe(
      CATALOG_RECIPE_PAGE_SIZE * 2,
    );
  });

  it('stops after the last catalog page', () => {
    expect(getNextCatalogPageParam({ recipes: [], hasMore: false }, 0)).toBeUndefined();
  });
});

describe('resolveCatalogImageUrl', () => {
  it('returns remote image URLs without treating them as storage paths', () => {
    expect(resolveCatalogImageUrl('https://images.example/recipe.jpg')).toBe(
      'https://images.example/recipe.jpg',
    );
  });

  it('rejects insecure HTTP image URLs', () => {
    expect(resolveCatalogImageUrl('http://images.example/recipe.jpg')).toBeNull();
  });

  it('returns null for a storage path', () => {
    expect(resolveCatalogImageUrl('waivy/recipe.jpg')).toBeNull();
  });
});

describe('getCatalogImageReference', () => {
  it('prefers a locally stored image over the remote source', () => {
    expect(
      getCatalogImageReference({
        storage_path: 'waivy/recipe.jpg',
        source_url: 'https://images.example/recipe.jpg',
      }),
    ).toBe('waivy/recipe.jpg');
  });

  it('falls back to the remote source when no local image exists', () => {
    expect(
      getCatalogImageReference({
        storage_path: null,
        source_url: 'https://images.example/recipe.jpg',
      }),
    ).toBe('https://images.example/recipe.jpg');
  });

  it('returns null when neither image source exists', () => {
    expect(getCatalogImageReference({ storage_path: null, source_url: null })).toBeNull();
  });
});

describe('useCatalogImageUrl', () => {
  it('signs a legacy template cover from the recipe-covers bucket', async () => {
    mockSignedUrl.mockResolvedValue({
      data: { signedUrl: 'https://signed.example/template.jpg' },
      error: null,
    });

    const { result } = await renderHook(() => useCatalogImageUrl('templates/recipe-1.jpg'), {
      wrapper: QueryProviders,
    });

    await waitFor(() => expect(result.current.data).toBe('https://signed.example/template.jpg'));
    expect(mockStorageFrom).toHaveBeenCalledWith('recipe-covers');
    expect(mockSignedUrl).toHaveBeenCalledWith('templates/recipe-1.jpg', 3600);
  });

  it('tries the fallback bucket after the catalog bucket cannot sign the path', async () => {
    mockSignedUrl
      .mockResolvedValueOnce({ data: null, error: { message: 'missing' } })
      .mockResolvedValueOnce({
        data: { signedUrl: 'https://signed.example/catalog.jpg' },
        error: null,
      });

    const { result } = await renderHook(() => useCatalogImageUrl('waivy/recipe.jpg'), {
      wrapper: QueryProviders,
    });

    await waitFor(() => expect(result.current.data).toBe('https://signed.example/catalog.jpg'));
    expect(mockStorageFrom.mock.calls).toEqual([['recipe-catalog'], ['recipe-covers']]);
  });
});

describe('toCookingRecipeDetail', () => {
  it('maps linked ingredients to their cooking steps and leaves unlinked steps empty', () => {
    const detail = {
      recipe: {
        ...makeCatalogRow('recipe-1', 1),
        instructions: null,
        hashtags: [],
        source_url: null,
        cover_image_path: null,
      },
      components: [],
      items: [],
      steps: [
        { id: 'step-1', recipe_id: 'recipe-1', position: 0, text: 'Mix', timer_minutes: null },
        { id: 'step-2', recipe_id: 'recipe-1', position: 1, text: 'Bake', timer_minutes: 10 },
      ],
      stepIngredients: [
        { step_id: 'step-1', item_id: 'item-1', recipe_id: 'recipe-1', position: 0 },
        { step_id: 'step-1', item_id: 'item-2', recipe_id: 'recipe-1', position: 1 },
      ],
      images: [],
      stepImages: [],
      productsById: new Map(),
      nutrition: { grams: 0, kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0 },
    } satisfies CatalogDetail;

    const result = toCookingRecipeDetail(detail);

    expect(result.steps).toEqual([
      {
        id: 'step-1',
        recipe_id: 'recipe-1',
        position: 0,
        text: 'Mix',
        image_path: null,
        timer_minutes: null,
        ingredientIds: ['item-1', 'item-2'],
      },
      {
        id: 'step-2',
        recipe_id: 'recipe-1',
        position: 1,
        text: 'Bake',
        image_path: null,
        timer_minutes: 10,
        ingredientIds: [],
      },
    ]);
    expect(result.recipe.household_id).toBe('');
  });
});
