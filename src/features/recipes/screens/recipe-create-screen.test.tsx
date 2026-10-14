import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, userEvent, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { RecipeCreateScreen } from '@/features/recipes/screens/recipe-create-screen';

const mockCreateRecipeMutateAsync = jest.fn().mockResolvedValue({ id: 'rec-1' });
const mockUpdateRecipeMutateAsync = jest.fn().mockResolvedValue(undefined);
const mockAddComponentMutateAsync = jest.fn().mockResolvedValue({ id: 'component-1' });
const mockUpdateComponentMutateAsync = jest.fn().mockResolvedValue(undefined);
const mockAddItemMutateAsync = jest.fn().mockResolvedValue({ id: 'item-1' });
const mockUpdateItemMutateAsync = jest.fn().mockResolvedValue(undefined);
const mockAddStepMutateAsync = jest.fn().mockResolvedValue({ id: 'step-1' });
const mockDeleteStepMutateAsync = jest.fn().mockResolvedValue(undefined);
const mockSaveComponentsMutateAsync = jest.fn().mockResolvedValue(undefined);
const mockSaveStepsMutateAsync = jest.fn().mockResolvedValue(undefined);
const mockReplace = jest.fn();
const mockBack = jest.fn();

let mockRecipeData: unknown = null;

jest.mock('expo-router', () => ({
  router: {
    push: jest.fn(),
    replace: (...args: unknown[]) => mockReplace(...args),
    back: (...args: unknown[]) => mockBack(...args),
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

jest.mock('@/features/recipes/hooks/use-recipes', () => ({
  useRecipeDetail: () => ({ data: mockRecipeData, isLoading: false }),
  useAddRecipeMutation: () => ({ mutateAsync: mockCreateRecipeMutateAsync }),
  useUpdateRecipeMutation: () => ({ mutateAsync: mockUpdateRecipeMutateAsync }),
}));

jest.mock('@/features/recipes/hooks/use-recipe-components', () => ({
  useAddComponentMutation: () => ({ mutateAsync: mockAddComponentMutateAsync }),
  useUpdateComponentMutation: () => ({ mutateAsync: mockUpdateComponentMutateAsync }),
  useDeleteComponentMutation: () => ({ mutateAsync: jest.fn() }),
  useAddItemMutation: () => ({ mutateAsync: mockAddItemMutateAsync }),
  useUpdateItemMutation: () => ({ mutateAsync: mockUpdateItemMutateAsync }),
  useDeleteItemMutation: () => ({ mutateAsync: jest.fn() }),
  useSaveRecipeComponentsMutation: () => ({ mutateAsync: mockSaveComponentsMutateAsync }),
}));

jest.mock('@/features/recipes/hooks/use-recipe-steps', () => ({
  useAddStepImageMutation: () => ({ mutateAsync: jest.fn() }),
  useAddStepMutation: () => ({ mutateAsync: mockAddStepMutateAsync }),
  useDeleteStepImageMutation: () => ({ mutateAsync: jest.fn() }),
  useUpdateStepMutation: () => ({ mutateAsync: jest.fn() }),
  useUpdateStepImageMutation: () => ({ mutateAsync: jest.fn() }),
  useDeleteStepMutation: () => ({ mutateAsync: mockDeleteStepMutateAsync }),
  useAddStepIngredientMutation: () => ({ mutateAsync: jest.fn() }),
  useRemoveStepIngredientMutation: () => ({ mutateAsync: jest.fn() }),
  useSaveRecipeStepsMutation: () => ({ mutateAsync: mockSaveStepsMutateAsync }),
}));

jest.mock('@/features/inventory/use-product-mutations', () => ({
  useAddProductMutation: () => ({ mutateAsync: jest.fn() }),
}));

jest.mock('@/features/inventory/product-search-dropdown', () => ({
  ProductSearchDropdown: ({
    label,
    value,
    onChangeText,
    onSelectProduct,
  }: {
    label: string;
    value: string;
    onChangeText: (query: string) => void;
    onSelectProduct: (product: {
      productId: string;
      barcode: string;
      name: string;
      categoryTags: string[];
    }) => void;
  }) => {
    const React = require('react') as typeof import('react');
    const { Pressable, Text, TextInput } = require('react-native') as typeof import('react-native');
    return React.createElement(
      React.Fragment,
      null,
      React.createElement(TextInput, { accessibilityLabel: label, value, onChangeText }),
      React.createElement(
        Pressable,
        {
          accessibilityRole: 'button',
          accessibilityLabel: 'Testprodukt auswählen',
          onPress: () =>
            onSelectProduct({
              productId: 'product-1',
              barcode: '400123',
              name: 'Tomate',
              categoryTags: [],
            }),
        },
        React.createElement(Text, null, 'Tomate auswählen'),
      ),
    );
  },
}));

jest.mock('@/components/forms/wheel-picker-field', () => {
  const React = require('react') as typeof import('react');
  const { Pressable, Text } = require('react-native') as typeof import('react-native');
  return {
    WheelPickerField: ({ onChange }: { onChange: (value: string) => void }) =>
      React.createElement(
        Pressable,
        {
          accessibilityRole: 'button',
          accessibilityLabel: 'Einheit ändern',
          onPress: () => onChange('kg'),
        },
        React.createElement(Text, null, 'g'),
      ),
  };
});

jest.mock('@/features/inventory/persist-off-product', () => ({
  persistOffProductIfNeeded: jest.fn().mockResolvedValue('product-1'),
}));

jest.mock('@/lib/db/local-client', () => ({
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

  it('legt ein Rezept mit ausgewählter Zutat und ausgefülltem Schritt an', async () => {
    const user = userEvent.setup();
    await renderScreen();

    await user.paste(screen.getByLabelText('Titel'), 'Tomatensuppe');
    await user.press(screen.getByRole('button', { name: 'Weiter zu den Zutaten' }));
    await user.press(screen.getByRole('button', { name: 'Add Componente' }));
    const groupName = screen.getAllByLabelText('Gruppenname')[1];
    await user.clear(groupName);
    await user.type(groupName, 'Garnitur');
    await user.press(screen.getAllByText('+ Zutat hinzufügen')[1]);
    await user.press(screen.getAllByRole('button', { name: 'Delete ingredient' })[2]);
    await user.press(screen.getAllByRole('button', { name: 'Zutaten-Gruppe entfernen' })[1]);
    await user.paste(screen.getByLabelText('Zutat'), 'Tomaten');
    await user.press(screen.getByRole('button', { name: 'Testprodukt auswählen' }));
    await user.paste(screen.getByLabelText('Menge'), '100');
    await user.press(screen.getByRole('button', { name: 'Einheit ändern' }));
    await user.press(screen.getByRole('button', { name: 'Weiter zu den Schritten' }));
    await user.paste(screen.getByPlaceholderText(/Was ist in Schritt 1 zu tun/), 'Tomate waschen');
    await user.press(screen.getByRole('button', { name: 'Weiter' }));
    await user.press(screen.getByRole('button', { name: 'Speichern' }));

    await waitFor(() => expect(mockCreateRecipeMutateAsync).toHaveBeenCalledTimes(1));
    expect(mockAddComponentMutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        recipe_id: 'rec-1',
        household_id: 'hh-1',
        name: 'Zutaten',
        serving_grams: 100_000,
      }),
    );
    expect(mockAddItemMutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        component_id: 'component-1',
        product_id: 'product-1',
        grams: 100_000,
        quantity: 100,
        unit: 'kg',
      }),
    );
    expect(mockAddStepMutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        recipe_id: 'rec-1',
        household_id: 'hh-1',
        position: 0,
        text: 'Tomate waschen',
      }),
    );
    expect(mockReplace).toHaveBeenCalledWith({
      pathname: '/recipe/[id]',
      params: { id: 'rec-1' },
    });
  });

  it('aktualisiert bestehende Zutaten und löscht entfernte Schritte', async () => {
    const user = userEvent.setup();
    mockRecipeData = {
      recipe: {
        id: 'recipe-existing',
        household_id: 'hh-1',
        title: 'Pasta',
        instructions: null,
        cover_image_path: null,
        cook_time_minutes: 15,
        difficulty: null,
        dish_types: [],
        dietary_tags: [],
        hashtags: [],
        default_servings: 2,
      },
      components: [
        {
          id: 'component-1',
          recipe_id: 'recipe-existing',
          name: 'Zutaten',
          serving_grams: 100,
        },
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
      productsById: new Map([['product-1', { id: 'product-1', name: 'Tomate' }]]),
      steps: [
        {
          id: 'step-1',
          recipe_id: 'recipe-existing',
          position: 0,
          text: 'Tomaten waschen',
          image_path: null,
          timer_minutes: null,
          ingredientIds: [],
          images: [],
        },
        {
          id: 'step-2',
          recipe_id: 'recipe-existing',
          position: 1,
          text: 'Tomaten schneiden',
          image_path: null,
          timer_minutes: null,
          ingredientIds: [],
          images: [],
        },
      ],
    };
    await renderScreen();

    await user.press(screen.getByRole('button', { name: 'Weiter zu den Zutaten' }));
    await user.press(screen.getByRole('button', { name: 'Weiter zu den Schritten' }));
    await user.press(screen.getAllByRole('button', { name: 'Delete step' })[1]);
    await user.press(screen.getByRole('button', { name: 'Weiter' }));
    await user.press(screen.getByRole('button', { name: 'Speichern' }));

    await waitFor(() => expect(mockUpdateRecipeMutateAsync).toHaveBeenCalledTimes(1));
    expect(mockCreateRecipeMutateAsync).not.toHaveBeenCalled();
    expect(mockUpdateComponentMutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'component-1',
        recipe_id: 'recipe-existing',
        serving_grams: 100,
      }),
    );
    expect(mockUpdateItemMutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'item-1',
        recipe_id: 'recipe-existing',
        grams: 100,
        quantity: 100,
        unit: 'g',
      }),
    );
    expect(mockDeleteStepMutateAsync).toHaveBeenCalledWith({
      id: 'step-2',
      recipe_id: 'recipe-existing',
      household_id: 'hh-1',
    });
    expect(mockReplace).toHaveBeenCalledWith({
      pathname: '/recipe/[id]',
      params: { id: 'recipe-existing' },
    });
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

  it('fragt vor dem Verwerfen eines begonnenen Rezepts nach Bestätigung', async () => {
    const user = userEvent.setup();
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    await renderScreen();

    await user.paste(screen.getByLabelText('Titel'), 'Pasta');
    await user.press(screen.getByRole('button', { name: 'Zurück' }));

    expect(alert).toHaveBeenCalledWith(
      'Änderungen verwerfen?',
      'Deine Eingaben gehen verloren.',
      expect.arrayContaining([
        expect.objectContaining({ text: 'Zurück', style: 'cancel' }),
        expect.objectContaining({ text: 'Verwerfen', style: 'destructive' }),
      ]),
    );
    const actions = jest.mocked(alert).mock.calls.at(-1)?.[2];
    actions?.find((action) => action.text === 'Verwerfen')?.onPress?.();
    expect(mockBack).toHaveBeenCalledTimes(1);
    alert.mockRestore();
  });

  it('verlässt den leeren Rezeptentwurf ohne Verwerfungsdialog', async () => {
    const user = userEvent.setup();
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    await renderScreen();

    await user.press(screen.getByRole('button', { name: 'Zurück' }));

    expect(alert).not.toHaveBeenCalled();
    expect(mockBack).toHaveBeenCalledTimes(1);
    alert.mockRestore();
  });
});
