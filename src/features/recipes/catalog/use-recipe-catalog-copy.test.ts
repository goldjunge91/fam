import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { createElement, type ReactNode } from 'react';
import type { NutritionTotal } from '@/features/recipes/domain/nutrition';
import { type CatalogDetail, useCopyCatalogRecipeMutation } from './use-recipe-catalog';

const mockAddRecipe = jest.fn();
const mockAddComponent = jest.fn();
const mockAddItem = jest.fn();
const mockAddStep = jest.fn();
const mockAddStepIngredient = jest.fn();
const mockAddProduct = jest.fn();
const mockDeleteRecipe = jest.fn();
const mockUpdateRecipe = jest.fn();
const mockUpdateStep = jest.fn();
const mockStorageCopy = jest.fn();
const mockStorageRemove = jest.fn();
const mockStorageFrom = jest.fn(() => ({ copy: mockStorageCopy, remove: mockStorageRemove }));
let mockHouseholdId: string | null = 'household-1';
let mockUserId: string | null = 'user-1';

jest.mock('@/features/auth/session-provider', () => ({
  useSession: () => ({ session: mockUserId ? { user: { id: mockUserId } } : null }),
}));

jest.mock('@/features/household/active-household-provider', () => ({
  useActiveHousehold: () => ({ activeHouseholdId: mockHouseholdId }),
}));

jest.mock('@/features/inventory/use-product-mutations', () => ({
  useAddProductMutation: () => ({ mutateAsync: mockAddProduct }),
}));

jest.mock('@/features/recipes/hooks/use-recipe-components', () => ({
  useAddComponentMutation: () => ({ mutateAsync: mockAddComponent }),
  useAddItemMutation: () => ({ mutateAsync: mockAddItem }),
}));

jest.mock('@/features/recipes/hooks/use-recipe-steps', () => ({
  useAddStepIngredientMutation: () => ({ mutateAsync: mockAddStepIngredient }),
  useAddStepMutation: () => ({ mutateAsync: mockAddStep }),
  useUpdateStepMutation: () => ({ mutateAsync: mockUpdateStep }),
}));

jest.mock('@/features/recipes/hooks/use-recipes', () => ({
  useAddRecipeMutation: () => ({ mutateAsync: mockAddRecipe }),
  useDeleteRecipeMutation: () => ({ mutateAsync: mockDeleteRecipe }),
  useUpdateRecipeMutation: () => ({ mutateAsync: mockUpdateRecipe }),
}));

jest.mock('@/lib/backend/supabase/remote-client', () => ({
  getSupabase: () => ({
    storage: { from: mockStorageFrom },
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

function validSource(overrides: Partial<CatalogDetail> = {}): CatalogDetail {
  const item: CatalogDetail['items'][number] = {
    id: 'item-1',
    component_id: 'main',
    recipe_id: 'catalog-1',
    product_id: 'product-1',
    sub_component_id: null,
    ingredient_name: null,
    grams: 20,
    quantity: null,
    unit: 'g',
    position: 0,
    optional: false,
    note: null,
  };
  return {
    ...detail,
    components: [
      { id: 'main', recipe_id: 'catalog-1', name: 'Main', serving_grams: null, position: 0 },
    ],
    items: [item],
    ...overrides,
  };
}

function wrapper({ children }: { children: ReactNode }) {
  return createElement(QueryClientProvider, { client: queryClient }, children);
}

describe('useCopyCatalogRecipeMutation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockHouseholdId = 'household-1';
    mockUserId = 'user-1';
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: Number.POSITIVE_INFINITY },
        mutations: { retry: false, gcTime: Number.POSITIVE_INFINITY },
      },
    });
    mockAddRecipe.mockResolvedValue({ id: 'household-recipe-1' });
    mockAddComponent.mockImplementation(async ({ name }: { name: string }) => ({ id: name }));
    mockAddItem.mockImplementation(async () => ({ id: `item-${mockAddItem.mock.calls.length}` }));
    mockAddStep.mockImplementation(async ({ position }: { position: number }) => ({
      id: `step-${position}`,
    }));
    mockAddStepIngredient.mockResolvedValue(undefined);
    mockAddProduct.mockResolvedValue({ id: 'manual-product' });
    mockDeleteRecipe.mockResolvedValue(undefined);
    mockUpdateRecipe.mockResolvedValue(undefined);
    mockUpdateStep.mockResolvedValue(undefined);
    mockStorageCopy.mockResolvedValue({
      data: { path: 'household-1/copied.jpg' },
      error: null,
    });
    mockStorageRemove.mockResolvedValue({ error: null });
  });

  afterEach(() => {
    queryClient.clear();
  });

  it('übernimmt ein Rezept mit externer Bildquelle ohne Storage-Kopie', async () => {
    const { result } = await renderHook(() => useCopyCatalogRecipeMutation(), { wrapper });

    await act(async () => {
      await expect(result.current.mutateAsync(detail)).resolves.toEqual({
        id: 'household-recipe-1',
      });
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockStorageCopy).not.toHaveBeenCalled();
    expect(mockAddRecipe).toHaveBeenCalledWith(expect.objectContaining({ cover_image_path: null }));
  });

  it('kopiert Gruppen, Zutaten, Schritte und verknüpfte Bilder in den Haushalt', async () => {
    queryClient.setQueryData(['recipes', 'household-1'], []);
    queryClient.setQueryData(['recipe-detail', 'household-recipe-1'], {});
    const { result } = await renderHook(() => useCopyCatalogRecipeMutation(), { wrapper });
    const source: CatalogDetail = {
      ...detail,
      recipe: {
        ...detail.recipe,
        external_id: 'catalog:meal',
        cover_image_path: 'catalog/meal.jpg',
      },
      components: [
        {
          id: 'main',
          recipe_id: 'catalog-1',
          name: 'Hauptgruppe',
          serving_grams: null,
          position: 0,
        },
        { id: 'side', recipe_id: 'catalog-1', name: 'Beilage', serving_grams: 0, position: 1 },
      ],
      items: [
        {
          id: 'existing-item',
          component_id: 'main',
          recipe_id: 'catalog-1',
          product_id: 'existing-product',
          sub_component_id: null,
          ingredient_name: null,
          grams: 80,
          quantity: 2,
          unit: 'Stück',
          position: 0,
          optional: false,
          note: null,
        },
        {
          id: 'manual-one',
          component_id: 'main',
          recipe_id: 'catalog-1',
          product_id: null,
          sub_component_id: null,
          ingredient_name: ' Salz ',
          grams: 5,
          quantity: null,
          unit: 'g',
          position: 1,
          optional: false,
          note: null,
        },
        {
          id: 'manual-two',
          component_id: 'side',
          recipe_id: 'catalog-1',
          product_id: null,
          sub_component_id: null,
          ingredient_name: 'salz',
          grams: 3,
          quantity: null,
          unit: 'g',
          position: 2,
          optional: true,
          note: 'nach Geschmack',
        },
        {
          id: 'subcomponent-item',
          component_id: 'side',
          recipe_id: 'catalog-1',
          product_id: null,
          sub_component_id: 'main',
          ingredient_name: null,
          grams: 3,
          quantity: null,
          unit: 'g',
          position: 3,
          optional: false,
          note: null,
        },
      ],
      steps: [
        {
          id: 'source-step-1',
          recipe_id: 'catalog-1',
          position: 0,
          text: 'Mischen',
          timer_minutes: 2,
        },
        {
          id: 'source-step-2',
          recipe_id: 'catalog-1',
          position: 1,
          text: 'Servieren',
          timer_minutes: null,
        },
      ],
      stepImages: [{ step_id: 'source-step-1', storage_path: 'catalog/step.jpg', position: 0 }],
      stepIngredients: [
        { step_id: 'source-step-1', item_id: 'existing-item', recipe_id: 'catalog-1', position: 0 },
        {
          step_id: 'source-step-2',
          item_id: 'subcomponent-item',
          recipe_id: 'catalog-1',
          position: 0,
        },
      ],
      images: [
        {
          ...detail.images[0],
          storage_path: 'catalog/meal.jpg',
          source_url: null,
        },
      ],
    };

    await act(async () => {
      await expect(result.current.mutateAsync(source)).resolves.toEqual({
        id: 'household-recipe-1',
      });
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockStorageFrom).toHaveBeenCalledWith('recipe-catalog');
    expect(mockStorageCopy).toHaveBeenNthCalledWith(
      1,
      'catalog/meal.jpg',
      'household-1/household-recipe-1.jpg',
      { destinationBucket: 'recipe-covers' },
    );
    expect(mockStorageCopy).toHaveBeenNthCalledWith(
      2,
      'catalog/step.jpg',
      'household-1/step-0.jpg',
      { destinationBucket: 'recipe-step-images' },
    );
    expect(mockUpdateRecipe).toHaveBeenCalledWith(
      expect.objectContaining({ cover_image_path: 'household-1/household-recipe-1.jpg' }),
    );
    expect(mockUpdateStep).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'step-0', image_path: 'household-1/step-0.jpg' }),
    );
    expect(mockAddComponent).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ name: 'Hauptgruppe', serving_grams: 85 }),
    );
    expect(mockAddComponent).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ name: 'Beilage', serving_grams: null }),
    );
    expect(mockAddProduct).toHaveBeenCalledTimes(1);
    expect(mockAddProduct).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Salz', source: 'manual', created_by: 'user-1' }),
    );
    expect(mockAddItem).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ product_id: 'existing-product', sub_component_id: null }),
    );
    expect(mockAddItem).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({ product_id: 'manual-product', sub_component_id: null }),
    );
    expect(mockAddItem).toHaveBeenNthCalledWith(
      4,
      expect.objectContaining({ product_id: null, sub_component_id: 'Hauptgruppe' }),
    );
    expect(mockAddStepIngredient).toHaveBeenCalledTimes(2);
    expect(queryClient.getQueryState(['recipes', 'household-1'])?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(['recipe-detail', 'household-recipe-1'])?.isInvalidated).toBe(
      true,
    );
  });

  it.each([
    ['a missing household', null, 'user-1'],
    ['a missing user', 'household-1', null],
  ])('rejects copying with %s', async (_label, householdId, userId) => {
    mockHouseholdId = householdId;
    mockUserId = userId;
    const { result } = await renderHook(() => useCopyCatalogRecipeMutation(), { wrapper });

    await act(async () => {
      await expect(result.current.mutateAsync(detail)).rejects.toThrow('Kein aktiver Haushalt.');
    });
    expect(mockAddRecipe).not.toHaveBeenCalled();
  });

  it.each([
    [
      'doppelte Zutaten-Gruppen',
      validSource({
        components: [
          { id: 'same', recipe_id: 'catalog-1', name: 'A', serving_grams: 1, position: 0 },
          { id: 'same', recipe_id: 'catalog-1', name: 'B', serving_grams: 1, position: 1 },
        ],
      }),
    ],
    [
      'keinen Namen',
      validSource({
        components: [
          { id: 'empty', recipe_id: 'catalog-1', name: '  ', serving_grams: null, position: 0 },
        ],
      }),
    ],
    [
      'doppelte Zutaten',
      validSource({
        items: [
          { ...validSource().items[0], id: 'same' },
          { ...validSource().items[0], id: 'same' },
        ],
      }),
    ],
    [
      'nicht vorhandene Zutaten-Gruppe',
      validSource({ items: [{ ...validSource().items[0], component_id: 'missing' }] }),
    ],
    [
      'kein eindeutiges Ziel',
      validSource({ items: [{ ...validSource().items[0], ingredient_name: 'Salt' }] }),
    ],
    [
      'nicht vorhandene Untergruppe',
      validSource({
        items: [{ ...validSource().items[0], product_id: null, sub_component_id: 'missing' }],
      }),
    ],
    [
      'sich selbst enthalten',
      validSource({
        items: [{ ...validSource().items[0], product_id: null, sub_component_id: 'main' }],
      }),
    ],
    ['gültige Grammmenge', validSource({ items: [{ ...validSource().items[0], grams: 0 }] })],
    [
      'doppelte Zubereitungsschritte',
      validSource({
        steps: [
          { id: 'same', recipe_id: 'catalog-1', position: 0, text: 'Mix', timer_minutes: null },
          { id: 'same', recipe_id: 'catalog-1', position: 1, text: 'Bake', timer_minutes: null },
        ],
      }),
    ],
    [
      'Zubereitungsschritt ist leer',
      validSource({
        steps: [
          { id: 'step-1', recipe_id: 'catalog-1', position: 0, text: ' ', timer_minutes: null },
        ],
      }),
    ],
    [
      'Schritt-Zutaten-Verknüpfung ist ungültig',
      validSource({
        stepIngredients: [
          { step_id: 'missing', item_id: 'missing', recipe_id: 'catalog-1', position: 0 },
        ],
      }),
    ],
  ])('lehnt Quelldaten mit %s vor dem Schreiben ab', async (message, invalidDetail) => {
    const { result } = await renderHook(() => useCopyCatalogRecipeMutation(), { wrapper });

    await act(async () => {
      await expect(result.current.mutateAsync(invalidDetail)).rejects.toThrow(message);
    });
    expect(mockAddRecipe).not.toHaveBeenCalled();
  });

  it('entfernt neu angelegte Datei und Rezept, wenn das Schrittbild nicht kopiert werden kann', async () => {
    const source: CatalogDetail = {
      ...detail,
      recipe: {
        ...detail.recipe,
        external_id: 'catalog:meal',
        cover_image_path: 'catalog/meal.jpg',
      },
      images: [{ ...detail.images[0], storage_path: 'catalog/meal.jpg', source_url: null }],
      steps: [
        {
          id: 'source-step',
          recipe_id: 'catalog-1',
          position: 0,
          text: 'Mix',
          timer_minutes: null,
        },
      ],
      stepImages: [{ step_id: 'source-step', storage_path: 'catalog/step.jpg', position: 0 }],
    };
    mockStorageCopy
      .mockResolvedValueOnce({ data: { path: 'household-1/cover.jpg' }, error: null })
      .mockResolvedValueOnce({ data: null, error: { message: 'step image missing' } });
    const { result } = await renderHook(() => useCopyCatalogRecipeMutation(), { wrapper });

    await act(async () => {
      await expect(result.current.mutateAsync(source)).rejects.toMatchObject({
        message: 'step image missing',
      });
    });
    expect(mockDeleteRecipe).toHaveBeenCalledWith({
      id: 'household-recipe-1',
      household_id: 'household-1',
    });
    expect(mockStorageRemove).toHaveBeenCalledWith(['household-1/household-recipe-1.jpg']);
  });
});
