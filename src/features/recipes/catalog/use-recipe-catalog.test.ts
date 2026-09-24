import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { createElement, type ReactNode } from 'react';
import { getSupabase } from '@/lib/backend/supabase/remote-client';
import {
  CATALOG_RECIPE_PAGE_SIZE,
  getCatalogImageReference,
  getNextCatalogPageParam,
  resolveCatalogImageUrl,
  useCatalogRecipes,
} from './use-recipe-catalog';

const mockFrom = jest.fn();
const mockRecipeOrder = jest.fn();
const mockRecipeRange = jest.fn();
const mockRecipeOverlaps = jest.fn();
const mockRecipeIlike = jest.fn();
const mockImageIn = jest.fn();
const mockImageOrder = jest.fn();

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
    status: 'published',
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
  jest
    .mocked(getSupabase)
    .mockReturnValue({ from: mockFrom } as unknown as ReturnType<typeof getSupabase>);
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
