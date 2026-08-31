import { render, screen, userEvent } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { MissingIngredientsScreen } from './missing-ingredients-screen';

const mockRouterBack = jest.fn();

const mockAddMutateAsync = jest.fn().mockResolvedValue(undefined);
const mockResolveCategoryForItem = jest.fn().mockResolvedValue({
  categoryId: null,
  source: null,
  classifierVersion: '1',
});

// Stabile Objektidentitaet noetig: `AutoBackButton` (Screen) haengt seinen
// Effekt an `[navigation]` - ein bei jedem Aufruf neu erzeugtes Objekt
// (z. B. `() => ({...})`) triggert den Effekt jedes Mal erneut und damit
// eine Endlosschleife aus setState-Aufrufen.
const mockNavigation = { canGoBack: () => true, addListener: () => () => {} };

jest.mock('expo-router', () => ({
  router: {
    push: jest.fn(),
    back: (...args: unknown[]) => mockRouterBack(...args),
    canGoBack: () => true,
  },
  useLocalSearchParams: () => ({ mealPlanId: 'plan-1' }),
  useNavigation: () => mockNavigation,
}));

// RowStorePicker haengt an useStores() (React Query) — hier durch einen
// minimalen Stub ersetzt, der storeId als Text zeigt und bei Druck fest
// 'store-override' waehlt. Das eigene Verhalten von RowStorePicker ist
// bereits in row-store-picker.test.tsx abgedeckt (siehe #335).
jest.mock('@/features/shopping-list/components/ui/row-store-picker', () => {
  const { Pressable, Text } = require('react-native');
  return {
    RowStorePicker: ({
      storeId,
      onChange,
      testID,
    }: {
      storeId: string | null;
      onChange: (next: string | null) => void;
      testID?: string;
    }) => (
      <Pressable
        testID={testID}
        accessibilityRole="button"
        onPress={() => onChange('store-override')}>
        <Text>{storeId ?? 'Ohne Markt'}</Text>
      </Pressable>
    ),
  };
});

jest.mock('@/features/auth/session-provider', () => ({
  useSession: () => ({ session: { user: { id: 'user-1' } } }),
}));

jest.mock('@/features/household/active-household-provider', () => ({
  useActiveHousehold: () => ({ activeHouseholdId: 'hh-1' }),
  useOptionalActiveHousehold: () => ({ activeHouseholdId: 'hh-1' }),
}));

jest.mock('@/features/shopping-list/hooks/use-shopping-list-mutations', () => ({
  useAddShoppingItem: () => ({ mutateAsync: mockAddMutateAsync, isPending: false }),
}));

jest.mock('@/features/shopping-list/preferences/api', () => ({
  resolveCategoryForItem: (...args: unknown[]) => mockResolveCategoryForItem(...args),
}));

let mockIsPremium = true;

jest.mock('@/features/premium/premium-provider', () => ({
  usePremium: () => ({ isPremium: mockIsPremium }),
}));

const mockPresentPaywallIfNeeded = jest.fn();
jest.mock('@/features/premium/paywall', () => ({
  presentPaywallIfNeeded: () => mockPresentPaywallIfNeeded(),
}));

// Modulweite Konstante statt Array-Literal im Mock: die Screen-Komponente
// haengt einen Effekt an `missing` (praeselektiert alle Artikel). Ein bei
// jedem Render neu erzeugtes Array-Literal aendert die Referenz staendig und
// erzeugt dieselbe Endlosschleife wie eine instabile `useNavigation()`.
const mockMissingIngredients = [
  {
    productId: 'p1',
    name: 'Tomaten',
    neededGrams: 400,
    availableGrams: 100,
    missingGrams: 300,
    preferredStoreId: 'store-1',
    preferredStoreName: 'Aldi',
    recipeNames: ['Bolognese'],
  },
  {
    productId: 'p2',
    name: 'Hackfleisch',
    neededGrams: 500,
    availableGrams: 0,
    missingGrams: 500,
    preferredStoreId: null,
    preferredStoreName: null,
    recipeNames: [],
  },
  {
    productId: 'p3',
    name: 'Salz',
    neededGrams: 50,
    availableGrams: 50,
    missingGrams: 0,
    preferredStoreId: null,
    preferredStoreName: null,
    recipeNames: ['Bolognese'],
  },
];

jest.mock('./use-shopping-needs', () => ({
  useMealPlanShoppingNeeds: () => ({
    data: mockMissingIngredients,
    isLoading: false,
  }),
}));

function renderScreen() {
  return render(
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 390, height: 844 },
        insets: { top: 47, left: 0, right: 0, bottom: 34 },
      }}>
      <MissingIngredientsScreen />
    </SafeAreaProvider>,
  );
}

beforeEach(() => {
  mockAddMutateAsync.mockClear();
  mockResolveCategoryForItem.mockClear();
  mockPresentPaywallIfNeeded.mockClear();
  mockRouterBack.mockClear();
  mockIsPremium = true;
});

describe('MissingIngredientsScreen', () => {
  it('zeigt fehlende Zutaten mit Menge und History-Praeferenz', async () => {
    await renderScreen();

    expect(screen.getByText('Tomaten')).toBeOnTheScreen();
    expect(screen.getByText(/300 g fehlen/)).toBeOnTheScreen();
    expect(screen.getByText(/zuletzt bei Aldi/)).toBeOnTheScreen();
    expect(screen.getByText('Hackfleisch')).toBeOnTheScreen();
  });

  it('zeigt bereits gedeckte Zutaten mit "benötigt / Vorrat" statt "g fehlen"', async () => {
    // Nachschub-Fall (#131-Nachschaerfung): Salz ist voll gedeckt
    // (neededGrams === availableGrams), bleibt aber sichtbar.
    await renderScreen();

    expect(screen.getByText('Salz')).toBeOnTheScreen();
    expect(screen.getByText(/50 g benötigt \/ 50 g im Vorrat/)).toBeOnTheScreen();
  });

  it('waehlt nur Artikel mit echtem Fehlbetrag vor, gedeckte Artikel bleiben abgewaehlt', async () => {
    await renderScreen();

    // 2 von 3 Artikeln (Tomaten, Hackfleisch) haben missingGrams > 0 und
    // sind vorausgewaehlt; Salz (gedeckt) ist es nicht.
    expect(screen.getByText('2 Artikel zur Einkaufsliste hinzufügen')).toBeOnTheScreen();
    expect(screen.getByRole('checkbox', { name: 'Salz' })).not.toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Tomaten' })).toBeChecked();
  });

  it('Auswahl eines gedeckten Artikels uebertraegt die volle benoetigte Menge', async () => {
    const user = userEvent.setup();
    await renderScreen();

    await user.press(screen.getByRole('checkbox', { name: 'Salz' }));
    await user.press(screen.getByText('3 Artikel zur Einkaufsliste hinzufügen'));

    expect(mockAddMutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Salz', quantity: 50, unit: 'g' }),
    );
  });

  it('Markt-Override einer Zeile wird beim Uebertrag statt der Kaufhistorie verwendet', async () => {
    const user = userEvent.setup();
    await renderScreen();

    // Hackfleisch hat keine Kaufhistorie (preferredStoreId: null) — Nutzer
    // weist ihm im Markt-Picker manuell einen Markt zu.
    await user.press(screen.getByTestId('row-store-picker-p2'));
    await user.press(screen.getByText('2 Artikel zur Einkaufsliste hinzufügen'));

    expect(mockAddMutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Hackfleisch', store_id: 'store-override' }),
    );
  });

  it('Bulk-Markt-Auswahl weist allen Artikeln denselben Markt zu', async () => {
    const user = userEvent.setup();
    await renderScreen();

    // Tomaten hatte ueber die Kaufhistorie bereits 'store-1' zugewiesen —
    // der Bulk-Picker ueberschreibt das fuer alle Artikel einheitlich.
    await user.press(screen.getByTestId('bulk-store-picker'));
    await user.press(screen.getByText('2 Artikel zur Einkaufsliste hinzufügen'));

    expect(mockAddMutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Tomaten', store_id: 'store-override' }),
    );
    expect(mockAddMutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Hackfleisch', store_id: 'store-override' }),
    );
  });

  it('navigiert nach erfolgreichem Uebertrag automatisch zurueck', async () => {
    const user = userEvent.setup();
    await renderScreen();

    await user.press(screen.getByText('2 Artikel zur Einkaufsliste hinzufügen'));

    expect(mockRouterBack).toHaveBeenCalledTimes(1);
  });

  it('ist standardmaessig alles vorausgewaehlt und uebernimmt beim Bestaetigen', async () => {
    const user = userEvent.setup();
    mockResolveCategoryForItem.mockResolvedValueOnce({
      categoryId: 'produce',
      source: 'off_taxonomy',
      classifierVersion: '1',
    });
    await renderScreen();

    expect(screen.getByText('2 Artikel zur Einkaufsliste hinzufügen')).toBeOnTheScreen();

    await user.press(screen.getByText('2 Artikel zur Einkaufsliste hinzufügen'));

    // Alle Erzeugungswege nutzen den Resolver (#223 Abschnitt 10).
    expect(mockResolveCategoryForItem).toHaveBeenCalledWith(
      expect.objectContaining({ householdId: 'hh-1', productId: 'p1', name: 'Tomaten' }),
    );
    expect(mockAddMutateAsync).toHaveBeenCalledTimes(2);
    expect(mockAddMutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Tomaten',
        quantity: 300,
        unit: 'g',
        store_id: 'store-1',
        category_id: 'produce',
        category_source: 'off_taxonomy',
      }),
    );
    expect(mockAddMutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Hackfleisch', quantity: 500, unit: 'g', store_id: null }),
    );
  });

  it('Abwaehlen eines Artikels nimmt ihn aus der Uebernahme heraus', async () => {
    const user = userEvent.setup();
    await renderScreen();

    await user.press(screen.getByRole('checkbox', { name: 'Hackfleisch' }));
    await user.press(screen.getByText('1 Artikel zur Einkaufsliste hinzufügen'));

    expect(mockAddMutateAsync).toHaveBeenCalledTimes(1);
    expect(mockAddMutateAsync).toHaveBeenCalledWith(expect.objectContaining({ name: 'Tomaten' }));
  });

  it('zeigt ohne Premium einen Paywall-Hinweis statt der Zutatenliste', async () => {
    const user = userEvent.setup();
    mockIsPremium = false;
    mockPresentPaywallIfNeeded.mockResolvedValue('purchased');

    await renderScreen();

    expect(screen.queryByText('Tomaten')).not.toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Premium ansehen' })).toBeOnTheScreen();

    await user.press(screen.getByRole('button', { name: 'Premium ansehen' }));

    expect(mockPresentPaywallIfNeeded).toHaveBeenCalledTimes(1);
  });
});
