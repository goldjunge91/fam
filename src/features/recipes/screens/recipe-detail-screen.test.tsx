import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, userEvent, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import { Alert, Share } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import type { RecipeRating } from '../domain/recipe-ratings';
import type { RecipeDetail } from '../hooks/use-recipes';
import { RecipeDetailScreen } from './recipe-detail-screen';

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn() },
  useLocalSearchParams: () => ({ id: 'recipe-1' }),
}));

jest.mock('@/features/navigation/navigation-chrome-provider', () => ({
  useNavigationChrome: () => ({ openProfile: jest.fn() }),
}));

jest.mock('@/features/navigation/use-profile-initials', () => ({
  useProfileAvatar: () => ({ initials: 'MM', avatarUrl: null }),
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
      timer_minutes: null,
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

let mockCurrentDetail: RecipeDetail | null = mockDetail;
let mockIsLoading = false;
let mockFavorite = false;
let mockCoverUrl: string | null = null;
const mockToggleFavorite = jest.fn();
const mockDeleteRecipe = jest.fn();

jest.mock('../hooks/use-recipes', () => ({
  useRecipeDetail: () => ({ data: mockCurrentDetail, isLoading: mockIsLoading }),
  useDeleteRecipeMutation: () => ({ mutate: mockDeleteRecipe }),
}));

jest.mock('../data/household-recipe-images', () => ({
  useRecipeCoverUrl: () => ({ data: mockCoverUrl }),
  useRecipeStepImageUrl: (path: string | null) => ({
    data: path ? `https://example.com/${path}` : null,
  }),
}));

jest.mock('../domain/recipe-favorites', () => ({
  useRecipeFavorites: () => ({
    isFavorite: () => mockFavorite,
    toggleFavorite: mockToggleFavorite,
  }),
}));

jest.mock('../domain/recipe-ratings', () => ({
  useRecipeRating: () => mockRating,
}));

jest.mock('../components/recipe-shopping-sheet', () => ({
  RecipeShoppingSheet: ({
    visible,
    detail,
    servings,
    onClose,
  }: {
    visible: boolean;
    detail: RecipeDetail;
    servings: number;
    onClose: () => void;
  }) => {
    if (!visible) return null;
    const React = jest.requireActual<typeof import('react')>('react');
    const {
      Pressable: NativePressable,
      Text: NativeText,
      View: NativeView,
    } = jest.requireActual<typeof import('react-native')>('react-native');
    return React.createElement(
      NativeView,
      null,
      React.createElement(NativeText, null, `${detail.recipe.title}: ${servings} Portionen`),
      React.createElement(
        NativePressable,
        { accessibilityRole: 'button', onPress: onClose },
        React.createElement(NativeText, null, 'Einkaufsliste schließen'),
      ),
    );
  },
}));

jest.mock('../components/recipe-rating-sheet', () => ({
  RecipeRatingSheet: ({ visible, onClose }: { visible: boolean; onClose: () => void }) => {
    if (!visible) return null;
    const React = jest.requireActual<typeof import('react')>('react');
    const { Pressable: NativePressable, Text: NativeText } =
      jest.requireActual<typeof import('react-native')>('react-native');
    return React.createElement(
      NativePressable,
      { accessibilityRole: 'button', onPress: onClose },
      React.createElement(NativeText, null, 'Bewertung schließen'),
    );
  },
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
  mockCurrentDetail = mockDetail;
  mockIsLoading = false;
  mockFavorite = false;
  mockCoverUrl = null;
  mockToggleFavorite.mockClear();
  mockDeleteRecipe.mockReset();
  (router.push as jest.Mock).mockClear();
  (router.back as jest.Mock).mockClear();
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
    mockCurrentDetail = {
      ...mockDetail,
      steps: [
        ...mockDetail.steps,
        {
          id: 'step-2',
          recipe_id: 'recipe-1',
          position: 1,
          text: 'Mit zwei Bildern anrichten.',
          image_path: null,
          images: [
            {
              id: 'image-1',
              step_id: 'step-2',
              recipe_id: 'recipe-1',
              household_id: 'household-1',
              storage_path: 'household-1/step-2-a.jpg',
              position: 0,
            },
            {
              id: 'image-2',
              step_id: 'step-2',
              recipe_id: 'recipe-1',
              household_id: 'household-1',
              storage_path: 'household-1/step-2-b.jpg',
              position: 1,
            },
          ],
          timer_minutes: 2,
          ingredientIds: [],
        },
      ],
    };
    await renderScreen();

    expect(screen.getByLabelText('Bild für Schritt 1')).toBeOnTheScreen();
    expect(screen.getByLabelText('Bild für Schritt 2')).toBeOnTheScreen();
    expect(screen.getByLabelText('Bild 2 für Schritt 2')).toBeOnTheScreen();
    expect(screen.getByText('Gemüse schneiden und auf dem Blech verteilen.')).toBeOnTheScreen();
  });

  it('zeigt den Ladezustand bevor das lokale Rezept vorliegt', async () => {
    mockCurrentDetail = null;
    mockIsLoading = true;
    await renderScreen();

    expect(screen.getByText('Rezept wird geladen…')).toBeOnTheScreen();
  });

  it('skaliert Zutaten, öffnet beide Sheets, Favoriten und den Kochmodus', async () => {
    const user = userEvent.setup();
    mockFavorite = true;
    mockCoverUrl = 'https://images.example/recipe.jpg';
    await renderScreen();

    expect(screen.getByRole('button', { name: 'Aus Favoriten entfernen' })).toBeOnTheScreen();
    expect(screen.getByText('100 kcal')).toBeOnTheScreen();
    expect(screen.getByText('1 Portionen')).toBeOnTheScreen();

    await user.press(screen.getByRole('button', { name: 'Mehr Portionen' }));
    expect(screen.getByText('2 Portionen')).toBeOnTheScreen();
    expect(screen.getByText('200 kcal')).toBeOnTheScreen();
    expect(screen.getByText('200 g')).toBeOnTheScreen();
    await user.press(screen.getByRole('button', { name: 'Weniger Portionen' }));
    await user.press(screen.getByRole('button', { name: 'Weniger Portionen' }));
    expect(screen.getByText('1 Portionen')).toBeOnTheScreen();

    await user.press(
      screen.getByRole('button', { name: 'Fehlende Zutaten zur Einkaufsliste hinzufügen' }),
    );
    expect(screen.getByText('Geröstetes Ofengemüse: 1 Portionen')).toBeOnTheScreen();
    await user.press(screen.getByText('Einkaufsliste schließen'));

    await user.press(screen.getByRole('tab', { name: 'Bewertungen' }));
    await user.press(screen.getByRole('button', { name: 'Bewertung bearbeiten' }));
    expect(screen.getByText('Bewertung schließen')).toBeOnTheScreen();
    await user.press(screen.getByText('Bewertung schließen'));

    await user.press(screen.getByRole('button', { name: 'Aus Favoriten entfernen' }));
    expect(mockToggleFavorite).toHaveBeenCalledWith('recipe:recipe-1');
    await user.press(screen.getByRole('button', { name: 'Kochmodus starten' }));
    expect(router.push).toHaveBeenCalledWith({
      pathname: '/recipe/cook',
      params: { id: 'recipe-1' },
    });
  });

  it('zeigt leere Zutaten, Schritte und Bewertungen ohne Werte an', async () => {
    const user = userEvent.setup();
    mockCurrentDetail = {
      ...mockDetail,
      recipe: {
        ...mockDetail.recipe,
        instructions: null,
        cook_time_minutes: null,
        difficulty: null,
        dish_types: [],
        dietary_tags: [],
        hashtags: [],
      },
      components: [{ id: 'empty', recipe_id: 'recipe-1', name: 'Leer', serving_grams: null }],
      items: [],
      steps: [],
      productsById: new Map(),
    };
    mockRating = null;
    await renderScreen();

    expect(screen.getAllByText('–')).toHaveLength(3);
    expect(screen.getByText('Noch keine Zutaten hinterlegt.')).toBeOnTheScreen();
    expect(screen.getByText('Noch keine Zubereitungsschritte hinterlegt.')).toBeOnTheScreen();
    await user.press(screen.getByRole('tab', { name: 'Bewertungen' }));
    expect(screen.getByText('Noch keine Bewertung')).toBeOnTheScreen();
    await user.press(screen.getByRole('button', { name: 'Rezept bewerten' }));
    expect(screen.getByText('Bewertung schließen')).toBeOnTheScreen();
  });

  it('öffnet Verwaltungsaktionen zum Bearbeiten und Teilen', async () => {
    const user = userEvent.setup();
    const share = jest.spyOn(Share, 'share').mockResolvedValue({ action: 'sharedAction' });
    await renderScreen();

    await user.press(screen.getByRole('button', { name: 'Rezept verwalten' }));
    await user.press(screen.getByText('Bearbeiten'));
    expect(router.push).toHaveBeenCalledWith({
      pathname: '/recipe/create',
      params: { id: 'recipe-1' },
    });

    await user.press(screen.getByRole('button', { name: 'Rezept verwalten' }));
    await user.press(screen.getByRole('button', { name: 'Schließen' }));
    expect(screen.queryByText('Bearbeiten')).not.toBeOnTheScreen();

    await user.press(screen.getByRole('button', { name: 'Rezept verwalten' }));
    await user.press(screen.getByText('Mit Community teilen'));
    await waitFor(() =>
      expect(share).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Geröstetes Ofengemüse',
          message: expect.stringContaining('Kartoffeln: 100 g'),
        }),
      ),
    );
    share.mockRestore();
  });

  it('fragt vor dem Löschen nach und führt danach zurück', async () => {
    const user = userEvent.setup();
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    await renderScreen();

    await user.press(screen.getByRole('button', { name: 'Rezept verwalten' }));
    await user.press(screen.getByText('Original-Aktualisierung prüfen'));
    expect(alert).toHaveBeenCalledWith(
      'Aktualisierung',
      'Dieses eigene Rezept besitzt keine verknüpfte Vorlage.',
    );

    await user.press(screen.getByRole('button', { name: 'Rezept verwalten' }));
    await user.press(screen.getByText('Löschen'));
    await waitFor(() =>
      expect(alert).toHaveBeenCalledWith(
        'Rezept löschen',
        '„Geröstetes Ofengemüse“ wird dauerhaft entfernt.',
        expect.any(Array),
      ),
    );
    const buttons = alert.mock.calls.at(-1)?.[2] ?? [];
    buttons.find((button) => button.text === 'Löschen')?.onPress?.();
    expect(mockDeleteRecipe).toHaveBeenCalledWith(
      { id: 'recipe-1', household_id: 'household-1' },
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    );
    const options = mockDeleteRecipe.mock.calls[0]?.[1];
    options?.onSuccess?.();
    expect(router.back).toHaveBeenCalledTimes(1);
    alert.mockRestore();
  });
});
