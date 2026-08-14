import { render, screen, userEvent } from '@testing-library/react-native';
import { router } from 'expo-router';

import type { RecipeTemplateListItem } from '@/features/recipe-templates/use-recipe-templates';

import { RecipesScreen } from './recipes-screen';
import type { RecipeListItem } from './use-recipes';

let mockRecipes: RecipeListItem[] = [];
let mockTemplates: RecipeTemplateListItem[] = [];
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

jest.mock('@/features/recipe-templates/use-recipe-templates', () => ({
  useRecipeTemplates: () => ({ data: mockTemplates, isLoading: false }),
}));

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

function makeTemplate(overrides: Partial<RecipeTemplateListItem>): RecipeTemplateListItem {
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
    expect(screen.getByText('Top Rezepte')).toBeOnTheScreen();
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

  it('filtert die Rezeptkarten über die Kategorie-Chips', async () => {
    const user = userEvent.setup();
    await render(<RecipesScreen />);

    await user.press(screen.getByRole('button', { name: 'Rezeptkategorie: Dessert' }));

    expect(screen.getAllByRole('button', { name: 'Kuchen Mine' }).length).toBeGreaterThan(0);
    expect(screen.queryByRole('button', { name: 'Pizza Home' })).not.toBeOnTheScreen();
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

    await user.press(screen.getByRole('button', { name: 'Meine Favoriten öffnen' }));

    expect(screen.getByText('Meine Favoriten')).toBeOnTheScreen();
    expect(screen.getByText('Noch keine Favoriten gespeichert.')).toBeOnTheScreen();
  });
});

describe('RecipesScreen — Vorlagen', () => {
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
});
