import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { RecipeCreateScreen } from '@/features/recipes/recipe-create-screen';

const mockCreateRecipeMutateAsync = jest.fn().mockResolvedValue('rec-1');
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

jest.mock('@/features/recipes/use-recipes', () => ({
  useRecipeDetail: () => ({ data: mockRecipeData, isLoading: false }),
  useAddRecipeMutation: () => ({ mutateAsync: mockCreateRecipeMutateAsync }),
  useUpdateRecipeMutation: () => ({ mutateAsync: jest.fn() }),
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
    await renderScreen();

    const titleInput = screen.getByPlaceholderText('Rezepttitel');
    await fireEvent.changeText(titleInput, 'Pasta Pesto');

    const nextBtn = screen.getByText('Weiter zu den Zutaten');
    await fireEvent.press(nextBtn);

    expect(screen.getByText('Gruppen und Zutaten')).toBeTruthy();
  });
});
