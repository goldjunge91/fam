import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { FoodSearchScreen } from '@/features/calorie-tracking/food-search-screen';

const mockUseFoodHistory = jest.fn();
const mockSearchOpenFoodFacts = jest.fn();

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

jest.mock('@/features/calorie-tracking/api', () => ({
  useFoodHistory: (...args: unknown[]) => mockUseFoodHistory(...args),
}));

jest.mock('@/lib/open-food-facts', () => {
  const actual = jest.requireActual('@/lib/open-food-facts');
  return {
    ...actual,
    searchOpenFoodFacts: (...args: unknown[]) => mockSearchOpenFoodFacts(...args),
  };
});

// Kamera-Abhaengigkeit ausserhalb des Tests halten — der Scanner selbst hat
// keine eigene Logik in diesem Screen, nur der Ergebnis-Callback zaehlt.
jest.mock('@/features/inventory/barcode-scanner-modal', () => ({
  BarcodeScannerModal: () => null,
}));

jest.mock('@/hooks/use-theme', () => ({
  useTheme: () => ({
    background: '#FFFFFF',
    backgroundElement: '#F0F0F3',
    backgroundSelected: '#E0E1E6',
    text: '#000000',
    textSecondary: '#60646C',
    border: '#DDDDE3',
    accent: '#208AEF',
    success: '#1A7F4B',
    warning: '#B26A00',
    danger: '#C62828',
  }),
}));

function renderScreen() {
  return render(
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 390, height: 844 },
        insets: { top: 47, left: 0, right: 0, bottom: 34 },
      }}>
      <FoodSearchScreen />
    </SafeAreaProvider>,
  );
}

beforeEach(() => {
  mockUseFoodHistory.mockReset();
  mockUseFoodHistory.mockReturnValue({
    data: [
      {
        name: 'Apfel',
        kcal: 52,
        protein_g: 0.3,
        carbs_g: 14,
        fat_g: 0.2,
        quantity: 100,
        unit: 'g',
      },
      {
        name: 'Banane',
        kcal: 89,
        protein_g: 1.1,
        carbs_g: 23,
        fat_g: 0.3,
        quantity: 100,
        unit: 'g',
      },
      {
        name: 'Apfel',
        kcal: 52,
        protein_g: 0.3,
        carbs_g: 14,
        fat_g: 0.2,
        quantity: 100,
        unit: 'g',
      },
    ],
    isLoading: false,
  });
  mockSearchOpenFoodFacts.mockReset();
  mockSearchOpenFoodFacts.mockResolvedValue([
    { barcode: '123', name: 'Hafermilch', brand: 'Oatly', caloriesPer100g: 59 },
  ]);
  (router.push as jest.Mock).mockClear();
});

describe('FoodSearchScreen', () => {
  it('zeigt zuletzt geloggte Lebensmittel dedupliziert, wenn die Suche leer ist', async () => {
    await renderScreen();
    expect(screen.getAllByText('Apfel')).toHaveLength(1);
    expect(screen.getByText('Banane')).toBeTruthy();
  });

  it('wechselt zu "Haeufig" und zeigt Apfel (2x geloggt) zuerst', async () => {
    await renderScreen();
    await fireEvent.press(screen.getByText('Häufig'));
    const names = screen.getAllByText(/Apfel|Banane/).map((node) => node.props.children);
    expect(names[0]).toBe('Apfel');
  });

  it('sucht bei Eingabe live und navigiert bei Auswahl zur Erfassung', async () => {
    await renderScreen();
    fireEvent.changeText(screen.getByPlaceholderText('Wonach suchst du?'), 'Hafermilch');

    await waitFor(() => expect(screen.getByText('Hafermilch')).toBeTruthy());
    await fireEvent.press(screen.getByText('Hafermilch'));

    expect(router.push).toHaveBeenCalledWith(
      expect.objectContaining({
        pathname: '/add-food-entry',
        params: expect.objectContaining({
          date: '2026-08-10',
          mealType: 'breakfast',
          name: 'Hafermilch',
          brand: 'Oatly',
          kcalPer100g: '59',
        }),
      }),
    );
  });

  it('"Schneller Eintrag" navigiert ohne Produktdaten zur Erfassung', async () => {
    await renderScreen();
    await fireEvent.press(screen.getByText('Schneller Eintrag'));

    expect(router.push).toHaveBeenCalledWith({
      pathname: '/add-food-entry',
      params: { date: '2026-08-10', mealType: 'breakfast' },
    });
  });

  it('navigiert bei Auswahl eines "Zuletzt"-Eintrags mit den Snapshot-Werten', async () => {
    await renderScreen();
    await fireEvent.press(screen.getByText('Banane'));

    expect(router.push).toHaveBeenCalledWith(
      expect.objectContaining({
        pathname: '/add-food-entry',
        params: expect.objectContaining({ name: 'Banane', kcal: '89', quantity: '100', unit: 'g' }),
      }),
    );
  });
});
