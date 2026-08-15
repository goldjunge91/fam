import { render, screen, userEvent } from '@testing-library/react-native';
import { router } from 'expo-router';

import type { RecipeTemplateWithNutrition } from '@/features/recipe-templates/use-recipe-templates';

import { RecipesScreen } from './recipes-screen';
import type { RecipeListItem } from './use-recipes';

let mockRecipes: RecipeListItem[] = [];
let mockTemplates: RecipeTemplateWithNutrition[] = [];
const mockOpenDrawer = jest.fn();

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), canGoBack: () => false },
}));

jest.mock('@/features/household/active-household-provider', () => ({
  useActiveHousehold: () => ({ activeHouseholdId: 'hh-1' }),
}));

jest.mock('./use-recipes', () => ({
  useRecipes: () => ({ data: mockRecipes, isLoading: false }),
}));

jest.mock('@/features/recipe-templates/use-recipe-templates', () => {
  const actual = jest.requireActual('@/features/recipe-templates/use-recipe-templates');
  return {
    ...actual,
    useRecipeTemplatesWithNutrition: () => ({ data: mockTemplates, isLoading: false }),
  };
});

jest.mock('./recipe-cover', () => ({
  useRecipeCoverUrl: () => ({ data: null }),
}));

jest.mock('@/features/navigation/navigation-chrome-provider', () => ({
  useNavigationChrome: () => ({ openDrawer: mockOpenDrawer }),
}));

function makeRecipe(overrides: Partial<RecipeListItem>): RecipeListItem {
  return {
    id: overrides.id ?? 'recipe-id',
    household_id: 'hh-1',
    title: 'Rezept',
    instructions: null,
    cover_image_path: null,
    cook_time_minutes: null,
    difficulty: null,
    dish_types: [],
    dietary_tags: [],
    hashtags: [],
    default_servings: 1,
    created_by: null,
    created_at: '2024-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function makeTemplate(
  overrides: Partial<RecipeTemplateWithNutrition>,
): RecipeTemplateWithNutrition {
  return {
    id: overrides.id ?? 'template-id',
    title: overrides.title ?? 'Vorlage',
    cover_image_path: null,
    cook_time_minutes: 30,
    difficulty: 'easy',
    dish_types: ['dinner'],
    dietary_tags: [],
    default_servings: 2,
    sort_order: 0,
    kcalPerServing: null,
    proteinGPerServing: null,
    carbsGPerServing: null,
    ...overrides,
  };
}

beforeEach(() => {
  mockRecipes = [];
  mockTemplates = [];
  mockOpenDrawer.mockClear();
  (router.push as jest.Mock).mockClear();
});

describe('RecipesScreen — leerer Zustand', () => {
  it('zeigt einen Hinweis, wenn weder Haushaltsrezepte noch Vorlagen vorhanden sind', async () => {
    await render(<RecipesScreen />);

    expect(screen.getByText('Noch keine Rezepte im Haushalt.')).toBeOnTheScreen();
  });
});

describe('RecipesScreen — Entdecken', () => {
  beforeEach(() => {
    mockRecipes = [
      makeRecipe({
        id: 'r1',
        title: 'Salat Overview',
        cook_time_minutes: 20,
        dish_types: ['lunch'],
      }),
      makeRecipe({ id: 'r2', title: 'Pizza Home', dish_types: ['dinner'] }),
      makeRecipe({ id: 'r3', title: 'Kuchen Mine', dish_types: ['dessert'] }),
      makeRecipe({ id: 'r4', title: 'Suppe Fremd', dish_types: ['lunch'] }),
    ];
  });

  it('zeigt die Figma-Abschnitte und das erste Rezept als Trending-Karte', async () => {
    await render(<RecipesScreen />);

    expect(screen.getByText('Trending')).toBeOnTheScreen();
    expect(screen.getAllByRole('button', { name: 'Salat Overview' })).toHaveLength(2);
    expect(screen.getByText('Unsere Rezepte')).toBeOnTheScreen();
    expect(screen.getByText('Kategorien')).toBeOnTheScreen();
    expect(screen.getByText('Rezepte nach Kalorien')).toBeOnTheScreen();
  });

  it('öffnet das Navigationsmenü über den Header', async () => {
    const user = userEvent.setup();
    await render(<RecipesScreen />);

    await user.press(screen.getByRole('button', { name: 'Menü öffnen' }));

    expect(mockOpenDrawer).toHaveBeenCalledTimes(1);
  });

  it('navigiert bei Tap auf ein Haushaltsrezept zur Detailansicht', async () => {
    const user = userEvent.setup();
    await render(<RecipesScreen />);

    await user.press(screen.getAllByRole('button', { name: 'Pizza Home' })[0]);

    expect(router.push).toHaveBeenCalledWith({
      pathname: '/recipe/detail',
      params: { id: 'r2' },
    });
  });

  it('öffnet über "Alle ansehen" das gemeinsame Raster aller Haushaltsrezepte', async () => {
    const user = userEvent.setup();
    await render(<RecipesScreen />);

    await user.press(screen.getByRole('button', { name: 'Alle ansehen' }));

    expect(screen.getByText('Unsere Rezepte')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Suppe Fremd' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Zurück zu Rezepte' })).toBeOnTheScreen();
  });

  it('filtert über das zugängliche Suchfeld', async () => {
    const user = userEvent.setup();
    await render(<RecipesScreen />);

    await user.press(screen.getByRole('button', { name: 'Rezepte durchsuchen' }));
    await user.type(screen.getByRole('searchbox', { name: 'Rezepte durchsuchen' }), 'Pizza');

    expect(screen.getAllByRole('button', { name: 'Pizza Home' }).length).toBeGreaterThan(0);
    expect(screen.queryByRole('button', { name: 'Salat Overview' })).not.toBeOnTheScreen();
  });

  it('zeigt für Favoriten einen ehrlichen Leerzustand ohne Persistenz vorzutäuschen', async () => {
    const user = userEvent.setup();
    await render(<RecipesScreen />);

    await user.press(screen.getByRole('button', { name: 'Meine Favoriten' }));

    expect(screen.getByText('Noch keine Favoriten gespeichert.')).toBeOnTheScreen();
  });
});

describe('RecipesScreen — Vorlagen', () => {
  it('zeigt fuer jede Mahlzeit einen eigenen horizontalen Rezept-Carousel', async () => {
    mockTemplates = [
      makeTemplate({ id: 'breakfast-1', title: 'Porridge', dish_types: ['breakfast'] }),
      makeTemplate({ id: 'breakfast-2', title: 'Omelett', dish_types: ['breakfast'] }),
      makeTemplate({ id: 'dinner-1', title: 'Curry', dish_types: ['dinner'] }),
    ];
    await render(<RecipesScreen />);

    expect(screen.getByRole('list', { name: 'Frühstück Rezepte' })).toHaveProp('horizontal', true);
    expect(screen.getByRole('list', { name: 'Abendessen Rezepte' })).toHaveProp('horizontal', true);
  });

  it('öffnet fam-Vorlagen in der Vorlagen-Detailansicht', async () => {
    const user = userEvent.setup();
    mockTemplates = [makeTemplate({ id: 't1', title: 'Fam Ofengemüse' })];
    await render(<RecipesScreen />);

    await user.press(screen.getAllByRole('button', { name: 'Fam Ofengemüse' })[0]);

    expect(router.push).toHaveBeenCalledWith({
      pathname: '/recipe/template-detail',
      params: { id: 't1' },
    });
  });

  it('öffnet über "Alle Vorlagen ansehen" das gemeinsame Raster aller Vorlagen (#136)', async () => {
    const user = userEvent.setup();
    mockTemplates = [
      makeTemplate({ id: 't1', title: 'Fam Ofengemüse' }),
      makeTemplate({ id: 't2', title: 'Fam Linsensuppe' }),
      makeTemplate({ id: 't3', title: 'Fam Nudelauflauf' }),
      makeTemplate({ id: 't4', title: 'Fam Reispfanne' }),
      makeTemplate({ id: 't5', title: 'Fam Kürbissuppe' }),
    ];
    await render(<RecipesScreen />);

    await user.press(screen.getByRole('button', { name: 'Alle Vorlagen ansehen' }));

    expect(screen.getByText('Vorlagen')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Fam Kürbissuppe' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Zurück zu Rezepte' })).toBeOnTheScreen();
  });

  it('filtert Vorlagen über die Kategorien-Kacheln (#131)', async () => {
    const user = userEvent.setup();
    mockTemplates = [
      makeTemplate({ id: 't1', title: 'Schoko Kuchen', dish_types: ['dessert'] }),
      makeTemplate({ id: 't2', title: 'Hähnchen Curry', dish_types: ['dinner'] }),
    ];
    await render(<RecipesScreen />);

    await user.press(screen.getByRole('button', { name: 'Dessert' }));

    expect(screen.getByText('Dessert')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Schoko Kuchen' })).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Hähnchen Curry' })).not.toBeOnTheScreen();
  });

  it('filtert Vorlagen über die Kalorien-Kacheln', async () => {
    const user = userEvent.setup();
    mockTemplates = [
      makeTemplate({ id: 't1', title: 'Leichter Salat', kcalPerServing: 150 }),
      makeTemplate({ id: 't2', title: 'Deftiger Auflauf', kcalPerServing: 850 }),
    ];
    await render(<RecipesScreen />);

    await user.press(screen.getByRole('button', { name: '100–200 Kilokalorien' }));

    expect(screen.getByRole('button', { name: 'Leichter Salat' })).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Deftiger Auflauf' })).not.toBeOnTheScreen();
  });
});
