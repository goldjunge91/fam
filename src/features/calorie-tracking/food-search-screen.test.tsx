import { fireEvent, render, screen, userEvent } from '@testing-library/react-native';
import { router } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { FoodSearchScreen } from '@/features/calorie-tracking/food-search-screen';

const mockUseLocalFoodUsage = jest.fn();
const mockCatalogSearch = jest.fn();
const mockCatalogFindByBarcode = jest.fn();

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), canGoBack: () => false },
  useLocalSearchParams: () => ({ date: '2026-08-10', mealType: 'breakfast' }),
  useNavigation: () => ({
    canGoBack: () => false,
    addListener: () => () => {},
  }),
}));

jest.mock('@/features/auth/session-provider', () => ({
  useSession: () => ({ session: { user: { id: 'user-1' } } }),
}));

jest.mock('@/features/calorie-tracking/use-local-food-usage', () => ({
  useLocalFoodUsage: (...args: unknown[]) => mockUseLocalFoodUsage(...args),
}));

jest.mock('@/features/product-search/preferred-market', () => ({
  usePreferredProductMarketName: () => null,
}));

jest.mock('@/features/household/active-household-provider', () => ({
  useOptionalActiveHousehold: () => null,
}));

// Der Screen kennt nur den Product Catalog. Welche Quelle einen Treffer
// liefert, ist am Katalog-Seam getestet (product-catalog.test.ts).
jest.mock('@/features/product-search/product-catalog-instance', () => ({
  productCatalog: {
    search: (...args: unknown[]) => mockCatalogSearch(...args),
    findByBarcode: (...args: unknown[]) => mockCatalogFindByBarcode(...args),
  },
}));

// Kamera-Abhaengigkeit ausserhalb des Tests halten — der Scanner selbst hat
// keine eigene Logik in diesem Screen, nur der Ergebnis-Callback zaehlt.
jest.mock('@/features/inventory/barcode-scanner-modal', () => ({
  BarcodeScannerModal: () => null,
}));

jest.mock('@/hooks/use-theme', () => ({
  useTheme: () => require('@/components/theme/index').Colors.light,
}));

async function renderScreen() {
  await render(
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 390, height: 844 },
        insets: { top: 47, left: 0, right: 0, bottom: 34 },
      }}>
      <FoodSearchScreen />
    </SafeAreaProvider>,
  );

  // Synchronize with the first actual list result. This also lets RNTL
  // flush VirtualizedList's deferred cell update without timing assumptions.
  await screen.findByText('Apfel');
}

beforeEach(() => {
  mockUseLocalFoodUsage.mockReset();
  mockUseLocalFoodUsage.mockReturnValue({
    data: [
      {
        name: 'Apfel',
        kcal: 52,
        proteinG: 0.3,
        carbsG: 14,
        fatG: 0.2,
        quantity: 100,
        unit: 'g',
      },
      {
        name: 'Banane',
        kcal: 89,
        proteinG: 1.1,
        carbsG: 23,
        fatG: 0.3,
        quantity: 100,
        unit: 'g',
      },
      {
        name: 'Apfel',
        kcal: 52,
        proteinG: 0.3,
        carbsG: 14,
        fatG: 0.2,
        quantity: 100,
        unit: 'g',
      },
    ],
    isLoading: false,
  });
  mockCatalogSearch.mockReset();
  mockCatalogSearch.mockResolvedValue({
    products: [
      {
        barcode: '123',
        name: 'Hafermilch',
        brand: 'Oatly',
        caloriesPer100g: 59,
        proteinsPer100g: 1.1,
        carbsPer100g: 6.6,
        fatPer100g: 3,
        categoryTags: [],
      },
    ],
    hasMore: false,
    failed: false,
  });
  mockCatalogFindByBarcode.mockReset();
  mockCatalogFindByBarcode.mockResolvedValue(null);
  (router.push as jest.Mock).mockClear();
});

describe('FoodSearchScreen', () => {
  it('zeigt zuletzt geloggte Lebensmittel dedupliziert, wenn die Suche leer ist', async () => {
    await renderScreen();
    expect(screen.getAllByText('Apfel')).toHaveLength(1);
    expect(screen.getByText('Banane')).toBeTruthy();
  });

  it('wechselt zu "Haeufig" und zeigt Apfel (2x geloggt) zuerst', async () => {
    const user = userEvent.setup();
    await renderScreen();
    await user.press(screen.getByLabelText('Verlaufsfilter'));
    await user.press(screen.getByText(/Häufig/));
    const names = screen.getAllByText(/Apfel|Banane/).map((node) => node.props.children);
    expect(names[0]).toBe('Apfel');
  });

  it('sucht bei Eingabe live und navigiert bei Auswahl zur Erfassung', async () => {
    // Debounce ist ein echtes setTimeout (800ms, siehe food-search-screen.tsx)
    // ausserhalb jeder von RNTL verfolgten act()-Grenze. Mit echten Timern
    // + waitFor lief das als Wettlauf gegen die Wanduhr — act()-Warnungen
    // inklusive, sobald die Maschine unter Last war. Fake-Timer + gezieltes
    // Vorspulen macht daraus einen deterministischen Schritt.
    // `userEvent` waere hier die RNTL-Empfehlung, aber schon `userEvent.setup()`
    // aufzurufen — nicht erst `.type()` — bringt das eigene Fake-Timer-Tracking
    // mit unserem manuellen `advanceTimersByTimeAsync(800)` durcheinander: der
    // Debounce feuert dann ueber einen rohen sinonjs-Immediate-Callback
    // ausserhalb von act(), mit genau den act()-Warnungen, die dieser Test
    // eigentlich vermeiden soll (empirisch geprueft). Deshalb hier bewusst
    // durchgehend `fireEvent`, wie es die eigene RNTL-Regel fuer diesen Fall
    // vorsieht ("wenn User Event nicht passt, fireEvent nutzen").
    await renderScreen();
    jest.useFakeTimers();
    // Bewusst NICHT await: await fireEvent.changeText() hier bringt das
    // nachfolgende advanceTimersByTimeAsync(800) durcheinander, sodass der
    // Debounce-Timer der Komponente nie feuert (empirisch geprueft — mit
    // await bleibt der Screen bei "Keine Treffer" haengen).
    fireEvent.changeText(screen.getByPlaceholderText('Wonach suchst du?'), 'Hafermilch');
    await jest.advanceTimersByTimeAsync(800);

    expect(screen.getByText('Hafermilch')).toBeTruthy();
    expect(mockCatalogSearch).toHaveBeenCalledWith(
      'Hafermilch',
      expect.objectContaining({ limit: 20 }),
    );

    await fireEvent.press(screen.getByText('Hafermilch'));

    const pushCall = (router.push as jest.Mock).mock.calls[0][0];
    const productParams = JSON.parse(pushCall.params.productData);
    expect(pushCall).toEqual(
      expect.objectContaining({
        pathname: '/add-food-entry',
        params: expect.objectContaining({ date: '2026-08-10', mealType: 'breakfast' }),
      }),
    );
    expect(productParams).toEqual(
      expect.objectContaining({
        name: 'Hafermilch',
        brand: 'Oatly',
        kcalPer100g: '59',
        proteinPer100g: '1.1',
        carbsPer100g: '6.6',
        fatPer100g: '3',
      }),
    );

    jest.useRealTimers();
  });

  it('erkennt eine abgetippte Zahlenfolge als Barcode und nutzt den exakten Lookup', async () => {
    mockCatalogSearch.mockResolvedValue({
      products: [
        {
          barcode: '4019300005307',
          name: 'Balance Reich an Protein',
          brand: 'Exquisa',
          caloriesPer100g: 91,
          categoryTags: [],
        },
      ],
      hasMore: false,
      failed: false,
    });

    // fireEvent statt userEvent hier bewusst — siehe Kommentar beim ersten
    // Debounce-Test oben.
    await renderScreen();
    jest.useFakeTimers();
    // Bewusst NICHT await — siehe Kommentar beim ersten Debounce-Test oben.
    fireEvent.changeText(screen.getByPlaceholderText('Wonach suchst du?'), '4019300005307');
    await jest.advanceTimersByTimeAsync(800);

    expect(screen.getByText('Balance Reich an Protein')).toBeTruthy();
    expect(mockCatalogSearch).toHaveBeenCalledWith('4019300005307', expect.anything());

    await fireEvent.press(screen.getByText('Balance Reich an Protein'));
    const pushCall = (router.push as jest.Mock).mock.calls[0][0];
    expect(pushCall).toEqual(expect.objectContaining({ pathname: '/add-food-entry' }));
    expect(JSON.parse(pushCall.params.productData)).toEqual(
      expect.objectContaining({ name: 'Balance Reich an Protein', brand: 'Exquisa' }),
    );

    jest.useRealTimers();
  });

  it('zeigt bei einem fehlgeschlagenen Request einen Hinweis statt "keine Treffer" und erlaubt Retry', async () => {
    mockCatalogSearch.mockResolvedValue({ products: [], hasMore: false, failed: true });

    // fireEvent statt userEvent hier bewusst — siehe Kommentar beim ersten
    // Debounce-Test oben.
    await renderScreen();
    jest.useFakeTimers();
    // Bewusst NICHT await — siehe Kommentar beim ersten Debounce-Test oben.
    fireEvent.changeText(screen.getByPlaceholderText('Wonach suchst du?'), 'hafer');
    await jest.advanceTimersByTimeAsync(800);

    expect(screen.getByText(/Open Food Facts ist gerade nicht erreichbar/)).toBeTruthy();
    expect(screen.queryByText(/Keine Treffer/)).toBeNull();

    mockCatalogSearch.mockResolvedValue({
      products: [{ barcode: '123', name: 'Haferflocken', caloriesPer100g: 380, categoryTags: [] }],
      hasMore: false,
      failed: false,
    });
    await fireEvent.press(screen.getByText('Erneut versuchen'));

    expect(screen.getByText('Haferflocken')).toBeTruthy();

    jest.useRealTimers();
  });

  it('"Schneller Eintrag" navigiert ohne Produktdaten zur Erfassung', async () => {
    const user = userEvent.setup();
    await renderScreen();
    await user.press(screen.getByText('Schneller Eintrag'));

    expect(router.push).toHaveBeenCalledWith({
      pathname: '/add-food-entry',
      params: { date: '2026-08-10', mealType: 'breakfast' },
    });
  });

  it('navigiert bei Auswahl eines "Zuletzt"-Eintrags mit den Snapshot-Werten', async () => {
    const user = userEvent.setup();
    await renderScreen();
    await user.press(screen.getByText('Banane'));

    expect(router.push).toHaveBeenCalledWith(
      expect.objectContaining({
        pathname: '/add-food-entry',
        params: expect.objectContaining({ name: 'Banane', kcal: '89', quantity: '100', unit: 'g' }),
      }),
    );
  });
});
