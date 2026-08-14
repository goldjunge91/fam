import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, userEvent } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { FridgeScreen } from '@/features/fridge/fridge-screen';

const mockUpdateQtyMutate = jest.fn();
const mockUpdateItemMutateAsync = jest.fn().mockResolvedValue({});

let mockItems: unknown[] = [];
let mockParams: Record<string, string> = {};

jest.mock('react-native-gesture-handler/ReanimatedSwipeable', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: ({ children, renderRightActions }: Record<string, unknown>) =>
      React.createElement(
        View,
        null,
        children,
        typeof renderRightActions === 'function'
          ? renderRightActions(
              { value: 0 },
              { value: 0 },
              { close: jest.fn(), openLeft: jest.fn(), openRight: jest.fn(), reset: jest.fn() },
            )
          : null,
      ),
  };
});

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), canGoBack: () => false },
  useNavigation: () => ({ canGoBack: () => false, addListener: () => () => {} }),
  useLocalSearchParams: () => mockParams,
}));

jest.mock('@/features/household/active-household-provider', () => ({
  useActiveHousehold: () => ({ activeHouseholdId: 'hh-1' }),
}));

jest.mock('@/features/inventory/use-storage-locations', () => ({
  useStorageLocations: () => ({ data: [] }),
}));

jest.mock('@/features/fridge/use-fridge-items', () => ({
  useFridgeItems: () => ({ data: mockItems, isLoading: false }),
}));

jest.mock('@/features/fridge/use-fridge-mutations', () => ({
  useUpdateFridgeItemQuantityMutation: () => ({ mutate: mockUpdateQtyMutate, isPending: false }),
  useUpdateFridgeItemMutation: () => ({
    mutateAsync: mockUpdateItemMutateAsync,
    isPending: false,
  }),
}));

jest.mock('@/features/inventory/use-product', () => ({
  useProduct: () => ({ data: null, isLoading: false }),
}));

jest.mock('@/features/navigation/navigation-chrome-provider', () => ({
  useNavigationChrome: () => ({ openDrawer: jest.fn(), openProfile: jest.fn() }),
}));

jest.mock('@/features/navigation/use-profile-initials', () => ({
  useProfileInitials: () => 'MM',
}));

jest.mock('@/hooks/use-theme', () => ({
  useTheme: () => require('@/constants/theme').Colors.light,
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
        <FridgeScreen />
      </SafeAreaProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  mockParams = {};
  mockItems = [
    {
      id: 'item-1',
      household_id: 'hh-1',
      location_id: null,
      product_id: null,
      name: 'Milch',
      quantity: 2,
      unit: 'l',
      expiry_date: null,
      added_by: null,
      created_at: '',
      location_kind: null,
      location_name: null,
    },
  ];
  mockUpdateQtyMutate.mockClear();
  mockUpdateItemMutateAsync.mockClear();
});

it('öffnet beim kurzen Tap das Aktions-Sheet und ändert dort die Menge', async () => {
  const user = userEvent.setup();

  await renderScreen();
  await user.press(screen.getByRole('button', { name: 'Milch, 2 l' }));

  expect(screen.getByRole('button', { name: 'Bearbeiten' })).toBeOnTheScreen();
  expect(screen.getByRole('button', { name: 'Produktinformationen' })).toBeOnTheScreen();

  await user.press(screen.getByRole('button', { name: 'Menge erhöhen' }));
  expect(mockUpdateQtyMutate).toHaveBeenCalledWith({
    id: 'item-1',
    household_id: 'hh-1',
    delta: 1,
  });
});

it('fragt vor dem Entfernen aus dem Aktions-Sheet nach Bestaetigung', async () => {
  const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  const user = userEvent.setup();

  await renderScreen();
  await user.press(screen.getByRole('button', { name: 'Milch, 2 l' }));
  await user.press(screen.getByRole('button', { name: 'Entfernen' }));

  expect(alertSpy).toHaveBeenCalledWith(
    'Artikel löschen',
    '"Milch" aus dem Vorrat entfernen?',
    expect.arrayContaining([
      expect.objectContaining({ text: 'Abbrechen', style: 'cancel' }),
      expect.objectContaining({ text: 'Löschen', style: 'destructive' }),
    ]),
  );
  expect(mockUpdateQtyMutate).not.toHaveBeenCalled();

  const buttons = alertSpy.mock.calls[0][2] as { text: string; onPress?: () => void }[];
  buttons.find((b) => b.text === 'Löschen')?.onPress?.();

  expect(mockUpdateQtyMutate).toHaveBeenCalledWith({
    id: 'item-1',
    household_id: 'hh-1',
    delta: -2,
  });

  alertSpy.mockRestore();
});

it('fragt auch über die Linkswisch-Aktion vor dem Entfernen nach', async () => {
  const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  const user = userEvent.setup();

  await renderScreen();
  await user.press(screen.getByRole('button', { name: 'Milch entfernen' }));

  expect(alertSpy).toHaveBeenCalledWith(
    'Artikel löschen',
    '"Milch" aus dem Vorrat entfernen?',
    expect.any(Array),
  );
  alertSpy.mockRestore();
});

it('öffnet Produktinformationen per Long Press und über die Info-Aktion', async () => {
  const user = userEvent.setup();

  await renderScreen();
  const row = screen.getByRole('button', { name: 'Milch, 2 l' });

  await user.longPress(row);
  expect(screen.getByText('Produktdaten von Open Food Facts')).toBeOnTheScreen();
  await user.press(screen.getByRole('button', { name: 'Schließen' }));

  await user.press(row);
  await user.press(screen.getByRole('button', { name: 'Produktinformationen' }));
  expect(screen.getByText('Produktdaten von Open Food Facts')).toBeOnTheScreen();
});

it('bearbeitet einen Vorratsartikel im eigenen Bottom Sheet', async () => {
  const user = userEvent.setup();

  await renderScreen();
  await user.press(screen.getByRole('button', { name: 'Milch, 2 l' }));
  await user.press(screen.getByRole('button', { name: 'Bearbeiten' }));

  expect(screen.getByText('Artikel bearbeiten')).toBeOnTheScreen();
  fireEvent.changeText(screen.getByLabelText('Artikelname'), 'Haferdrink');
  await user.press(screen.getByRole('button', { name: 'Menge erhöhen' }));
  await user.press(screen.getByRole('button', { name: 'Änderungen speichern' }));

  expect(mockUpdateItemMutateAsync).toHaveBeenCalledWith(
    expect.objectContaining({
      id: 'item-1',
      name: 'Haferdrink',
      quantity: 3,
      unit: 'l',
    }),
  );
});

it('bietet im Vorrat keine Lagerort-Verwaltung an', async () => {
  await renderScreen();
  expect(screen.queryByRole('button', { name: 'Lagerorte verwalten' })).not.toBeOnTheScreen();
});

it('zeigt die grosszügige Zusammenfassung über der kompakten Arbeitsliste', async () => {
  await renderScreen();

  expect(screen.getByLabelText('1 Artikel im Vorrat, 0 kritisch, 0 bald fällig')).toBeTruthy();
  expect(screen.getByText('Dein Vorrat heute')).toBeTruthy();
  expect(screen.getByText('Alles gut im Blick')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Milch, 2 l' })).toBeTruthy();
});

describe('Sortier-Toggle MHD/Name (#71)', () => {
  beforeEach(() => {
    const soon = new Date();
    soon.setDate(soon.getDate() + 2);
    mockItems = [
      {
        id: 'item-apfel',
        household_id: 'hh-1',
        location_id: null,
        product_id: null,
        name: 'Apfel',
        quantity: 1,
        unit: 'piece',
        expiry_date: null, // bucket 'none' -> steht bei MHD-Sortierung hinten
        added_by: null,
        created_at: '',
        location_kind: null,
        location_name: null,
      },
      {
        id: 'item-zwiebel',
        household_id: 'hh-1',
        location_id: null,
        product_id: null,
        name: 'Zwiebel',
        quantity: 1,
        unit: 'piece',
        expiry_date: soon.toISOString().split('T')[0], // bucket 'soon' -> steht bei MHD-Sortierung vorn
        added_by: null,
        created_at: '',
        location_kind: null,
        location_name: null,
      },
    ];
  });

  function itemOrder() {
    return screen.getAllByLabelText(/piece$/).map((el) => el.props.accessibilityLabel as string);
  }

  it('sortiert standardmaessig nach MHD (bald ablaufend zuerst)', async () => {
    await renderScreen();
    expect(itemOrder()).toEqual(['Zwiebel, 1 piece', 'Apfel, 1 piece']);
  });

  it('sortiert nach Name, wenn der Name-Toggle gewaehlt wird', async () => {
    const user = userEvent.setup();
    await renderScreen();
    await user.press(
      screen.getByRole('button', {
        name: 'Sortierung ändern, aktuell nach Haltbarkeit',
      }),
    );
    expect(itemOrder()).toEqual(['Apfel, 1 piece', 'Zwiebel, 1 piece']);
  });
});

describe('filter=expiring vom Dashboard-Widget (#73)', () => {
  beforeEach(() => {
    mockParams = { filter: 'expiring' };
    const soon = new Date();
    soon.setDate(soon.getDate() + 1);
    const farAway = new Date();
    farAway.setDate(farAway.getDate() + 30);
    mockItems = [
      {
        id: 'item-critical',
        household_id: 'hh-1',
        location_id: 'loc-1',
        product_id: null,
        name: 'Bald abgelaufen',
        quantity: 1,
        unit: 'piece',
        expiry_date: soon.toISOString().split('T')[0],
        added_by: null,
        created_at: '',
        location_kind: null,
        location_name: null,
      },
      {
        id: 'item-ok',
        household_id: 'hh-1',
        location_id: 'loc-2',
        product_id: null,
        name: 'Noch lange haltbar',
        quantity: 1,
        unit: 'piece',
        expiry_date: farAway.toISOString().split('T')[0],
        added_by: null,
        created_at: '',
        location_kind: null,
        location_name: null,
      },
    ];
  });

  it('zeigt nur bald ablaufende/abgelaufene Artikel, unabhaengig vom Lagerort-Tab', async () => {
    await renderScreen();
    expect(screen.getByText('Bald abgelaufen')).toBeTruthy();
    expect(screen.queryByText('Noch lange haltbar')).not.toBeOnTheScreen();
  });
});
