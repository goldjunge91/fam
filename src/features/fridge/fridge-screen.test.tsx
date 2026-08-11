import { fireEvent, render, screen } from '@testing-library/react-native';
import { router } from 'expo-router';
import { Alert } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { FridgeScreen } from '@/features/fridge/fridge-screen';

const mockUpdateQtyMutate = jest.fn();

let mockItems: unknown[] = [];
let mockParams: Record<string, string> = {};

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
}));

jest.mock('@/features/inventory/use-product', () => ({
  useProduct: () => ({ data: null, isLoading: false }),
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
      <FridgeScreen />
    </SafeAreaProvider>,
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
});

it('fragt bei Lang-Druck vor dem Loeschen nach Bestaetigung', async () => {
  const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});

  await renderScreen();

  await fireEvent(screen.getByLabelText('Milch, 2 l'), 'longPress');

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

it('oeffnet das Artikel-hinzufuegen-Formular ueber den Header-Button', async () => {
  await renderScreen();

  await fireEvent.press(screen.getByLabelText('Artikel hinzufügen'));

  expect(router.push).toHaveBeenCalledWith('/add-item');
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
    await renderScreen();
    await fireEvent.press(screen.getByText('Name'));
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
