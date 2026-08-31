import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen, userEvent, waitFor } from '@testing-library/react-native';
import type { RecipeShoppingNeed } from '@/features/recipes/data/use-recipe-shopping-needs';
import type { RecipeDetail } from '@/features/recipes/hooks/use-recipes';
import { RecipeRatingSheet } from './recipe-rating-sheet';
import { RecipeShoppingSheet } from './recipe-shopping-sheet';

let mockNeeds: RecipeShoppingNeed[] = [];
const mockGetRecipeRating = jest.fn();
const mockAddMutateAsync = jest.fn().mockResolvedValue(undefined);
const mockResolveCategoryForItem = jest.fn().mockResolvedValue({
  categoryId: null,
  source: null,
  classifierVersion: '1',
});

jest.mock('@/features/auth/session-provider', () => ({
  useSession: () => ({ session: { user: { id: 'user-a' } } }),
}));

jest.mock('@/features/premium/premium-provider', () => ({
  usePremium: () => ({ isPremium: true, refresh: jest.fn() }),
}));

jest.mock('@/features/recipes/domain/recipe-ratings', () => ({
  getRecipeRating: (...args: unknown[]) => mockGetRecipeRating(...args),
  saveRecipeRating: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/features/recipes/data/use-recipe-shopping-needs', () => ({
  useRecipeShoppingNeeds: () => ({ data: mockNeeds, isLoading: false }),
}));

jest.mock('@/features/shopping-list/hooks/use-shopping-list-mutations', () => ({
  useAddShoppingItem: () => ({ mutateAsync: mockAddMutateAsync, isPending: false }),
}));

jest.mock('@/features/shopping-list/preferences/api', () => ({
  resolveCategoryForItem: (...args: unknown[]) => mockResolveCategoryForItem(...args),
}));

// RowStorePicker haengt an useStores() (React Query) — hier durch einen
// minimalen Stub ersetzt, der storeId als Text zeigt und bei Druck fest
// 'store-override' waehlt. Das eigene Verhalten von RowStorePicker ist
// bereits in row-store-picker.test.tsx abgedeckt (siehe #335).
jest.mock('@/features/shopping-list/components/ui/row-store-picker', () => {
  const { Pressable, Text } = require('react-native');
  return {
    RowStorePicker: ({
      storeId,
      onChange,
      testID,
    }: {
      storeId: string | null;
      onChange: (next: string | null) => void;
      testID?: string;
    }) => (
      <Pressable
        testID={testID}
        accessibilityRole="button"
        onPress={() => onChange('store-override')}>
        <Text>{storeId ?? 'Ohne Markt'}</Text>
      </Pressable>
    ),
  };
});

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

  function renderSheet(onClose = jest.fn()) {
    return render(
      <QueryClientProvider client={queryClient}>
        <RecipeShoppingSheet
          visible={true}
          detail={mockRecipeDetail}
          servings={2}
          onClose={onClose}
        />
      </QueryClientProvider>,
    );
  }

  beforeEach(() => {
    mockAddMutateAsync.mockClear();
    mockResolveCategoryForItem.mockClear();
    mockNeeds = [];
  });

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

  it('zeigt bereits gedeckte Zutaten mit "benötigt / Vorrat" statt der fehlenden Menge', async () => {
    // Nachschub-Fall (#131-Nachschaerfung): Salz ist voll gedeckt
    // (neededGrams === availableGrams), bleibt aber sichtbar.
    mockNeeds = [
      {
        productId: 'p-salz',
        name: 'Salz',
        neededGrams: 50,
        availableGrams: 50,
        missingGrams: 0,
        preferredStoreId: null,
      },
    ];
    await renderSheet();

    expect(screen.getByText('Salz')).toBeTruthy();
    expect(screen.getByText('50g / 50g')).toBeTruthy();
  });

  it('waehlt nur Zutaten mit echtem Fehlbetrag vor, gedeckte Zutaten bleiben abgewaehlt', async () => {
    mockNeeds = [
      {
        productId: 'p-tomaten',
        name: 'Tomaten',
        neededGrams: 400,
        availableGrams: 100,
        missingGrams: 300,
        preferredStoreId: null,
      },
      {
        productId: 'p-salz',
        name: 'Salz',
        neededGrams: 50,
        availableGrams: 50,
        missingGrams: 0,
        preferredStoreId: null,
      },
    ];
    await renderSheet();

    expect(screen.getByText('1 Zutat übernehmen')).toBeTruthy();
    expect(screen.getByRole('checkbox', { name: 'Salz' })).not.toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Tomaten' })).toBeChecked();
  });

  it('Auswahl einer gedeckten Zutat uebertraegt die volle benoetigte Menge', async () => {
    const user = userEvent.setup();
    mockNeeds = [
      {
        productId: 'p-salz',
        name: 'Salz',
        neededGrams: 50,
        availableGrams: 50,
        missingGrams: 0,
        preferredStoreId: null,
      },
    ];
    await renderSheet();

    await user.press(screen.getByRole('checkbox', { name: 'Salz' }));
    await user.press(screen.getByText('1 Zutat übernehmen'));

    expect(mockAddMutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Salz', quantity: 50, unit: 'g' }),
    );
  });

  it('Markt-Override einer Zeile wird beim Uebertrag statt der Kaufhistorie verwendet', async () => {
    const user = userEvent.setup();
    mockNeeds = [
      {
        productId: 'p-tomaten',
        name: 'Tomaten',
        neededGrams: 400,
        availableGrams: 100,
        missingGrams: 300,
        preferredStoreId: null,
      },
    ];
    await renderSheet();

    await user.press(screen.getByTestId('recipe-row-store-picker-p-tomaten'));
    await user.press(screen.getByText('1 Zutat übernehmen'));

    expect(mockAddMutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Tomaten', store_id: 'store-override' }),
    );
  });

  it('Bulk-Markt-Auswahl weist allen Zutaten denselben Markt zu', async () => {
    const user = userEvent.setup();
    mockNeeds = [
      {
        productId: 'p-tomaten',
        name: 'Tomaten',
        neededGrams: 400,
        availableGrams: 100,
        missingGrams: 300,
        preferredStoreId: null,
      },
      {
        productId: 'p-basilikum',
        name: 'Basilikum',
        neededGrams: 20,
        availableGrams: 0,
        missingGrams: 20,
        preferredStoreId: null,
      },
    ];
    await renderSheet();

    await user.press(screen.getByTestId('recipe-bulk-store-picker'));
    await user.press(screen.getByText('2 Zutaten übernehmen'));

    expect(mockAddMutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Tomaten', store_id: 'store-override' }),
    );
    expect(mockAddMutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Basilikum', store_id: 'store-override' }),
    );
  });

  it('schliesst das Sheet nach erfolgreichem Uebertrag weiterhin ueber onClose', async () => {
    const user = userEvent.setup();
    const onClose = jest.fn();
    mockNeeds = [
      {
        productId: 'p-tomaten',
        name: 'Tomaten',
        neededGrams: 400,
        availableGrams: 100,
        missingGrams: 300,
        preferredStoreId: null,
      },
    ];
    await renderSheet(onClose);

    await user.press(screen.getByText('1 Zutat übernehmen'));

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
