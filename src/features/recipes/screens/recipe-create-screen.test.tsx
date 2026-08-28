import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, userEvent, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { RecipeCreateScreen } from '@/features/recipes/screens/recipe-create-screen';

const mockCreateRecipeMutateAsync = jest.fn().mockResolvedValue({ id: 'rec-1' });
const mockUpdateRecipeMutateAsync = jest.fn().mockResolvedValue(undefined);
const mockSaveComponentsMutateAsync = jest.fn().mockResolvedValue(undefined);
const mockSaveStepsMutateAsync = jest.fn().mockResolvedValue(undefined);
const mockReplace = jest.fn();

let mockRecipeData: unknown = null;

jest.mock('expo-router', () => ({
  router: {
    push: jest.fn(),
    replace: (...args: unknown[]) => mockReplace(...args),
    back: jest.fn(),
    canGoBack: () => false,
  },
  useLocalSearchParams: () => ({}),
}));

jest.mock('@/features/auth/session-provider', () => ({
  useSession: () => ({ session: { user: { id: 'user-1' } } }),
}));

jest.mock('@/features/household/active-household-provider', () => ({
  useActiveHousehold: () => ({ activeHouseholdId: 'hh-1' }),
  useOptionalActiveHousehold: () => ({ activeHouseholdId: 'hh-1' }),
}));

jest.mock('@/features/recipes/data/use-recipes', () => ({
  useRecipeDetail: () => ({ data: mockRecipeData, isLoading: false }),
  useAddRecipeMutation: () => ({ mutateAsync: mockCreateRecipeMutateAsync }),
  useUpdateRecipeMutation: () => ({ mutateAsync: mockUpdateRecipeMutateAsync }),
  useAddComponentMutation: () => ({ mutateAsync: jest.fn() }),
  useUpdateComponentMutation: () => ({ mutateAsync: jest.fn() }),
  useDeleteComponentMutation: () => ({ mutateAsync: jest.fn() }),
  useAddItemMutation: () => ({ mutateAsync: jest.fn() }),
  useUpdateItemMutation: () => ({ mutateAsync: jest.fn() }),
  useDeleteItemMutation: () => ({ mutateAsync: jest.fn() }),
  useAddStepMutation: () => ({ mutateAsync: jest.fn() }),
  useUpdateStepMutation: () => ({ mutateAsync: jest.fn() }),
  useDeleteStepMutation: () => ({ mutateAsync: jest.fn() }),
  useAddStepIngredientMutation: () => ({ mutateAsync: jest.fn() }),
  useRemoveStepIngredientMutation: () => ({ mutateAsync: jest.fn() }),
  useSaveRecipeComponentsMutation: () => ({ mutateAsync: mockSaveComponentsMutateAsync }),
  useSaveRecipeStepsMutation: () => ({ mutateAsync: mockSaveStepsMutateAsync }),
}));

jest.mock('@/features/inventory/use-product-mutations', () => ({
  useAddProductMutation: () => ({ mutateAsync: jest.fn() }),
}));

jest.mock('@/features/inventory/product-search-dropdown', () => ({
  ProductSearchDropdown: () => null,
}));

jest.mock('@/lib/db/client', () => ({
  getDatabase: jest.fn().mockResolvedValue({
    getFirstAsync: jest.fn().mockResolvedValue(null),
    getAllAsync: jest.fn().mockResolvedValue([]),
  }),
}));

jest.mock('@/lib/analytics', () => ({
  trackAnalyticsEvent: jest.fn(),
}));

describe('RecipeCreateScreen', () => {
  async function renderScreen() {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: Number.POSITIVE_INFINITY },
        mutations: { retry: false, gcTime: Number.POSITIVE_INFINITY },
      },
    });
    return render(
      <SafeAreaProvider
        initialMetrics={{
          frame: { x: 0, y: 0, width: 390, height: 844 },
          insets: { top: 47, left: 0, right: 0, bottom: 34 },
        }}>
        <QueryClientProvider client={queryClient}>
          <RecipeCreateScreen />
        </QueryClientProvider>
      </SafeAreaProvider>,
    );
  }

  beforeEach(() => {
    jest.clearAllMocks();
    mockRecipeData = null;
  });

  it('rendert Schritt 1 des Rezept-Wizards mit Basisfeldern', async () => {
    await renderScreen();

    expect(screen.getByText('Rezept erstellen')).toBeTruthy();
    expect(screen.getByPlaceholderText('Rezepttitel')).toBeTruthy();
    expect(screen.getByText('Weiter zu den Zutaten')).toBeTruthy();
  });

  it('navigiert zu Schritt 2 wenn Titel eingegeben ist', async () => {
    const user = userEvent.setup();
    await renderScreen();

    const titleInput = screen.getByLabelText('Titel');
    await user.paste(titleInput, 'Pasta Pesto');

    const nextBtn = screen.getByRole('button', { name: 'Weiter zu den Zutaten' });
    await user.press(nextBtn);

    expect(screen.getByText('Gruppen und Zutaten')).toBeTruthy();
  });

  it('zeigt einen feldbezogenen Zod-Fehler für eine ungültige Kochzeit', async () => {
    const user = userEvent.setup();
    await renderScreen();

    await user.paste(screen.getByLabelText('Titel'), 'Suppe');
    await user.paste(screen.getByLabelText('Kochzeit in Minuten'), '12.5');
    await user.press(screen.getByRole('button', { name: 'Weiter zu den Zutaten' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Die Kochzeit muss eine ganze Zahl sein.',
    );
    expect(screen.getByText('Rezeptdetails')).toBeOnTheScreen();
  });

  it('übergibt beim Speichern ausschließlich die von Zod validierte Payload', async () => {
    const user = userEvent.setup();
    await renderScreen();

    await user.paste(screen.getByLabelText('Titel'), '  Pasta Pesto  ');
    await user.paste(screen.getByLabelText('Kochzeit in Minuten'), '30');
    await user.paste(screen.getByLabelText('Hashtags'), '#Schnell');
    await user.press(screen.getByRole('button', { name: 'Weiter zu den Zutaten' }));
    await user.press(screen.getByRole('button', { name: 'Weiter zu den Schritten' }));
    await user.press(screen.getByRole('button', { name: 'Weiter' }));
    await user.press(screen.getByRole('button', { name: 'Speichern' }));

    await waitFor(() => expect(mockCreateRecipeMutateAsync).toHaveBeenCalledTimes(1));
    expect(mockCreateRecipeMutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        household_id: 'hh-1',
        title: 'Pasta Pesto',
        created_by: 'user-1',
        cook_time_minutes: 30,
        hashtags: ['schnell'],
      }),
    );
  });

  it('verändert ein bestehendes Rezept nicht wenn eine Zutat ungültig ist', async () => {
    const user = userEvent.setup();
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    mockRecipeData = {
      recipe: {
        id: 'recipe-existing',
        household_id: 'hh-1',
        title: 'Pasta',
        instructions: null,
        cover_image_path: null,
        cook_time_minutes: null,
        difficulty: null,
        dish_types: [],
        dietary_tags: [],
        hashtags: [],
        default_servings: 4,
      },
      components: [{ id: 'component-1', name: 'Zutaten', serving_grams: 100 }],
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
      productsById: new Map([['product-1', { id: 'product-1', name: 'Mehl' }]]),
      steps: [],
    };
    await renderScreen();

    await user.press(screen.getByRole('button', { name: 'Weiter zu den Zutaten' }));
    await user.clear(screen.getByPlaceholderText('Menge'));
    await user.press(screen.getByRole('button', { name: 'Weiter zu den Schritten' }));
    await user.press(screen.getByRole('button', { name: 'Weiter' }));
    await user.press(screen.getByRole('button', { name: 'Speichern' }));

    await waitFor(() => expect(alert).toHaveBeenCalledWith('Zutaten prüfen', expect.any(String)));
    expect(mockUpdateRecipeMutateAsync).not.toHaveBeenCalled();
    expect(screen.getByText('Gruppen und Zutaten')).toBeOnTheScreen();
    alert.mockRestore();
  });
});
