import { render, screen, userEvent } from '@testing-library/react-native';
import { router } from 'expo-router';

import { RecipeLogScreen } from './recipe-log-screen';
import type { RecipeDetail } from './use-recipes';

let mockDetail: RecipeDetail | null = null;

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), canGoBack: () => false },
  useLocalSearchParams: () => ({ id: 'recipe-1' }),
}));

jest.mock('./use-recipes', () => ({
  useRecipeDetail: () => ({ data: mockDetail, isLoading: false }),
}));

function makeDetail(): RecipeDetail {
  return {
    recipe: {
      id: 'recipe-1',
      household_id: 'hh-1',
      title: 'Bolognese',
      instructions: null,
      cover_image_path: null,
      cook_time_minutes: null,
      difficulty: null,
      dish_types: [],
      dietary_tags: [],
      hashtags: [],
      default_servings: 1,
      created_by: null,
      created_at: null,
    },
    components: [
      { id: 'nudeln', recipe_id: 'recipe-1', name: 'Nudeln', serving_grams: 300 },
      { id: 'sauce', recipe_id: 'recipe-1', name: 'Soße', serving_grams: 200 },
    ],
    items: [
      {
        id: 'i1',
        component_id: 'nudeln',
        product_id: 'p-nudeln',
        sub_component_id: null,
        grams: 300,
        quantity: null,
        unit: 'g',
      },
      {
        id: 'i2',
        component_id: 'sauce',
        product_id: 'p-tomaten',
        sub_component_id: null,
        grams: 50,
        quantity: null,
        unit: 'g',
      },
      {
        id: 'i3',
        component_id: 'sauce',
        product_id: 'p-hack',
        sub_component_id: null,
        grams: 300,
        quantity: null,
        unit: 'g',
      },
    ],
    steps: [],
    productsById: new Map([
      [
        'p-nudeln',
        {
          id: 'p-nudeln',
          name: 'Nudeln',
          kcal_per_100: 200,
          protein_g_per_100: 7,
          carbs_g_per_100: 40,
          fat_g_per_100: 1.5,
        },
      ],
      [
        'p-tomaten',
        {
          id: 'p-tomaten',
          name: 'Tomaten',
          kcal_per_100: 30,
          protein_g_per_100: 1,
          carbs_g_per_100: 4,
          fat_g_per_100: 0,
        },
      ],
      [
        'p-hack',
        {
          id: 'p-hack',
          name: 'Hackfleisch',
          kcal_per_100: 100,
          protein_g_per_100: 18,
          carbs_g_per_100: 0,
          fat_g_per_100: 3,
        },
      ],
    ]),
  };
}

beforeEach(() => {
  mockDetail = makeDetail();
  (router.push as jest.Mock).mockClear();
});

describe('RecipeLogScreen', () => {
  it('startet mit den Rezept-Portionsgrammmengen als Ausgangswert', async () => {
    await render(<RecipeLogScreen />);

    expect(screen.getByDisplayValue('300')).toBeOnTheScreen();
    expect(screen.getByDisplayValue('200')).toBeOnTheScreen();
    expect(screen.getByText('780 kcal')).toBeOnTheScreen();
  });

  it('passt die Naehrwerte an, wenn eine Komponenten-Menge geaendert wird, ohne das Rezept zu veraendern', async () => {
    const user = userEvent.setup();
    await render(<RecipeLogScreen />);

    const sauceInput = screen.getByLabelText('Grammmenge für Soße');
    await user.clear(sauceInput);
    await user.type(sauceInput, '400');

    expect(await screen.findByText('960 kcal')).toBeOnTheScreen();
    expect(mockDetail?.components.find((c) => c.id === 'sauce')?.serving_grams).toBe(200);
  });

  it('uebernimmt den berechneten Snapshot mit gewaehlter Mahlzeit in den Tagebuch-Eintrag', async () => {
    const user = userEvent.setup();
    await render(<RecipeLogScreen />);

    await user.press(screen.getByText('Abendessen'));
    await user.press(screen.getByRole('button', { name: 'Ins Tagebuch übernehmen' }));

    expect(router.push).toHaveBeenCalledWith({
      pathname: '/add-food-entry',
      params: expect.objectContaining({
        mealType: 'dinner',
        name: 'Bolognese',
        quantity: '1',
        unit: 'portion',
        kcal: '780',
      }),
    });
  });
});
