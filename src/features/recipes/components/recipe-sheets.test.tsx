import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen, waitFor } from '@testing-library/react-native';
import type { RecipeShoppingNeed } from '@/features/recipes/use-recipe-shopping-needs';
import type { RecipeDetail } from '@/features/recipes/use-recipes';
import { RecipeRatingSheet } from './recipe-rating-sheet';
import { RecipeShoppingSheet } from './recipe-shopping-sheet';

const MOCK_NEEDS: RecipeShoppingNeed[] = [];
const mockGetRecipeRating = jest.fn();

jest.mock('@/features/auth/session-provider', () => ({
  useSession: () => ({ session: { user: { id: 'user-a' } } }),
}));

jest.mock('@/features/premium/premium-provider', () => ({
  usePremium: () => ({ isPremium: true, refresh: jest.fn() }),
}));

jest.mock('@/features/recipes/recipe-ratings', () => ({
  getRecipeRating: (...args: unknown[]) => mockGetRecipeRating(...args),
  saveRecipeRating: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/features/recipes/use-recipe-shopping-needs', () => ({
  useRecipeShoppingNeeds: () => ({ data: MOCK_NEEDS, isLoading: false }),
}));

jest.mock('@/features/shopping-list/hooks/use-shopping-list-mutations', () => ({
  useAddShoppingItem: () => ({ mutateAsync: jest.fn(), isPending: false }),
}));

describe('RecipeRatingSheet', () => {
  beforeEach(() => {
    mockGetRecipeRating.mockReset();
    mockGetRecipeRating.mockResolvedValue({ score: 5, note: 'Sehr gut' });
  });

  it('rendert den Bewertungs-Dialog wenn sichtbar', async () => {
    const onClose = jest.fn();

    await render(<RecipeRatingSheet recipeId="rec-1" visible={true} onClose={onClose} />);

    expect(screen.getByText('Rezept bewerten')).toBeTruthy();
  });

  it('zeigt beim Rezeptwechsel keine Bewertung des vorherigen Rezepts', async () => {
    mockGetRecipeRating
      .mockResolvedValueOnce({ score: 5, note: 'Sehr gut' })
      .mockResolvedValueOnce(null);
    const view = await render(
      <RecipeRatingSheet recipeId="rec-1" visible={true} onClose={jest.fn()} />,
    );
    await screen.findByDisplayValue('Sehr gut');

    await act(async () => {
      view.rerender(<RecipeRatingSheet recipeId="rec-2" visible={true} onClose={jest.fn()} />);
    });

    await waitFor(() => {
      expect(screen.queryByDisplayValue('Sehr gut')).toBeNull();
      expect(screen.getByText('Noch keine Bewertung gewählt')).toBeTruthy();
    });
  });
});

describe('RecipeShoppingSheet', () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Number.POSITIVE_INFINITY },
      mutations: { retry: false, gcTime: Number.POSITIVE_INFINITY },
    },
  });

  const mockRecipeDetail: RecipeDetail = {
    recipe: {
      id: 'rec-1',
      household_id: 'hh-1',
      title: 'Pasta al Limone',
      instructions: 'Nudeln kochen, Zitrone dazu.',
      cover_image_path: null,
      cook_time_minutes: 20,
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
        name: 'Sauce',
        serving_grams: 100,
      },
    ],
    items: [
      {
        id: 'item-1',
        component_id: 'comp-1',
        product_id: 'prod-1',
        sub_component_id: null,
        grams: 100,
        quantity: 2,
        unit: 'piece',
      },
    ],
    steps: [],
    productsById: new Map(),
  };

  it('rendert den Einkaufs-Dialog wenn sichtbar', async () => {
    const onClose = jest.fn();

    await render(
      <QueryClientProvider client={queryClient}>
        <RecipeShoppingSheet
          visible={true}
          detail={mockRecipeDetail}
          servings={2}
          onClose={onClose}
        />
      </QueryClientProvider>,
    );

    expect(screen.getByText('Fehlende Zutaten')).toBeTruthy();
  });
});
