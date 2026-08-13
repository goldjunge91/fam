import { render, screen, userEvent } from '@testing-library/react-native';
import { router } from 'expo-router';

import { RecipesScreen } from './recipes-screen';
import type { RecipeListItem } from './use-recipes';

let mockRecipes: RecipeListItem[] = [];

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), canGoBack: () => false },
}));

jest.mock('@/features/auth/session-provider', () => ({
  useSession: () => ({ session: { user: { id: 'user-1' } } }),
}));

jest.mock('@/features/household/active-household-provider', () => ({
  useActiveHousehold: () => ({ activeHouseholdId: 'hh-1' }),
}));

jest.mock('./use-recipes', () => ({
  useRecipes: () => ({ data: mockRecipes, isLoading: false }),
}));

jest.mock('./recipe-cover', () => ({
  useRecipeCoverUrl: () => ({ data: null }),
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

beforeEach(() => {
  mockRecipes = [];
  (router.push as jest.Mock).mockClear();
});

describe('RecipesScreen — leerer Zustand', () => {
  it('zeigt einen Hinweis, wenn der Haushalt noch keine Rezepte hat', async () => {
    mockRecipes = [];
    await render(<RecipesScreen />);
    expect(screen.getByText('Noch keine Rezepte im Haushalt.')).toBeOnTheScreen();
  });
});

describe('RecipesScreen — Abschnitte', () => {
  beforeEach(() => {
    mockRecipes = [
      makeRecipe({
        id: 'r1',
        title: 'Salat Overview',
        instructions: 'Kurze Zusammenfassung der Zutaten',
        cook_time_minutes: 20,
        dish_types: ['lunch'],
        created_by: 'user-2',
        created_at: '2024-01-01T00:00:00.000Z',
      }),
      makeRecipe({
        id: 'r2',
        title: 'Pizza Home',
        dish_types: ['dinner'],
        created_by: 'user-1',
        created_at: '2024-01-02T00:00:00.000Z',
      }),
      makeRecipe({
        id: 'r3',
        title: 'Kuchen Mine',
        dish_types: ['dessert'],
        created_by: 'user-1',
        created_at: '2024-01-03T00:00:00.000Z',
      }),
      makeRecipe({
        id: 'r4',
        title: 'Suppe Fremd',
        dish_types: ['lunch'],
        created_by: 'user-2',
        created_at: '2024-01-04T00:00:00.000Z',
      }),
    ];
  });

  it('zeigt das erste Rezept als "Trending Recipe" mit Kurzbeschreibung', async () => {
    await render(<RecipesScreen />);

    expect(screen.getByText('Trending Recipe')).toBeOnTheScreen();
    expect(screen.getByText('Salat Overview')).toBeOnTheScreen();
    expect(screen.getByText('Kurze Zusammenfassung der Zutaten')).toBeOnTheScreen();
    expect(screen.getByText('20min')).toBeOnTheScreen();
  });

  it('zeigt in "Deine Rezepte" nur Rezepte des angemeldeten Users', async () => {
    await render(<RecipesScreen />);

    expect(screen.getByText('Deine Rezepte')).toBeOnTheScreen();
    expect(screen.getByText('Pizza Home')).toBeOnTheScreen();
    expect(screen.getByText('Kuchen Mine')).toBeOnTheScreen();
  });

  it('navigiert bei Tap auf ein Rezept zur Detailansicht', async () => {
    const user = userEvent.setup();
    await render(<RecipesScreen />);

    // "Pizza Home" landet sowohl in "Deine Rezepte" als auch (als reines
    // Thumbnail) in "Kuerzlich hinzugefuegt" — beide Vorkommen fuehren zum
    // selben Rezept, deshalb genuegt das erste.
    await user.press(screen.getAllByRole('button', { name: 'Pizza Home' })[0]);

    expect(router.push).toHaveBeenCalledWith({
      pathname: '/recipe/detail',
      params: { id: 'r2' },
    });
  });

  it('navigiert bei Tap auf das Stift-Icon zum Rezept-Wizard', async () => {
    const user = userEvent.setup();
    await render(<RecipesScreen />);

    await user.press(screen.getByRole('button', { name: 'Rezept anlegen' }));

    expect(router.push).toHaveBeenCalledWith('/recipe/create');
  });

  it('filtert alle Abschnitte ueber die Kategorie-Pills', async () => {
    const user = userEvent.setup();
    await render(<RecipesScreen />);

    await user.press(screen.getByText('Dessert'));

    expect(screen.getByText('Kuchen Mine')).toBeOnTheScreen();
    expect(screen.queryByText('Salat Overview')).not.toBeOnTheScreen();
    expect(screen.queryByText('Pizza Home')).not.toBeOnTheScreen();
  });

  it('filtert ueber die Suche nach Tap auf das Such-Icon', async () => {
    const user = userEvent.setup();
    await render(<RecipesScreen />);

    await user.press(screen.getByRole('button', { name: 'Rezepte durchsuchen' }));
    await user.type(screen.getByPlaceholderText('Rezepte durchsuchen…'), 'Pizza');

    expect(screen.getByText('Pizza Home')).toBeOnTheScreen();
    expect(screen.queryByText('Salat Overview')).not.toBeOnTheScreen();
  });
});

describe('RecipesScreen — "Deine Rezepte" Fallback', () => {
  it('faellt auf andere Rezepte zurueck, wenn der User selbst keine angelegt hat', async () => {
    mockRecipes = [
      makeRecipe({ id: 'r1', title: 'Fremdes Trending', created_by: 'user-2' }),
      makeRecipe({ id: 'r2', title: 'Fremdes Zweites', created_by: 'user-2' }),
    ];

    await render(<RecipesScreen />);

    expect(screen.getByText('Deine Rezepte')).toBeOnTheScreen();
    expect(screen.getByText('Fremdes Zweites')).toBeOnTheScreen();
  });
});
