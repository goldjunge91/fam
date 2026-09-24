import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, userEvent } from '@testing-library/react-native';
import { router } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AddFoodEntryScreen } from '@/features/calorie-tracking/add-food-entry-screen';

let mockParams: Record<string, string> = {};
let mockFoodEntries: unknown[] = [];

const mockAddMutateAsync = jest.fn().mockResolvedValue({});
const mockUpdateMutateAsync = jest.fn().mockResolvedValue({});
const mockDeleteMutateAsync = jest.fn().mockResolvedValue({});
const mockRestoreMutate = jest.fn();
const mockShowUndoSnackbar = jest.fn();

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), canGoBack: () => false },
  useLocalSearchParams: () => mockParams,
  useNavigation: () => ({ canGoBack: () => false, addListener: () => () => {} }),
}));

jest.mock('@/features/auth/session-provider', () => ({
  useSession: () => ({ session: { user: { id: 'user-1' } } }),
}));

jest.mock('@/features/calorie-tracking/api', () => ({
  useFoodEntries: () => ({ data: mockFoodEntries, isLoading: false }),
  useAddFoodEntryMutation: () => ({ mutateAsync: mockAddMutateAsync, isPending: false }),
  useUpdateFoodEntryMutation: () => ({ mutateAsync: mockUpdateMutateAsync, isPending: false }),
  useDeleteFoodEntryMutation: () => ({ mutateAsync: mockDeleteMutateAsync, isPending: false }),
  useRestoreFoodEntryMutation: () => ({ mutate: mockRestoreMutate, isPending: false }),
}));

jest.mock('@/features/calorie-tracking/food-search-dropdown', () => ({
  FoodSearchDropdown: () => null,
}));

jest.mock('@/lib/db/local-client', () => ({
  getDatabase: async () => ({}),
}));

jest.mock('@/lib/db/product-usage', () => ({
  recordProductUsage: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/components/ui/snackbar', () => ({
  useSnackbar: () => ({ showUndoSnackbar: mockShowUndoSnackbar }),
}));

jest.mock('@/features/household/active-household-provider', () => ({
  useActiveHousehold: () => ({ activeHousehold: { id: 'hh-1', name: 'Zuhause' } }),
}));

jest.mock('@expo/ui/community/picker', () => {
  const React = require('react');
  const { Pressable, Text, View } = require('react-native');

  type MockPickerItemProps = { label: string; value: string };
  type MockPickerProps = {
    children?: React.ReactNode;
    onValueChange?: (value: string) => void;
  };

  const Picker = Object.assign(
    ({ children, onValueChange }: MockPickerProps) =>
      React.createElement(
        View,
        null,
        React.Children.toArray(children).map((child: React.ReactNode) => {
          if (!React.isValidElement(child)) return null;
          const item = child as { props: MockPickerItemProps };
          return React.createElement(
            Pressable,
            {
              key: item.props.value,
              accessibilityRole: 'button',
              accessibilityLabel: item.props.label,
              onPress: () => onValueChange?.(item.props.value),
            },
            React.createElement(Text, null, item.props.label),
          );
        }),
      ),
    { Item: (_props: MockPickerItemProps) => null },
  );

  return { Picker };
});

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
        <AddFoodEntryScreen />
      </SafeAreaProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  mockParams = {};
  mockFoodEntries = [];
  mockAddMutateAsync.mockClear();
  mockUpdateMutateAsync.mockClear();
  mockDeleteMutateAsync.mockClear();
  mockRestoreMutate.mockClear();
  mockShowUndoSnackbar.mockClear();
});

describe('AddFoodEntryScreen — Produkt aus der Suche (100g-Referenz)', () => {
  beforeEach(() => {
    mockParams = {
      date: '2026-08-10',
      mealType: 'breakfast',
      productData: JSON.stringify({
        name: 'Hafermilch Barista',
        brand: 'Oatly',
        kcalPer100g: '59',
        proteinPer100g: '1.1',
        carbsPer100g: '6.6',
        fatPer100g: '3',
        nutrientLevels: JSON.stringify({ fat: 'low', sugars: 'high' }),
      }),
    };
  });

  it('befuellt Name, Marke und die 100g-Werte bei Menge 100', async () => {
    await renderScreen();
    expect(screen.queryByPlaceholderText('Name des Lebensmittels')).toBeNull();
    expect(screen.getByText('Oatly')).toBeTruthy();
    expect(screen.getByDisplayValue('59')).toBeTruthy();
    expect(screen.getByDisplayValue('6.6')).toBeTruthy();
    expect(screen.getByDisplayValue('1.1')).toBeTruthy();
    expect(screen.getByDisplayValue('3')).toBeTruthy();
  });

  it('schließt den Modal-Screen über den X-Button', async () => {
    const user = userEvent.setup();
    await renderScreen();

    expect(screen.queryByText('Abbrechen')).not.toBeOnTheScreen();
    await user.press(screen.getByRole('button', { name: 'Schließen' }));

    expect(router.back).toHaveBeenCalled();
  });

  it('zeigt aus nutrient_levels abgeleitete Bewertungs-Badges', async () => {
    await renderScreen();
    expect(screen.getByText(/Fettarm/)).toBeTruthy();
    expect(screen.getByText(/Viel Zucker/)).toBeTruthy();
  });

  it('skaliert kcal live, wenn die Menge geaendert wird', async () => {
    await renderScreen();
    await fireEvent.press(screen.getByLabelText('Menge direkt eingeben'));
    const quantityField = screen.getByLabelText('Menge eingeben');
    await fireEvent.changeText(quantityField, '200');
    await fireEvent(quantityField, 'blur');
    expect(screen.getByDisplayValue('118')).toBeTruthy(); // 59 kcal/100g * 200g / 100
  });

  it('zeigt einen Hinweis statt stiller Skalierung bei stueckbasierten Einheiten', async () => {
    const user = userEvent.setup();
    await renderScreen();
    await user.press(screen.getByRole('button', { name: 'Einheit auswählen' }));
    await user.press(screen.getByRole('button', { name: 'Stück' }));
    await user.press(screen.getByRole('button', { name: 'Übernehmen' }));
    expect(
      screen.getByText(/Automatische Umrechnung für diese Einheit nicht möglich/),
    ).toBeTruthy();
    expect(screen.getByDisplayValue('59')).toBeTruthy(); // Rohwert bleibt unveraendert stehen
  });

  it('ordnet die Einheit als Dropdown direkt neben der Menge an', async () => {
    const user = userEvent.setup();
    await renderScreen();

    const unitSelect = screen.getByRole('button', { name: 'Einheit auswählen' });
    expect(unitSelect).toHaveTextContent(/g/);
    expect(screen.getByText('Menge')).toBeOnTheScreen();

    await user.press(unitSelect);

    expect(screen.getByRole('button', { name: 'g' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'kg' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Stück' })).toBeOnTheScreen();
  });

  it('speichert einen neuen Eintrag mit den berechneten Werten', async () => {
    await renderScreen();
    await fireEvent.press(screen.getByText('Speichern'));

    expect(mockAddMutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        loggedOn: '2026-08-10',
        mealType: 'breakfast',
        name: 'Hafermilch Barista',
        quantity: 100,
        unit: 'g',
        kcal: 59,
      }),
    );
    expect(router.back).toHaveBeenCalled();
  });
});

describe('AddFoodEntryScreen — Schneller Eintrag (ohne Produktdaten)', () => {
  beforeEach(() => {
    mockParams = { date: '2026-08-10', mealType: 'lunch' };
  });

  it('startet mit einem leeren Formular', async () => {
    await renderScreen();
    expect(screen.queryByPlaceholderText('Name des Lebensmittels')).toBeNull();
  });
});

describe('AddFoodEntryScreen — bestehenden Eintrag bearbeiten', () => {
  beforeEach(() => {
    mockParams = { date: '2026-08-10', mealType: 'dinner', entryId: 'entry-1' };
    mockFoodEntries = [
      {
        id: 'entry-1',
        name: 'Reis',
        quantity: 150,
        unit: 'g',
        kcal: 195,
        protein_g: 4,
        carbs_g: 43,
        fat_g: 0.5,
        meal_type: 'dinner',
      },
    ];
  });

  it('befuellt das Formular aus dem bestehenden Eintrag', async () => {
    await renderScreen();
    expect(screen.getByText('Reis')).toBeTruthy();
    expect(screen.getByDisplayValue('195')).toBeTruthy();
    expect(screen.getByText('Löschen')).toBeTruthy();
  });

  it('loescht sofort ohne Bestaetigungsdialog und zeigt eine Undo-Snackbar (#86)', async () => {
    await renderScreen();
    await fireEvent.press(screen.getByText('Löschen'));

    expect(mockDeleteMutateAsync).toHaveBeenCalledWith({
      id: 'entry-1',
      userId: 'user-1',
      loggedOn: '2026-08-10',
    });
    expect(router.back).toHaveBeenCalled();
    expect(mockShowUndoSnackbar).toHaveBeenCalledWith(
      expect.objectContaining({ message: '"Reis" gelöscht', onUndo: expect.any(Function) }),
    );

    const { onUndo } = mockShowUndoSnackbar.mock.calls[0][0];
    onUndo();
    expect(mockRestoreMutate).toHaveBeenCalledWith({
      id: 'entry-1',
      userId: 'user-1',
      loggedOn: '2026-08-10',
    });
  });
});
