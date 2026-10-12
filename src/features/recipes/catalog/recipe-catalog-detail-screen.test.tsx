import { render, screen, userEvent, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { Alert } from 'react-native';
import { RecipeCatalogDetailScreen } from './recipe-catalog-detail-screen';
import type { CatalogDetail } from './use-recipe-catalog';

let mockDetail: CatalogDetail | null = null;
let mockIsLoading = true;
let mockHouseholdId: string | null = 'household-1';
let mockSession: { user: { id: string } } | null = { user: { id: 'user-1' } };
let mockFavorite = false;
let mockCopyPending = false;
const mockToggleFavorite = jest.fn();
const mockCopyMutateAsync = jest.fn();

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: jest.fn() },
  useLocalSearchParams: () => ({ slug: 'ofen-gemuese' }),
}));

jest.mock('expo-image', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { Text: NativeText } = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    Image: ({ accessibilityLabel }: { accessibilityLabel?: string }) =>
      React.createElement(NativeText, { accessibilityLabel }, 'Schrittbild'),
  };
});

jest.mock('@/components/layout/back-button', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { Text: NativeText } = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    BackButton: ({ label }: { label: string }) => React.createElement(NativeText, null, label),
  };
});

jest.mock('@/components/layout/hub-screen', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { Text: NativeText, View: NativeView } =
    jest.requireActual<typeof import('react-native')>('react-native');
  return {
    HubScreen: ({
      children,
      header,
    }: {
      children: ReactNode;
      header: { title: string; leading?: ReactNode; trailing?: ReactNode };
    }) =>
      React.createElement(
        NativeView,
        null,
        header.leading,
        React.createElement(NativeText, null, header.title),
        header.trailing,
        children,
      ),
  };
});

jest.mock('@/components/theme/ThemeProvider', () => ({
  useTheme: () => ({
    colors: {
      border: '#ccc',
      accent: '#957b91',
      backgroundElement: '#f0e8ed',
      onAccent: '#fff',
    },
  }),
}));

jest.mock('@/components/ui/header-icon-button', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { Pressable: NativePressable } =
    jest.requireActual<typeof import('react-native')>('react-native');
  return {
    HeaderIconButton: ({
      label,
      onPress,
      children,
    }: {
      label: string;
      onPress: () => void;
      children: ReactNode;
    }) =>
      React.createElement(
        NativePressable,
        { accessibilityRole: 'button', accessibilityLabel: label, onPress },
        children,
      ),
  };
});

jest.mock('@/constants/ui', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { Pressable: NativePressable, Text: NativeText } =
    jest.requireActual<typeof import('react-native')>('react-native');
  return {
    Press: ({
      children,
      onPress,
      disabled,
      accessibilityRole,
      accessibilityLabel,
      accessibilityState,
    }: {
      children: React.ReactNode;
      onPress: () => void;
      disabled?: boolean;
      accessibilityRole?: 'button' | 'tab';
      accessibilityLabel?: string;
      accessibilityState?: { selected?: boolean; expanded?: boolean };
    }) =>
      React.createElement(
        NativePressable,
        {
          accessibilityRole,
          accessibilityLabel,
          accessibilityState,
          disabled,
          onPress,
        },
        children,
      ),
    Txt: ({ children }: { children: ReactNode }) => React.createElement(NativeText, null, children),
  };
});

jest.mock('@/features/auth/session-provider', () => ({
  useSession: () => ({ session: mockSession }),
}));

jest.mock('@/features/household/active-household-provider', () => ({
  useActiveHousehold: () => ({ activeHouseholdId: mockHouseholdId }),
}));

jest.mock('@/features/recipes/components/recipe-detail-primitives', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { Text: NativeText } = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    HeartGlyph: ({ filled }: { filled: boolean }) =>
      React.createElement(NativeText, null, filled ? 'Favorit' : 'Kein Favorit'),
    HeroArtwork: ({ coverUrl, title }: { coverUrl: string | null; title: string }) =>
      React.createElement(NativeText, null, `${title} ${coverUrl ?? ''}`),
  };
});

jest.mock('@/features/recipes/domain/recipe-favorites', () => ({
  useRecipeFavorites: () => ({
    isFavorite: () => mockFavorite,
    toggleFavorite: mockToggleFavorite,
  }),
}));

jest.mock('./use-recipe-catalog', () => ({
  useCatalogRecipe: () => ({ data: mockDetail, isLoading: mockIsLoading }),
  useCatalogImageUrl: (path: string | null | undefined) => ({
    data: path ? `https://images.example/${path}` : null,
  }),
  useCopyCatalogRecipeMutation: () => ({
    mutateAsync: mockCopyMutateAsync,
    isPending: mockCopyPending,
  }),
}));

function makeDetail(overrides: Partial<CatalogDetail> = {}): CatalogDetail {
  return {
    recipe: {
      id: 'catalog-1',
      external_id: 'template:catalog-1',
      slug: 'ofen-gemuese',
      title: 'Ofengemüse',
      instructions: 'Alles würzen und backen.',
      prep_time_minutes: 10,
      cook_time_minutes: 25,
      storage_instructions: null,
      reheating_instructions: null,
      cheap_tips: [],
      substitutions: [],
      crispiness_level: null,
      air_fryer_time_minutes: null,
      air_fryer_temperature_f: null,
      variant_group: null,
      variant_type: null,
      dorm_friendly: false,
      meal_prep_friendly: true,
      why_cheap: null,
      healthier_tips: [],
      batch_prep_tips: [],
      optional_add_ins: [],
      difficulty: 'easy',
      dish_types: ['unknown-dish'],
      dietary_tags: ['unknown-diet'],
      hashtags: ['quick', '#family'],
      default_servings: 2,
      status: 'published',
      sort_order: 1,
      source_url: null,
      cover_image_path: null,
    },
    components: [
      { id: 'main', recipe_id: 'catalog-1', name: 'Gemüse', serving_grams: 150, position: 0 },
      { id: 'side', recipe_id: 'catalog-1', name: 'Beilage', serving_grams: null, position: 1 },
      { id: 'empty', recipe_id: 'catalog-1', name: 'Extras', serving_grams: null, position: 2 },
    ],
    items: [
      {
        id: 'product-item',
        component_id: 'main',
        recipe_id: 'catalog-1',
        product_id: 'potato',
        sub_component_id: null,
        ingredient_name: null,
        grams: 100,
        quantity: 1,
        unit: 'Stück',
        position: 0,
        optional: false,
        note: null,
      },
      {
        id: 'manual-item',
        component_id: 'main',
        recipe_id: 'catalog-1',
        product_id: null,
        sub_component_id: null,
        ingredient_name: 'Mehl',
        grams: 50,
        quantity: null,
        unit: 'g',
        position: 1,
        optional: false,
        note: null,
      },
      {
        id: 'group-item',
        component_id: 'main',
        recipe_id: 'catalog-1',
        product_id: null,
        sub_component_id: 'side',
        ingredient_name: null,
        grams: 25,
        quantity: null,
        unit: 'g',
        position: 2,
        optional: true,
        note: null,
      },
      {
        id: 'fallback-item',
        component_id: 'main',
        recipe_id: 'catalog-1',
        product_id: null,
        sub_component_id: null,
        ingredient_name: null,
        grams: 5,
        quantity: 2,
        unit: 'Prise',
        position: 3,
        optional: false,
        note: null,
      },
    ],
    steps: [
      { id: 'step-1', recipe_id: 'catalog-1', position: 0, text: 'Mischen', timer_minutes: 5 },
      { id: 'step-2', recipe_id: 'catalog-1', position: 1, text: 'Backen', timer_minutes: null },
    ],
    stepIngredients: [],
    images: [
      {
        id: 'cover',
        recipe_id: 'catalog-1',
        storage_path: 'catalog/cover.jpg',
        source_url: null,
        source_page_url: null,
        source_name: null,
        license: null,
        attribution_required: false,
        attribution_text: null,
        verified_match: false,
        alt_text: null,
        position: 0,
      },
    ],
    stepImages: [{ step_id: 'step-1', storage_path: 'catalog/step-1.jpg', position: 0 }],
    productsById: new Map([
      [
        'potato',
        {
          id: 'potato',
          name: 'Kartoffel',
          kcal_per_100: 80,
          protein_g_per_100: 2,
          carbs_g_per_100: 18,
          fat_g_per_100: 0.1,
        },
      ],
    ]),
    nutrition: { grams: 200, kcal: 400, protein_g: 20, carbs_g: 40, fat_g: 10 },
    ...overrides,
  };
}

beforeEach(() => {
  mockDetail = null;
  mockIsLoading = true;
  mockHouseholdId = 'household-1';
  mockSession = { user: { id: 'user-1' } };
  mockFavorite = false;
  mockCopyPending = false;
  mockToggleFavorite.mockReset();
  mockCopyMutateAsync.mockReset().mockResolvedValue({ id: 'copied-recipe' });
  (router.push as jest.Mock).mockClear();
  (router.replace as jest.Mock).mockClear();
});

it('zeigt den Ladezustand, solange das Katalogrezept fehlt', async () => {
  await render(<RecipeCatalogDetailScreen />);

  expect(screen.getByText('Rezept wird geladen…')).toBeOnTheScreen();
});

it('zeigt Details, skaliert Zutaten, erweitert Tags und öffnet Kochmodus sowie Favorit', async () => {
  const user = userEvent.setup();
  mockDetail = makeDetail();
  mockIsLoading = false;
  await render(<RecipeCatalogDetailScreen />);

  expect(screen.getByText('Ofengemüse')).toBeOnTheScreen();
  expect(screen.getByText('200 kcal')).toBeOnTheScreen();
  expect(screen.getByText('25 Min')).toBeOnTheScreen();
  expect(screen.getByText('Alles würzen und backen.')).toBeOnTheScreen();
  expect(screen.getByText(/https:\/\/images\.example\/catalog\/cover\.jpg/)).toBeOnTheScreen();
  expect(screen.getByText('#unknown-dish')).toBeOnTheScreen();
  expect(screen.queryByText('#family')).not.toBeOnTheScreen();
  expect(screen.getAllByText('Noch keine Zutaten in dieser Gruppe.')).toHaveLength(2);
  expect(screen.getByText('Mischen')).toBeOnTheScreen();
  expect(screen.getByText('⏱ 5 Min. Timer')).toBeOnTheScreen();
  expect(screen.getByLabelText('Bild für Schritt 1')).toBeOnTheScreen();
  expect(screen.getByText('2 Schritte')).toBeOnTheScreen();

  await user.press(screen.getByRole('button', { name: 'Alle Tags anzeigen' }));
  expect(screen.getByText('#family')).toBeOnTheScreen();
  await user.press(screen.getByRole('button', { name: 'Weniger Tags anzeigen' }));

  await user.press(screen.getByRole('button', { name: 'Mehr Portionen' }));
  expect(screen.getByText('3', { exact: true })).toBeOnTheScreen();
  expect(screen.getByText('225 g zubereitet')).toBeOnTheScreen();
  expect(screen.getByText('2 Stück')).toBeOnTheScreen();
  expect(screen.getByText('75 g')).toBeOnTheScreen();
  expect(screen.getByText('38 g')).toBeOnTheScreen();
  expect(screen.getByText('3 Prise')).toBeOnTheScreen();

  await user.press(screen.getByRole('button', { name: 'Zu Favoriten hinzufügen' }));
  expect(mockToggleFavorite).toHaveBeenCalledWith('catalog:catalog-1');
  await user.press(screen.getByRole('button', { name: 'Kochmodus starten' }));
  expect(router.push).toHaveBeenCalledWith({
    pathname: '/recipe/cook',
    params: { slug: 'ofen-gemuese' },
  });
});

it('zeigt fehlende Werte, leere Zutaten und Bewertungen', async () => {
  const user = userEvent.setup();
  const detail = makeDetail({
    recipe: {
      ...makeDetail().recipe,
      instructions: null,
      cook_time_minutes: null,
      difficulty: null,
      dish_types: [],
      dietary_tags: [],
      hashtags: [],
      default_servings: 0,
      cover_image_path: 'recipe-covers/direct.jpg',
    },
    components: [],
    items: [],
    steps: [],
    images: [],
    stepImages: [],
    nutrition: { grams: 0, kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0 },
  });
  mockDetail = detail;
  mockIsLoading = false;
  await render(<RecipeCatalogDetailScreen />);

  expect(screen.getAllByText('–')).toHaveLength(3);
  expect(screen.getByText('Noch keine Zutaten hinterlegt.')).toBeOnTheScreen();
  expect(screen.getByText('Noch keine Zubereitungsschritte hinterlegt.')).toBeOnTheScreen();
  expect(
    screen.getByText(/https:\/\/images\.example\/recipe-covers\/direct\.jpg/),
  ).toBeOnTheScreen();

  await user.press(screen.getByRole('tab', { name: 'Bewertungen' }));
  expect(screen.getByText('Noch keine Bewertungen')).toBeOnTheScreen();
  expect(
    screen.getByText('Bewertungen sind für Katalogrezepte noch nicht verfügbar.'),
  ).toBeOnTheScreen();
  await user.press(screen.getByRole('tab', { name: 'Details' }));
  expect(screen.getByText('Noch keine Zutaten hinterlegt.')).toBeOnTheScreen();
});

it('deaktiviert die Übernahme ohne Haushalt oder Anmeldung', async () => {
  mockDetail = makeDetail();
  mockIsLoading = false;
  mockHouseholdId = null;
  mockSession = null;
  mockCopyPending = true;
  await render(<RecipeCatalogDetailScreen />);

  const copyButton = screen.getByRole('button', { name: 'Rezept in meine Rezepte übernehmen' });
  expect(copyButton).toBeDisabled();
});

it('kopiert ins eigene Rezeptarchiv und meldet verständliche Fehler', async () => {
  const user = userEvent.setup();
  mockDetail = makeDetail();
  mockIsLoading = false;
  await render(<RecipeCatalogDetailScreen />);

  await user.press(screen.getByRole('button', { name: 'Rezept in meine Rezepte übernehmen' }));
  expect(mockCopyMutateAsync).toHaveBeenCalledWith(mockDetail);
  await waitFor(() =>
    expect(router.replace).toHaveBeenCalledWith({
      pathname: '/recipe/[id]',
      params: { id: 'copied-recipe' },
    }),
  );

  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  mockCopyMutateAsync.mockRejectedValueOnce(new Error('Katalogkopie nicht möglich'));
  await user.press(screen.getByRole('button', { name: 'Rezept in meine Rezepte übernehmen' }));
  await waitFor(() =>
    expect(alert).toHaveBeenCalledWith(
      'Rezept konnte nicht übernommen werden',
      'Katalogkopie nicht möglich',
    ),
  );

  mockCopyMutateAsync.mockRejectedValueOnce('offline');
  await user.press(screen.getByRole('button', { name: 'Rezept in meine Rezepte übernehmen' }));
  await waitFor(() =>
    expect(alert).toHaveBeenLastCalledWith(
      'Rezept konnte nicht übernommen werden',
      'Bitte versuche es erneut.',
    ),
  );
  alert.mockRestore();
});
