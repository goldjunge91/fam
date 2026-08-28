import { render, screen, userEvent, within } from '@testing-library/react-native';
import { router } from 'expo-router';

import { RecipesScreen } from './recipes-screen';
import type { RecipeListItem } from './use-recipes';

let mockRecipes: RecipeListItem[] = [];
const mockOpenDrawer = jest.fn();

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), canGoBack: () => false },
}));

jest.mock('@/features/household/active-household-provider', () => ({
  useActiveHousehold: () => ({ activeHouseholdId: 'hh-1' }),
  useOptionalActiveHousehold: () => ({ activeHouseholdId: 'hh-1' }),
}));

jest.mock('./use-recipes', () => ({
  useRecipes: () => ({ data: mockRecipes, isLoading: false }),
}));

jest.mock('./catalog/use-recipe-catalog', () => ({
  useCatalogRecipes: () => ({ data: [], isLoading: false }),
}));

jest.mock('./recipe-image-uploader', () => ({
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

beforeEach(() => {
  mockRecipes = [];
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

  it('zeigt Kategorien, Kalorien und Mahlzeiten ohne Trending-Bereich', async () => {
    await render(<RecipesScreen />);

    expect(screen.queryByText('Trending')).not.toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Salat Overview' })).toBeOnTheScreen();
    expect(screen.getByText('Unsere Rezepte')).toBeOnTheScreen();
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
      pathname: '/recipe/[id]',
      params: { id: 'r2' },
    });
  });

  it('öffnet über "Alle ansehen" das gemeinsame Raster aller Haushaltsrezepte', async () => {
    const user = userEvent.setup();
    await render(<RecipesScreen />);

    await user.press(screen.getByRole('button', { name: 'Alle ansehen' }));

    expect(screen.getAllByText('Eigene Rezepte').length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: 'Suppe Fremd' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Menü öffnen' })).toBeOnTheScreen();
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

  it('öffnet den Vollbildfilter mit Kategorien, Kalorien, Mahlzeiten und Rezept-Tags', async () => {
    const user = userEvent.setup();
    mockRecipes = [makeRecipe({ id: 'r1', title: 'Schneller Salat', hashtags: ['schnell'] })];
    await render(<RecipesScreen />);

    await user.press(screen.getByRole('button', { name: 'Rezepte filtern' }));

    const filterSelection = screen.getByLabelText('Filterauswahl');
    expect(within(filterSelection).getByText('Kategorien')).toBeOnTheScreen();
    expect(within(filterSelection).getByText('Rezepte nach Kalorien')).toBeOnTheScreen();
    expect(within(filterSelection).getByText('Nach Mahlzeiten')).toBeOnTheScreen();
    expect(within(filterSelection).getByRole('button', { name: 'Tag schnell' })).toBeOnTheScreen();
  });

  it('filtert eigene Rezepte über ihre Tags', async () => {
    const user = userEvent.setup();
    mockRecipes = [
      makeRecipe({ id: 'r1', title: 'Schneller Salat', hashtags: ['schnell'] }),
      makeRecipe({ id: 'r2', title: 'Sonntagsbraten', hashtags: ['sonntag'] }),
    ];
    await render(<RecipesScreen />);

    await user.press(screen.getByRole('button', { name: 'Rezepte filtern' }));
    const filterSelection = screen.getByLabelText('Filterauswahl');
    await user.press(within(filterSelection).getByRole('button', { name: 'Tag schnell' }));
    await user.press(screen.getByRole('button', { name: '1 Rezept anzeigen' }));

    expect(screen.getByRole('button', { name: 'Schneller Salat' })).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Sonntagsbraten' })).not.toBeOnTheScreen();
  });

  it('filtert eigene Rezepte über die vorhandenen Kaloriengruppen', async () => {
    const user = userEvent.setup();
    mockRecipes = [
      makeRecipe({ id: 'r1', title: 'Leichter Salat', kcalPerServing: 150 }),
      makeRecipe({ id: 'r2', title: 'Deftiger Auflauf', kcalPerServing: 850 }),
    ];
    await render(<RecipesScreen />);

    await user.press(screen.getByRole('button', { name: 'Rezepte filtern' }));
    const filterSelection = screen.getByLabelText('Filterauswahl');
    await user.press(within(filterSelection).getByRole('button', { name: '100–200 Kilokalorien' }));
    await user.press(screen.getByRole('button', { name: '1 Rezept anzeigen' }));

    expect(screen.getByRole('button', { name: 'Leichter Salat' })).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Deftiger Auflauf' })).not.toBeOnTheScreen();
  });
});
