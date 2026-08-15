import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { CookingModeScreen } from './cooking-mode-screen';
import type { RecipeDetail } from './use-recipes';

const mockNavigation = { canGoBack: () => true, addListener: () => () => {} };

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), canGoBack: () => true },
  useLocalSearchParams: () => ({ id: 'recipe-1' }),
  useNavigation: () => mockNavigation,
}));

let mockDetail: RecipeDetail | null = null;
let mockLoading = false;

jest.mock('./use-recipes', () => ({
  useRecipeDetail: () => ({ data: mockDetail, isLoading: mockLoading }),
}));

let mockIsPremium = false;

jest.mock('@/features/premium/premium-provider', () => ({
  usePremium: () => ({ isPremium: mockIsPremium }),
}));

jest.mock('@/features/premium/paywall', () => ({
  presentPaywallIfNeeded: jest.fn(),
}));

function renderScreen() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <SafeAreaProvider
        initialMetrics={{
          frame: { x: 0, y: 0, width: 390, height: 844 },
          insets: { top: 47, left: 0, right: 0, bottom: 34 },
        }}>
        <CookingModeScreen />
      </SafeAreaProvider>
    </QueryClientProvider>,
  );
}

function makeDetail(): RecipeDetail {
  return {
    recipe: {
      id: 'recipe-1',
      household_id: 'hh-1',
      title: 'Spaghetti Bolognese',
      instructions: 'Nudeln kochen, Soße dazu.',
      cover_image_path: null,
      cook_time_minutes: 30,
      difficulty: 'easy',
      dish_types: ['dinner'],
      dietary_tags: [],
      hashtags: [],
      default_servings: 2,
      created_by: 'user-1',
      created_at: '2024-01-01T00:00:00.000Z',
    },
    components: [{ id: 'sauce', recipe_id: 'recipe-1', name: 'Soße', serving_grams: 200 }],
    items: [
      {
        id: 'item-1',
        component_id: 'sauce',
        product_id: 'tomaten',
        sub_component_id: null,
        grams: 50,
        quantity: 50,
        unit: 'g',
      },
      {
        id: 'item-2',
        component_id: 'sauce',
        product_id: 'hack',
        sub_component_id: null,
        grams: 300,
        quantity: 300,
        unit: 'g',
      },
    ],
    steps: [
      {
        id: 'step-1',
        recipe_id: 'recipe-1',
        position: 0,
        text: 'Wasser aufsetzen',
        image_path: null,
        ingredientIds: [],
      },
      {
        id: 'step-2',
        recipe_id: 'recipe-1',
        position: 1,
        text: 'Zwiebeln anbraten',
        image_path: null,
        ingredientIds: [],
      },
    ],
    productsById: new Map([
      [
        'tomaten',
        {
          id: 'tomaten',
          name: 'Tomaten',
          kcal_per_100: 30,
          protein_g_per_100: 1,
          carbs_g_per_100: 4,
          fat_g_per_100: 0,
        },
      ],
      [
        'hack',
        {
          id: 'hack',
          name: 'Hackfleisch',
          kcal_per_100: 100,
          protein_g_per_100: 20,
          carbs_g_per_100: 0,
          fat_g_per_100: 5,
        },
      ],
    ]),
  };
}

beforeEach(() => {
  mockDetail = null;
  mockLoading = false;
  mockIsPremium = false;
});

describe('CookingModeScreen', () => {
  it('zeigt einen Ladezustand, solange das Rezept laedt', async () => {
    mockLoading = true;
    await renderScreen();

    expect(screen.getByText('Kochmodus')).toBeOnTheScreen();
  });

  it('zeigt die Zutatenliste', async () => {
    mockDetail = makeDetail();
    await renderScreen();

    expect(screen.getByText('Tomaten')).toBeOnTheScreen();
    expect(screen.getByText('Hackfleisch')).toBeOnTheScreen();
  });

  it('zeigt Basis-Rezepttext und nummerierte Zubereitungsschritte', async () => {
    mockDetail = makeDetail();
    await renderScreen();

    expect(screen.getByText('Nudeln kochen, Soße dazu.')).toBeOnTheScreen();
    expect(screen.getByText('Wasser aufsetzen')).toBeOnTheScreen();
    expect(screen.getByText('Zwiebeln anbraten')).toBeOnTheScreen();
    expect(screen.getByText('1.')).toBeOnTheScreen();
    expect(screen.getByText('2.')).toBeOnTheScreen();
  });

  it('bietet keinen interaktiven Schritt-fuer-Schritt-Ablauf (kostenlose Stufe, #133)', async () => {
    mockDetail = makeDetail();
    await renderScreen();

    expect(screen.queryByRole('button', { name: /nächster schritt/i })).not.toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: /timer/i })).not.toBeOnTheScreen();
  });
});
