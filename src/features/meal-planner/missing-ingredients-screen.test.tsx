import { render, screen, userEvent } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { MissingIngredientsScreen } from './missing-ingredients-screen';

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
  router: { push: jest.fn(), back: jest.fn(), canGoBack: () => true },
  useLocalSearchParams: () => ({ mealPlanId: 'plan-1' }),
  useNavigation: () => mockNavigation,
}));

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
    missingGrams: 300,
    preferredStoreId: 'store-1',
    preferredStoreName: 'Aldi',
    recipeNames: ['Bolognese'],
  },
  {
    productId: 'p2',
    name: 'Hackfleisch',
    missingGrams: 500,
    preferredStoreId: null,
    preferredStoreName: null,
    recipeNames: [],
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
