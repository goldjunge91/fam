import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ShoppingListScreen } from './shopping-list-screen';

let mockParams: { action?: string } = {};

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => mockParams,
  useRouter: () => ({ push: jest.fn(), back: jest.fn() }),
}));

jest.mock('@/features/auth/session-provider', () => ({
  useSession: () => ({ session: { user: { id: 'user-1' } } }),
}));

jest.mock('@/features/household/active-household-provider', () => ({
  useActiveHousehold: () => ({ activeHouseholdId: 'hh-1' }),
  useOptionalActiveHousehold: () => ({ activeHouseholdId: 'hh-1' }),
}));

const mockToggleMutateAsync = jest.fn();
const mockDeleteMutateAsync = jest.fn();
const mockMoveMutateAsync = jest.fn().mockResolvedValue(undefined);

jest.mock('../hooks/use-shopping-list-mutations', () => ({
  useToggleShoppingItem: () => ({ mutateAsync: mockToggleMutateAsync }),
  useDeleteShoppingItem: () => ({ mutateAsync: mockDeleteMutateAsync }),
  useMoveShoppingItems: () => ({ mutateAsync: mockMoveMutateAsync }),
  useCompleteShoppingRun: () => ({ mutateAsync: jest.fn() }),
  useAddShoppingItem: () => ({ mutateAsync: jest.fn() }),
  // Zeile antippen oeffnet jetzt das Bearbeiten-Formular (statt abzuhaken),
  // das braucht diesen Hook.
  useUpdateShoppingItem: () => ({ mutateAsync: jest.fn() }),
}));

jest.mock('../hooks/use-shopping-list', () => {
  const actual = jest.requireActual('../hooks/use-shopping-list');
  return {
    ...actual,
    useShoppingList: () => ({
      data: [
        {
          category: 'Obst & Gemüse',
          items: [
            {
              id: 'item-1',
              household_id: 'hh-1',
              name: 'Bananen',
              quantity: 3,
              unit: 'Stk',
              category_id: 'produce',
              category_source: 'name_fallback',
              category_classifier_version: null,
              category: 'Obst & Gemüse',
              checked_at: null,
              checked_by: null,
              store_id: 'store-1',
              notes: null,
              recipe_names: [],
              sort_order: 0,
              product_id: null,
              updated_at: '2026-03-29T10:00:00Z',
            },
            {
              id: 'item-2',
              household_id: 'hh-1',
              name: 'Hafermilch',
              quantity: 1,
              unit: 'l',
              category_id: 'beverages',
              category_source: 'name_fallback',
              category_classifier_version: null,
              category: 'Getränke',
              checked_at: null,
              checked_by: null,
              store_id: 'store-1',
              notes: null,
              recipe_names: [],
              sort_order: 1,
              product_id: null,
              updated_at: '2026-03-29T10:00:00Z',
            },
          ],
        },
      ],
      isLoading: false,
    }),
  };
});

jest.mock('../hooks/use-stores', () => {
  const actual = jest.requireActual('../hooks/use-stores');
  return {
    ...actual,
    useStores: () => ({
      data: [
        {
          id: 'store-1',
          name: 'Supermarkt',
          color: '#ff5500',
          icon: 'cart',
          household_id: 'hh-1',
        },
        {
          id: 'store-2',
          name: 'Discounter',
          color: '#0055ff',
          icon: 'cart',
          household_id: 'hh-1',
        },
      ],
    }),
    useSetStoreCategoryOrderMutation: () => ({
      mutateAsync: jest.fn(),
      isPending: false,
    }),
  };
});

jest.mock('../preferences/api', () => ({
  resolvePlacementForItem: jest.fn().mockResolvedValue({
    placementZoneId: 'other',
    categoryId: 'other',
    source: 'name_fallback',
    classifierVersion: 'placement-v2.0.0',
    globalClassification: {
      placementZoneId: 'other',
      productFamilyId: 'other_food',
      productFormId: 'ambient',
      classifierVersion: 'placement-v2.0.0',
    },
    barcode: null,
  }),
}));

jest.mock('@/features/navigation/navigation-chrome-provider', () => ({
  useNavigationChrome: () => ({ openDrawer: jest.fn(), openProfile: jest.fn() }),
}));

jest.mock('@/features/navigation/use-profile-initials', () => ({
  useProfileInitials: () => 'M',
}));

jest.mock('@/features/inventory/barcode-scanner-modal', () => {
  const { Pressable, Text } = require('react-native');

  return {
    BarcodeScannerModal: ({
      visible,
      onBarcodeDetected,
    }: {
      visible: boolean;
      onBarcodeDetected: (barcode: string) => void;
    }) =>
      visible ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Testprodukt scannen"
          onPress={() => onBarcodeDetected('4001234567890')}>
          <Text>Barcode scanner geöffnet</Text>
        </Pressable>
      ) : null,
  };
});

// Der Screen kennt nur den Product Catalog; die Quellenreihenfolge ist am
// Katalog-Seam getestet.
jest.mock('@/features/product-search/product-catalog-instance', () => ({
  productCatalog: {
    search: async () => ({ products: [], hasMore: false, failed: false }),
    findByBarcode: async (barcode: string) => ({
      barcode,
      categoryTags: [],
      name: 'Hafermilch',
      quantity: 1,
      unit: 'l',
    }),
  },
}));

jest.mock('@/hooks/use-hub-gradient', () => ({
  useHubGradient: () => undefined,
}));

jest.mock('@/hooks/use-theme', () => ({
  useTheme: () => require('@/constants/theme').Colors.light,
}));

describe('ShoppingListScreen', () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Number.POSITIVE_INFINITY },
      mutations: { retry: false, gcTime: Number.POSITIVE_INFINITY },
    },
  });

  beforeEach(() => {
    jest.useFakeTimers();
    mockParams = {};
    jest.clearAllMocks();
  });

  afterEach(async () => {
    // Auch interne React-Native-Timer muessen vor dem Wechsel zurueck abgearbeitet werden.
    await act(() => {
      jest.runOnlyPendingTimers();
    });
    jest.useRealTimers();
  });

  async function renderScreen() {
    return render(
      <SafeAreaProvider
        initialMetrics={{
          frame: { x: 0, y: 0, width: 390, height: 844 },
          insets: { top: 47, left: 0, right: 0, bottom: 34 },
        }}>
        <QueryClientProvider client={queryClient}>
          <ShoppingListScreen />
        </QueryClientProvider>
      </SafeAreaProvider>,
    );
  }

  it('rendert Markt-Übersicht in der Gesamtansicht', async () => {
    await renderScreen();

    expect(screen.getByText('Supermarkt')).toBeTruthy();
  });

  it('hakt Artikel in der Marktliste nicht mehr per Antippen ab — das passiert nur im Einkaufsmodus', async () => {
    await renderScreen();

    const storeCard = screen.getByText('Supermarkt');
    await fireEvent.press(storeCard);

    // SectionList plant ihr erstes Zellen-Layout nach 50 ms (VirtualizedList).
    await act(() => {
      jest.advanceTimersByTime(60);
    });

    expect(await screen.findByText('Bananen')).toBeTruthy();

    // Antippen der Zeile oeffnet jetzt das Bearbeiten-Formular statt abzuhaken.
    const row = screen.getByRole('button', { name: 'Bananen bearbeiten' });
    await fireEvent.press(row);

    expect(mockToggleMutateAsync).not.toHaveBeenCalled();
  });

  it('öffnet den Barcode-Scanner direkt über den Icon-Button', async () => {
    await renderScreen();

    const scannerButton = screen.getByRole('button', { name: 'Barcode scannen' });
    await fireEvent.press(scannerButton);

    expect(await screen.findByText('Barcode scanner geöffnet')).toBeTruthy();
  });

  it('verschiebt mehrere ausgewählte Artikel in eine andere Liste', async () => {
    await renderScreen();

    await fireEvent.press(screen.getByText('Supermarkt'));
    await act(() => {
      jest.advanceTimersByTime(60);
    });

    expect(
      await screen.findByRole('button', { name: 'Mehrfachauswahl starten' }),
    ).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Mehrfachauswahl starten' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Bananen auswählen' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Hafermilch auswählen' }));

    await fireEvent.press(screen.getByRole('button', { name: 'Verschieben' }));
    expect(await screen.findByText('Artikel verschieben')).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'Auf Discounter verschieben' }));

    expect(mockMoveMutateAsync).toHaveBeenCalledWith({
      household_id: 'hh-1',
      item_ids: ['item-1', 'item-2'],
      store_id: 'store-2',
    });
    expect(screen.queryByText('Artikel verschieben')).not.toBeOnTheScreen();
  });

  it('öffnet nach einem erfolgreichen Scan das Hinzufügen-Modal mit dem Produkt', async () => {
    await renderScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'Barcode scannen' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Testprodukt scannen' }));

    expect((await screen.findAllByText('Artikel hinzufügen')).length).toBeGreaterThan(0);
    expect(screen.getByDisplayValue('Hafermilch')).toBeTruthy();
  });

  it('öffnet das AddItemModal automatisch, wenn action=add gesetzt ist', async () => {
    mockParams = { action: 'add' };
    await renderScreen();

    expect((await screen.findAllByText('Artikel hinzufügen')).length).toBeGreaterThan(0);
  });
});
