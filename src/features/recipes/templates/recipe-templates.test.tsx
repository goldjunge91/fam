import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { RecipeTemplateDetailScreen } from '@/features/recipes/templates/recipe-template-detail-screen';

const mockCreateRecipeMutateAsync = jest.fn().mockResolvedValue({ id: 'new-rec-1' });
const mockReplace = jest.fn();

const mockTemplate = {
  id: 'tpl-curry',
  title: 'Gemüse-Curry',
  instructions: 'Alles anbraten und köcheln lassen.',
  cover_image_path: null,
  cook_time_minutes: 25,
  difficulty: 'easy' as const,
  dish_types: ['dinner' as const],
  dietary_tags: ['vegan' as const],
  hashtags: ['curry', 'vegan'],
  default_servings: 4,
  components: [
    {
      id: 'comp-1',
      title: 'Curry',
      name: 'Curry',
      serving_grams: 300,
      items: [
        {
          id: 'item-1',
          name: 'Kokosmilch',
          product_id: 'prod-kokos',
          quantity: 400,
          unit: 'ml',
          grams: 400,
        },
      ],
    },
  ],
  steps: [
    {
      step_order: 1,
      instruction: 'Gemüse schneiden und anbraten',
      image_path: null,
      ingredients: [],
    },
  ],
};

jest.mock('expo-router', () => ({
  router: {
    push: jest.fn(),
    replace: (...args: unknown[]) => mockReplace(...args),
    back: jest.fn(),
    canGoBack: () => false,
  },
  useLocalSearchParams: () => ({ id: 'tpl-curry' }),
}));

jest.mock('@/features/auth/session-provider', () => ({
  useSession: () => ({ session: { user: { id: 'user-1' } } }),
}));

jest.mock('@/features/household/active-household-provider', () => ({
  useActiveHousehold: () => ({ activeHouseholdId: 'hh-1' }),
}));

jest.mock('@/features/recipes/templates/use-recipe-templates', () => ({
  useRecipeTemplateDetail: () => ({ data: mockTemplate, isLoading: false }),
  useApplyRecipeTemplateMutation: () => ({
    mutateAsync: mockCreateRecipeMutateAsync,
    isPending: false,
  }),
}));

describe('RecipeTemplateDetailScreen', () => {
  async function renderScreen() {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    return render(
      <SafeAreaProvider
        initialMetrics={{
          frame: { x: 0, y: 0, width: 390, height: 844 },
          insets: { top: 47, left: 0, right: 0, bottom: 34 },
        }}>
        <QueryClientProvider client={queryClient}>
          <RecipeTemplateDetailScreen />
        </QueryClientProvider>
      </SafeAreaProvider>,
    );
  }

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rendert Vorlagen-Titel, Nährwerte und Zutatenliste', async () => {
    await renderScreen();

    expect(screen.getByText('Gemüse-Curry')).toBeTruthy();
  });

  it('übernimmt die Vorlage in den Haushalt beim Klick', async () => {
    await renderScreen();

    const applyBtn = screen.getByRole('button', { name: 'In meine Rezepte übernehmen' });
    fireEvent.press(applyBtn);

    expect(mockCreateRecipeMutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        template: mockTemplate,
      }),
    );
  });
});
