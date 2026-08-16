import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, userEvent } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { RecipeDetailScreen } from './recipe-detail-screen';
import type { RecipeRating } from './recipe-ratings';
import type { RecipeDetail } from './use-recipes';

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn() },
  useLocalSearchParams: () => ({ id: 'recipe-1' }),
}));

let mockRating: RecipeRating | null = {
  score: 8,
  note: 'Sehr gut und einfach.',
  updatedAt: '2026-08-16T00:00:00.000Z',
};

const mockDetail: RecipeDetail = {
  recipe: {
    id: 'recipe-1',
    household_id: 'household-1',
    title: 'Geröstetes Ofengemüse',
    instructions: 'Knuspriges Gemüse mit Kräutern und Zitronen-Dressing.',
    cover_image_path: null,
    cook_time_minutes: 35,
    difficulty: 'easy',
    dish_types: ['dinner'],
    dietary_tags: ['vegetarian', 'vegan'],
    hashtags: ['ofengericht', 'familienessen'],
    default_servings: 2,
    created_by: 'user-1',
    created_at: '2026-08-16T00:00:00.000Z',
  },
  components: [
    { id: 'component-1', recipe_id: 'recipe-1', name: 'Ofengemüse', serving_grams: 100 },
  ],
  items: [
    {
      id: 'item-1',
      component_id: 'component-1',
      product_id: 'product-1',
      sub_component_id: null,
      grams: 100,
      quantity: 100,
      unit: 'g',
    },
  ],
  steps: [
    {
      id: 'step-1',
      recipe_id: 'recipe-1',
      position: 0,
      text: 'Gemüse schneiden und auf dem Blech verteilen.',
      image_path: 'household-1/step-1.jpg',
      ingredientIds: [],
    },
  ],
  productsById: new Map([
    [
      'product-1',
      {
        id: 'product-1',
        name: 'Kartoffeln',
        kcal_per_100: 100,
        protein_g_per_100: 3,
        carbs_g_per_100: 20,
        fat_g_per_100: 1,
      },
    ],
  ]),
};

jest.mock('./use-recipes', () => ({
  useRecipeDetail: () => ({ data: mockDetail, isLoading: false }),
  useDeleteRecipeMutation: () => ({ mutate: jest.fn() }),
}));

jest.mock('./recipe-cover', () => ({
  useRecipeCoverUrl: () => ({ data: null }),
}));

jest.mock('./recipe-step-image', () => ({
  useRecipeStepImageUrl: (path: string | null) => ({
    data: path ? `https://example.com/${path}` : null,
  }),
}));

jest.mock('./recipe-favorites', () => ({
  useRecipeFavorites: () => ({ isFavorite: () => false, toggleFavorite: jest.fn() }),
}));

jest.mock('./recipe-ratings', () => ({
  useRecipeRating: () => mockRating,
}));

jest.mock('./components/recipe-shopping-sheet', () => ({
  RecipeShoppingSheet: () => null,
}));

jest.mock('./components/recipe-rating-sheet', () => ({
  RecipeRatingSheet: () => null,
}));

async function renderScreen() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Number.POSITIVE_INFINITY } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <SafeAreaProvider
        initialMetrics={{
          frame: { x: 0, y: 0, width: 390, height: 844 },
          insets: { top: 47, left: 0, right: 0, bottom: 34 },
        }}>
        <RecipeDetailScreen />
      </SafeAreaProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  mockRating = {
    score: 8,
    note: 'Sehr gut und einfach.',
    updatedAt: '2026-08-16T00:00:00.000Z',
  };
});

describe('RecipeDetailScreen', () => {
  it('wechselt zwischen Details und der eigenen Bewertung', async () => {
    const user = userEvent.setup();
    await renderScreen();

    expect(screen.getByRole('tab', { name: 'Details' })).toBeSelected();
    expect(screen.getByText('Zutaten')).toBeOnTheScreen();

    await user.press(screen.getByRole('tab', { name: 'Bewertungen' }));

    expect(screen.getByRole('tab', { name: 'Bewertungen' })).toBeSelected();
    expect(screen.getByText('Sehr gut und einfach.')).toBeOnTheScreen();
    expect(screen.queryByText('Zutaten')).not.toBeOnTheScreen();
  });

  it('zeigt zunaechst drei Tags und klappt die restlichen auf', async () => {
    const user = userEvent.setup();
    await renderScreen();

    expect(screen.queryByText('#ofengericht')).not.toBeOnTheScreen();

    await user.press(screen.getByRole('button', { name: 'Alle Tags anzeigen' }));

    expect(screen.getByText('#ofengericht')).toBeOnTheScreen();
    expect(screen.getByText('#familienessen')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Weniger Tags anzeigen' })).toBeExpanded();
  });

  it('zeigt vorhandene Bilder an den Zubereitungsschritten', async () => {
    await renderScreen();

    expect(screen.getByLabelText('Bild für Schritt 1')).toBeOnTheScreen();
    expect(screen.getByText('Gemüse schneiden und auf dem Blech verteilen.')).toBeOnTheScreen();
  });
});
