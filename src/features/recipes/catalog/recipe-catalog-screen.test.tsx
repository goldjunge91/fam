import { fireEvent, render, screen } from '@testing-library/react-native';
import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { RecipeCatalogScreen } from './recipe-catalog-screen';
import type { CatalogRecipe } from './use-recipe-catalog';

type CatalogListState = {
  data: CatalogRecipe[];
  isLoading: boolean;
  isError: boolean;
  fetchNextPage: jest.Mock;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  isFetchNextPageError: boolean;
};

let mockListState: CatalogListState;

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn() },
}));

jest.mock('@/components/layout/hub-screen', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');

  return {
    HubScreen: ({
      children,
      header,
    }: {
      children: ReactNode;
      header: { leading?: ReactNode; trailing?: ReactNode };
    }) => React.createElement(View, null, header.leading, header.trailing, children),
  };
});

jest.mock('@shopify/flash-list', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { Pressable, Text, View } =
    jest.requireActual<typeof import('react-native')>('react-native');

  return {
    FlashList: ({
      data,
      keyExtractor,
      renderItem,
      ItemSeparatorComponent,
      ListEmptyComponent,
      ListFooterComponent,
      onEndReached,
    }: {
      data: CatalogRecipe[];
      keyExtractor: (item: CatalogRecipe) => string;
      renderItem: (input: { item: CatalogRecipe }) => ReactNode;
      ItemSeparatorComponent?: React.ComponentType;
      ListEmptyComponent: ReactNode;
      ListFooterComponent: ReactNode;
      onEndReached: () => void;
    }) =>
      React.createElement(
        View,
        null,
        data.length === 0
          ? ListEmptyComponent
          : data.flatMap((item, index) => [
              React.createElement(View, { key: keyExtractor(item) }, renderItem({ item })),
              ...(index < data.length - 1 && ItemSeparatorComponent
                ? [React.createElement(ItemSeparatorComponent, { key: `separator-${index}` })]
                : []),
            ]),
        ListFooterComponent,
        React.createElement(
          Pressable,
          { accessibilityRole: 'button', onPress: onEndReached },
          React.createElement(Text, null, 'Weitere Rezepte laden'),
        ),
      ),
  };
});

jest.mock('../components/recipe-preview-card', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { Pressable, Text } = jest.requireActual<typeof import('react-native')>('react-native');

  return {
    RecipePreviewCard: ({ title, onPress }: { title: string; onPress: () => void }) =>
      React.createElement(
        Pressable,
        { accessibilityRole: 'button', onPress },
        React.createElement(Text, null, title),
      ),
  };
});

jest.mock('./use-recipe-catalog', () => ({
  getCatalogCoverPath: (recipe: CatalogRecipe) => recipe.cover_image_path,
  useCatalogRecipes: () => mockListState,
}));

beforeEach(() => {
  mockListState = {
    data: [],
    isLoading: false,
    isError: false,
    fetchNextPage: jest.fn(),
    hasNextPage: false,
    isFetchingNextPage: false,
    isFetchNextPageError: false,
  };
});

it('zeigt Lade-, Fehler- und Leerzustände im Katalog', async () => {
  mockListState.isLoading = true;
  const loading = await render(<RecipeCatalogScreen />);
  expect(loading.toJSON()).toMatchObject({
    children: expect.arrayContaining([
      expect.objectContaining({
        children: expect.arrayContaining([expect.objectContaining({ type: 'ActivityIndicator' })]),
      }),
    ]),
  });
  await loading.unmount();

  mockListState.isLoading = false;
  mockListState.isError = true;
  mockListState.isFetchNextPageError = true;
  await render(<RecipeCatalogScreen />);
  expect(screen.getByText('Der Rezeptkatalog konnte nicht geladen werden.')).toBeOnTheScreen();
  expect(screen.getByText('Weitere Rezepte konnten nicht geladen werden.')).toBeOnTheScreen();
});

it('zeigt eine leere Mitteilung, listet Rezepte und lädt nur wenn eine Seite verfügbar ist', async () => {
  const empty = await render(<RecipeCatalogScreen />);
  expect(screen.getByText('Der Rezeptkatalog ist noch leer.')).toBeOnTheScreen();
  await empty.unmount();

  const recipe = {
    id: 'recipe-1',
    external_id: 'template:recipe-1',
    slug: 'recipe-1',
    title: 'Ofengemüse',
    cover_image_path: null,
    cook_time_minutes: 30,
    difficulty: 'easy',
    default_servings: 2,
  } as CatalogRecipe;
  const fetchNextPage = jest.fn();
  mockListState = {
    ...mockListState,
    data: [recipe, { ...recipe, id: 'recipe-2', slug: 'recipe-2', title: 'Zweite Mahlzeit' }],
    fetchNextPage,
    hasNextPage: true,
  };
  await render(<RecipeCatalogScreen />);
  expect(screen.getByText('Ofengemüse')).toBeOnTheScreen();
  await fireEvent.press(screen.getByText('Weitere Rezepte laden'));
  expect(fetchNextPage).toHaveBeenCalledTimes(1);
  await fireEvent.press(screen.getByText('Ofengemüse'));
  expect(router.push).toHaveBeenCalledWith('/recipe/catalog/recipe-1');
  await fireEvent.press(screen.getByText('Zurück'));
  expect(router.back).toHaveBeenCalledTimes(1);
});

it('verhindert paralleles oder unnoetiges Laden weiterer Katalogseiten', async () => {
  const fetchNextPage = jest.fn();
  mockListState.fetchNextPage = fetchNextPage;
  const screenRender = await render(<RecipeCatalogScreen />);
  await fireEvent.press(screen.getByText('Weitere Rezepte laden'));
  mockListState = {
    ...mockListState,
    hasNextPage: true,
    isFetchingNextPage: true,
  };
  await screenRender.rerender(<RecipeCatalogScreen />);
  await fireEvent.press(screen.getByText('Weitere Rezepte laden'));

  expect(fetchNextPage).not.toHaveBeenCalled();
});
