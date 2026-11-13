import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, userEvent } from '@testing-library/react-native';
import * as Speech from 'expo-speech';
import { Alert } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { celebrate } from '@/features/gamification/celebration';
import { recordActivity } from '@/features/gamification/streak';
import type { CatalogDetail } from '../catalog/use-recipe-catalog';
import type { RecipeDetail } from '../hooks/use-recipes';
import { CookingModeScreen } from './cooking-mode-screen';

const mockNavigation = { canGoBack: () => true, addListener: () => () => {} };

let mockRouteParams: { id?: string; slug?: string } = { id: 'recipe-1' };

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), canGoBack: () => true },
  useLocalSearchParams: () => mockRouteParams,
  useNavigation: () => mockNavigation,
}));

let mockDetail: RecipeDetail | null = null;
let mockLoading = false;
let mockCatalogDetail: CatalogDetail | null = null;
let mockCatalogLoading = false;

jest.mock('../hooks/use-recipes', () => ({
  useRecipeDetail: () => ({ data: mockDetail, isLoading: mockLoading }),
}));

jest.mock('../catalog/use-recipe-catalog', () => ({
  useCatalogRecipe: () => ({ data: mockCatalogDetail, isLoading: mockCatalogLoading }),
  useCatalogImageUrl: () => ({ data: null }),
  toCookingRecipeDetail: () => mockDetail,
}));

jest.mock('expo-speech', () => ({
  speak: jest.fn(),
  stop: jest.fn(async () => undefined),
}));

jest.mock('expo-speech-recognition', () => ({
  ExpoSpeechRecognitionModule: {
    requestMicrophonePermissionsAsync: jest.fn(),
    requestSpeechRecognizerPermissionsAsync: jest.fn(),
  },
}));

function getSpeechPermissionSpies(): {
  requestMicrophonePermissionsAsync: jest.Mock;
  requestSpeechRecognizerPermissionsAsync: jest.Mock;
} {
  return (
    jest.requireMock('expo-speech-recognition') as {
      ExpoSpeechRecognitionModule: {
        requestMicrophonePermissionsAsync: jest.Mock;
        requestSpeechRecognizerPermissionsAsync: jest.Mock;
      };
    }
  ).ExpoSpeechRecognitionModule;
}

jest.mock('@/features/shopping-list/stt-beta/services/native-speech-recognition', () => ({
  nativeSpeechRecognitionAdapter: { start: jest.fn() },
}));

function getNativeSpeechRecognitionStart(): jest.Mock {
  return (
    jest.requireMock('@/features/shopping-list/stt-beta/services/native-speech-recognition') as {
      nativeSpeechRecognitionAdapter: { start: jest.Mock };
    }
  ).nativeSpeechRecognitionAdapter.start;
}

function getSpeechSpies(): { speak: jest.Mock; stop: jest.Mock } {
  return Speech as unknown as { speak: jest.Mock; stop: jest.Mock };
}

let mockIsPremium = false;

jest.mock('@/features/premium/premium-provider', () => ({
  usePremium: () => ({ hasPlus: mockIsPremium }),
}));

jest.mock('@/features/gamification/streak', () => ({
  recordActivity: jest.fn(() => ({ count: 1, increased: true, milestone: false })),
}));

jest.mock('@/features/gamification/celebration', () => ({
  celebrate: jest.fn(),
}));

function renderScreen() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Number.POSITIVE_INFINITY } },
  });
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
    components: [
      { id: 'sauce', recipe_id: 'recipe-1', name: 'Soße', serving_grams: 200 },
      { id: 'side', recipe_id: 'recipe-1', name: 'Beilage', serving_grams: 150 },
    ],
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
      {
        id: 'item-3',
        component_id: 'side',
        product_id: 'nudeln',
        sub_component_id: null,
        grams: 200,
        quantity: 200,
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
        timer_minutes: null,
        ingredientIds: [],
      },
      {
        id: 'step-2',
        recipe_id: 'recipe-1',
        position: 1,
        text: 'Zwiebeln anbraten',
        image_path: null,
        timer_minutes: null,
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
      [
        'nudeln',
        {
          id: 'nudeln',
          name: 'Nudeln',
          kcal_per_100: 350,
          protein_g_per_100: 12,
          carbs_g_per_100: 70,
          fat_g_per_100: 2,
        },
      ],
    ]),
  };
}

function makeTimerDetail(): RecipeDetail {
  const detail = makeDetail();
  detail.steps[0] = {
    ...detail.steps[0],
    text: 'Wasser aufsetzen, 1 Minute',
    timer_minutes: 2,
  };
  return detail;
}

function makeDetailWithoutGroupWeights(): RecipeDetail {
  const detail = makeDetail();
  return {
    ...detail,
    components: detail.components.map((component) => ({
      ...component,
      serving_grams: null,
    })),
  };
}

beforeEach(() => {
  mockRouteParams = { id: 'recipe-1' };
  mockDetail = null;
  mockLoading = false;
  mockCatalogDetail = null;
  mockCatalogLoading = false;
  mockIsPremium = false;
  getNativeSpeechRecognitionStart().mockClear();
  getSpeechSpies().speak.mockClear();
  getSpeechSpies().stop.mockClear();
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  const permissionSpies = getSpeechPermissionSpies();
  permissionSpies.requestMicrophonePermissionsAsync.mockClear();
  permissionSpies.requestSpeechRecognizerPermissionsAsync.mockClear();
  jest.mocked(recordActivity).mockReturnValue({ count: 1, increased: true, milestone: false });
  jest.mocked(celebrate).mockClear();
});

afterEach(() => {
  jest.restoreAllMocks();
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

    expect(screen.getByText('Soße')).toBeOnTheScreen();
    expect(screen.getByText('Beilage')).toBeOnTheScreen();
    expect(screen.getByText('Tomaten')).toBeOnTheScreen();
    expect(screen.getByText('Hackfleisch')).toBeOnTheScreen();
    expect(screen.getByText('Nudeln')).toBeOnTheScreen();
  });

  it('öffnet ein Katalogrezept im Kochmodus, ohne es zu kopieren', async () => {
    mockRouteParams = { slug: 'mediterrane-gemuese-lasagne' };
    mockCatalogDetail = { stepImages: [] } as unknown as CatalogDetail;
    mockDetail = makeDetail();
    await renderScreen();

    expect(screen.getByText('Spaghetti Bolognese')).toBeOnTheScreen();
    expect(screen.getByText('Tomaten')).toBeOnTheScreen();
    expect(screen.getByText('Wasser aufsetzen')).toBeOnTheScreen();
  });

  it('zeigt Katalog-Zutaten auch ohne Gruppengewichte', async () => {
    mockRouteParams = { slug: 'mediterrane-gemuese-lasagne' };
    mockCatalogDetail = { stepImages: [] } as unknown as CatalogDetail;
    mockDetail = makeDetailWithoutGroupWeights();
    await renderScreen();

    expect(screen.getByText('Soße')).toBeOnTheScreen();
    expect(screen.getByText('Tomaten')).toBeOnTheScreen();
    expect(screen.getByText('Beilage')).toBeOnTheScreen();
    expect(screen.getByText('Nudeln')).toBeOnTheScreen();
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
    expect(screen.queryByText('Voice bereit')).not.toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Zuhören' })).not.toBeOnTheScreen();
    expect(getNativeSpeechRecognitionStart()).not.toHaveBeenCalled();
    expect(getSpeechPermissionSpies().requestMicrophonePermissionsAsync).not.toHaveBeenCalled();
    expect(
      getSpeechPermissionSpies().requestSpeechRecognizerPermissionsAsync,
    ).not.toHaveBeenCalled();
  });

  it('fragt einmal nach Hands-free und bleibt bei Nein im Touch-Ablauf', async () => {
    mockDetail = makeDetail();
    mockIsPremium = true;
    const view = await renderScreen();

    expect(Alert.alert).toHaveBeenCalledTimes(1);
    expect(Alert.alert).toHaveBeenCalledWith(
      'Hands-free im Kochmodus?',
      expect.any(String),
      expect.any(Array),
    );
    const buttons = jest.mocked(Alert.alert).mock.calls[0]?.[2];
    await act(async () => {
      buttons?.find((button) => button.text === 'Nein')?.onPress?.();
    });

    expect(screen.getByRole('button', { name: 'Nächster Schritt' })).toBeOnTheScreen();
    expect(getNativeSpeechRecognitionStart()).not.toHaveBeenCalled();
    expect(getSpeechPermissionSpies().requestMicrophonePermissionsAsync).not.toHaveBeenCalled();
    expect(
      getSpeechPermissionSpies().requestSpeechRecognizerPermissionsAsync,
    ).not.toHaveBeenCalled();

    await view.rerender(
      <QueryClientProvider client={new QueryClient()}>
        <SafeAreaProvider
          initialMetrics={{
            frame: { x: 0, y: 0, width: 390, height: 844 },
            insets: { top: 47, left: 0, right: 0, bottom: 34 },
          }}>
          <CookingModeScreen />
        </SafeAreaProvider>
      </QueryClientProvider>,
    );
    expect(Alert.alert).toHaveBeenCalledTimes(1);
  });

  it('startet den ersten Schritt nach der Hands-free-Zustimmung ohne weiteren Touch', async () => {
    mockDetail = makeDetail();
    mockIsPremium = true;
    await renderScreen();

    const buttons = jest.mocked(Alert.alert).mock.calls[0]?.[2];
    await act(async () => {
      buttons?.find((button) => button.text === 'Hands-free aktivieren')?.onPress?.();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(getSpeechSpies().speak).toHaveBeenCalledWith('Wasser aufsetzen', expect.anything());
    expect(getNativeSpeechRecognitionStart()).not.toHaveBeenCalled();
  });
  it('zeigt im Plus-Schritt nur explizit verknüpfte Zutaten und den bereiten Voice-Status', async () => {
    const detail = makeDetail();
    detail.steps[0] = { ...detail.steps[0], ingredientIds: ['item-1', 'missing-item'] };
    mockDetail = detail;
    mockIsPremium = true;
    await renderScreen();

    expect(screen.getByText('Voice bereit')).toBeOnTheScreen();
    expect(screen.getByText('50 g Tomaten')).toBeOnTheScreen();
    expect(screen.queryByText('300 g Hackfleisch')).not.toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Vorlesen' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Zuhören' })).toBeOnTheScreen();
  });

  it('zeigt im Premium-Kochmodus die explizite Timer-Dauer vor dem Text-Fallback', async () => {
    mockDetail = makeTimerDetail();
    mockIsPremium = true;
    await renderScreen();

    expect(screen.getByText('02:00')).toBeOnTheScreen();
    expect(screen.getByText('Pausiert')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Timer fortsetzen' })).toBeOnTheScreen();
  });

  it('zeichnet ein Rezept beim Abschluss des Kochmodus als gekocht auf', async () => {
    mockDetail = makeDetail();
    mockIsPremium = true;
    await renderScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'Nächster Schritt' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Zubereitung abschließen' }));

    expect(await screen.findByText('Guten Appetit!')).toBeOnTheScreen();
    expect(recordActivity).toHaveBeenCalledTimes(1);
  });

  it('kehrt nach dem Abschluss zum zuletzt angezeigten Schritt zurück', async () => {
    const user = userEvent.setup();
    mockDetail = makeDetail();
    mockIsPremium = true;
    await renderScreen();

    await user.press(screen.getByRole('button', { name: 'Nächster Schritt' }));
    expect(screen.getByText('SCHRITT 2 VON 2')).toBeOnTheScreen();

    await user.press(screen.getByRole('button', { name: 'Zubereitung abschließen' }));
    await user.press(screen.getByRole('button', { name: 'Zurück zum letzten Schritt' }));

    expect(screen.getByText('SCHRITT 2 VON 2')).toBeOnTheScreen();
  });

  it('geht im Premium-Kochmodus zum vorherigen Schritt zurück', async () => {
    const user = userEvent.setup();
    mockDetail = makeDetail();
    mockIsPremium = true;
    await renderScreen();

    await user.press(screen.getByRole('button', { name: 'Nächster Schritt' }));
    expect(screen.getByText('SCHRITT 2 VON 2')).toBeOnTheScreen();

    await user.press(screen.getByRole('button', { name: 'Vorheriger Schritt' }));

    expect(screen.getByText('SCHRITT 1 VON 2')).toBeOnTheScreen();
  });

  it('schließt Rezepte ohne Einzelschritte ab und kehrt zur Anleitung zurück', async () => {
    const user = userEvent.setup();
    const detail = makeDetail();
    detail.recipe.instructions = null;
    detail.steps = [];
    mockDetail = detail;
    mockIsPremium = true;
    await renderScreen();

    expect(
      screen.getByText('Für dieses Rezept sind noch keine Schritte hinterlegt.'),
    ).toBeOnTheScreen();
    await user.press(screen.getByRole('button', { name: 'Zubereitung abschließen' }));
    expect(await screen.findByText('Guten Appetit!')).toBeOnTheScreen();

    await user.press(screen.getByRole('button', { name: 'Zurück zum letzten Schritt' }));

    expect(
      screen.getByText('Für dieses Rezept sind noch keine Schritte hinterlegt.'),
    ).toBeOnTheScreen();
  });
});
