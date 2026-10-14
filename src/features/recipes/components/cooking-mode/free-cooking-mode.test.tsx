import { render, screen, userEvent } from '@testing-library/react-native';
import { router } from 'expo-router';
import type { ReactNode } from 'react';
import type { RecipeDetail } from '../../hooks/use-recipes';
import { FreeCookingMode } from './free-cooking-mode';

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));

jest.mock('@/components/theme/ThemeProvider', () => ({
  useTheme: () => ({ colors: { accent: '#957b91', backgroundElement: '#f0e8ed', border: '#ccc' } }),
}));

jest.mock('@/constants/ui', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { Pressable: NativePressable, Text: NativeText } =
    jest.requireActual<typeof import('react-native')>('react-native');
  return {
    Press: ({
      children,
      onPress,
      accessibilityRole,
    }: {
      children: ReactNode;
      onPress: () => void;
      accessibilityRole?: 'button';
    }) => React.createElement(NativePressable, { accessibilityRole, onPress }, children),
    Txt: ({ children }: { children: ReactNode }) => React.createElement(NativeText, null, children),
  };
});

jest.mock('../step-rich-content', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { Text: NativeText } = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    StepRichContent: ({
      text,
      images,
    }: {
      text: string;
      images: { accessibilityLabel?: string }[];
    }) =>
      React.createElement(
        NativeText,
        null,
        `${text} ${images.map((image) => image.accessibilityLabel ?? 'ohne-Bildtext').join(',')}`,
      ),
  };
});

jest.mock('./cooking-mode-shell', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { Text: NativeText, View: NativeView } =
    jest.requireActual<typeof import('react-native')>('react-native');
  return {
    CookingModeShell: ({ children, title }: { children: ReactNode; title: string }) =>
      React.createElement(NativeView, null, React.createElement(NativeText, null, title), children),
  };
});

function makeData(overrides: Partial<RecipeDetail> = {}): RecipeDetail {
  return {
    recipe: {
      id: 'recipe-1',
      household_id: 'household-1',
      title: 'Gemüsetopf',
      instructions: 'Alles in einen Topf geben.',
      cover_image_path: null,
      cook_time_minutes: 20,
      difficulty: 'easy',
      dish_types: [],
      dietary_tags: [],
      hashtags: [],
      default_servings: 2,
      created_by: null,
      created_at: null,
    },
    components: [
      { id: 'main', recipe_id: 'recipe-1', name: 'Topf', serving_grams: 200 },
      { id: 'side', recipe_id: 'recipe-1', name: 'Beilage', serving_grams: null },
    ],
    items: [
      {
        id: 'product',
        component_id: 'main',
        product_id: 'tomato',
        sub_component_id: null,
        ingredient_name: null,
        grams: 100,
        quantity: 2,
        unit: 'Stück',
      },
      {
        id: 'manual',
        component_id: 'main',
        product_id: null,
        sub_component_id: null,
        ingredient_name: 'Zwiebel',
        grams: 50,
        quantity: null,
        unit: 'g',
      },
      {
        id: 'subcomponent',
        component_id: 'main',
        product_id: null,
        sub_component_id: 'side',
        ingredient_name: null,
        grams: 30,
        quantity: null,
        unit: 'g',
      },
      {
        id: 'fallback',
        component_id: 'main',
        product_id: null,
        sub_component_id: null,
        ingredient_name: null,
        grams: 4,
        quantity: null,
        unit: 'g',
      },
    ],
    steps: [
      {
        id: 'step-1',
        recipe_id: 'recipe-1',
        position: 0,
        text: 'Tomaten schneiden [[Bild 1]].',
        image_path: null,
        images: [
          {
            id: 'image-1',
            step_id: 'step-1',
            recipe_id: 'recipe-1',
            household_id: 'household-1',
            storage_path: 'step-one.jpg',
            position: 0,
          },
          {
            id: 'image-2',
            step_id: 'step-1',
            recipe_id: 'recipe-1',
            household_id: 'household-1',
            storage_path: 'step-two.jpg',
            position: 1,
          },
        ],
        timer_minutes: null,
        ingredientIds: [],
      },
      {
        id: 'step-2',
        recipe_id: 'recipe-1',
        position: 1,
        text: 'Kurz köcheln lassen.',
        image_path: 'legacy.jpg',
        timer_minutes: 5,
        ingredientIds: [],
      },
    ],
    productsById: new Map([
      [
        'tomato',
        {
          id: 'tomato',
          name: 'Tomate',
          kcal_per_100: 20,
          protein_g_per_100: 1,
          carbs_g_per_100: 4,
          fat_g_per_100: 0,
        },
      ],
    ]),
    ...overrides,
  };
}

beforeEach(() => {
  (router.push as jest.Mock).mockClear();
});

it('zeigt gespeicherte Gruppen, Varianten von Zutaten und Schrittbilder', async () => {
  const user = userEvent.setup();
  await render(<FreeCookingMode data={makeData()} />);

  expect(screen.getByText('Gemüsetopf')).toBeOnTheScreen();
  expect(screen.getByText('Alles in einen Topf geben.')).toBeOnTheScreen();
  expect(screen.getByText('Topf')).toBeOnTheScreen();
  expect(screen.getAllByText('Beilage')).toHaveLength(1);
  expect(screen.getByText('200 g zubereitet')).toBeOnTheScreen();
  expect(screen.getByText('Tomate')).toBeOnTheScreen();
  expect(screen.getByText('2 Stück')).toBeOnTheScreen();
  expect(screen.getByText('Zwiebel')).toBeOnTheScreen();
  expect(screen.getByText('50 g')).toBeOnTheScreen();
  expect(screen.getByText('Zutat')).toBeOnTheScreen();
  expect(screen.getByText(/Tomaten schneiden.*Bild für Schritt 1/)).toBeOnTheScreen();
  expect(screen.getByText(/Kurz köcheln lassen.*Bild für Schritt 2/)).toBeOnTheScreen();

  await user.press(screen.getByText('Geführten Kochmodus freischalten'));
  expect(router.push).toHaveBeenCalledWith({
    pathname: '/settings/plus-and-ai',
    params: { tier: 'plus' },
  });
});

it('verwendet alle Gruppen ohne Portionsgewichte und blendet leere Abschnitte aus', async () => {
  const data = makeData({
    recipe: { ...makeData().recipe, instructions: null },
    components: [
      { id: 'main', recipe_id: 'recipe-1', name: 'Hauptteil', serving_grams: null },
      { id: 'side', recipe_id: 'recipe-1', name: 'Nebenbei', serving_grams: null },
    ],
    items: [],
    steps: [],
  });
  await render(<FreeCookingMode data={data} />);

  expect(screen.getByText('Hauptteil')).toBeOnTheScreen();
  expect(screen.getByText('Nebenbei')).toBeOnTheScreen();
  expect(screen.getAllByText('0 g zubereitet')).toHaveLength(2);
  expect(screen.queryByText('Alles in einen Topf geben.')).not.toBeOnTheScreen();
  expect(screen.queryByText('Tomaten schneiden')).not.toBeOnTheScreen();
});

it('blendet die Gruppendarstellung aus, wenn keine Komponenten vorhanden sind', async () => {
  const data = makeData({ components: [], items: [], steps: [] });
  await render(<FreeCookingMode data={data} />);

  expect(screen.getByText('Gemüsetopf')).toBeOnTheScreen();
  expect(screen.queryByText('Topf')).not.toBeOnTheScreen();
  expect(screen.getByText('Geführten Kochmodus freischalten')).toBeOnTheScreen();
});
