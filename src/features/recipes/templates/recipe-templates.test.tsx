import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { RecipeTemplateDetailScreen } from '@/features/recipes/templates/recipe-template-detail-screen';
import type { RecipeTemplateDetail } from '@/features/recipes/templates/use-recipe-templates';

const mockCreateRecipeMutateAsync = jest.fn().mockResolvedValue({ id: 'new-rec-1' });
const mockReplace = jest.fn();

const mockTemplate: RecipeTemplateDetail = {
  id: 'tpl-curry',
  title: 'Gemüse-Curry',
  instructions: 'Alles anbraten und köcheln lassen.',
  cover_image_path: null,
  cook_time_minutes: 25,
  difficulty: 'easy' as const,
  dish_types: ['dinner' as const],
  dietary_tags: ['vegan' as const],
  default_servings: 4,
  sort_order: 0,
  components: [
    {
      id: 'comp-1',
      name: 'Curry',
      serving_grams: 300,
      items: [
        {
          id: 'item-1',
          component_id: 'comp-1',
          product_id: 'prod-kokos',
          sub_component_id: null,
          quantity: 400,
          unit: 'ml',
          grams: 400,
          product_name: 'Kokosmilch',
        },
      ],
    },
  ],
  steps: [
    {
      id: 'step-1',
      position: 0,
      text: 'Gemüse schneiden und anbraten',
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
      // Test-Caches brauchen keinen spaeteren GC-Timer, der den Jest-Worker offen haelt.
      defaultOptions: { queries: { retry: false, gcTime: Number.POSITIVE_INFINITY } },
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
    await fireEvent.press(applyBtn);

    expect(mockCreateRecipeMutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        template: mockTemplate,
      }),
    );
  });
});
