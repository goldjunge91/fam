import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { router } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AddItemScreen } from './add-item-screen';

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
        <AddItemScreen />
      </SafeAreaProvider>
    </QueryClientProvider>,
  );
}

const mockAddFridgeItemMutateAsync = jest.fn().mockResolvedValue('item-1');
const mockAddProductMutateAsync = jest.fn().mockResolvedValue({});
const mockGetFirstAsync = jest.fn().mockResolvedValue(null);

jest.mock('expo-router', () => ({
  router: { back: jest.fn(), canGoBack: () => false },
  useFocusEffect: () => {},
  useNavigation: () => ({ canGoBack: () => false, addListener: () => () => {} }),
}));

jest.mock('@/features/auth/session-provider', () => ({
  useSession: () => ({ session: { user: { id: 'user-1' } } }),
}));

jest.mock('@/features/household/active-household-provider', () => ({
  useActiveHousehold: () => ({ activeHousehold: { id: 'hh-1', name: 'Zuhause' } }),
}));

jest.mock('@/features/inventory/use-storage-locations', () => ({
  useStorageLocations: () => ({ data: [], isLoading: false }),
  useAddStorageLocationMutation: () => ({ mutateAsync: jest.fn(), isPending: false }),
}));

jest.mock('@/features/inventory/use-inventory-mutations', () => ({
  useAddFridgeItemMutation: () => ({
    mutateAsync: mockAddFridgeItemMutateAsync,
    isPending: false,
  }),
}));

jest.mock('@/features/inventory/use-product-mutations', () => ({
  useAddProductMutation: () => ({ mutateAsync: mockAddProductMutateAsync, isPending: false }),
}));

jest.mock('@/lib/db/client', () => ({
  getDatabase: async () => ({ getFirstAsync: mockGetFirstAsync }),
}));

jest.mock('@/lib/db/product-usage', () => ({
  recordProductUsage: jest.fn().mockResolvedValue(undefined),
  getFrequentProductUsage: jest.fn().mockResolvedValue([]),
}));

jest.mock('@/features/inventory/barcode-scanner-modal', () => ({
  BarcodeScannerModal: () => null,
}));

jest.mock('@/features/inventory/product-search-dropdown', () => {
  const { TextInput } = require('react-native');
  type MockProps = {
    onChangeText: (text: string) => void;
    onSelectProduct: (product: Record<string, unknown>) => void;
  };
  return {
    ProductSearchDropdown: ({ onChangeText, onSelectProduct }: MockProps) => (
      <TextInput
        testID="name-field"
        onChangeText={onChangeText}
        accessibilityLabel="off-select"
        onFocus={() =>
          onSelectProduct({
            barcode: '4001234567890',
            name: 'Hafermilch Barista',
            brand: 'Oatly',
            quantity: 1,
            unit: 'l',
            caloriesPer100g: 59,
            proteinsPer100g: 1.1,
            carbsPer100g: 6.6,
            fatPer100g: 3,
          })
        }
      />
    ),
  };
});

beforeEach(() => {
  mockAddFridgeItemMutateAsync.mockClear();
  mockAddProductMutateAsync.mockClear();
  mockGetFirstAsync.mockClear();
  mockGetFirstAsync.mockResolvedValue(null);
});

it('persistiert einen OFF-Treffer in products, wenn er zum Bestand hinzugefuegt wird', async () => {
  await renderScreen();

  await fireEvent(screen.getByTestId('name-field'), 'focus');
  await fireEvent.press(screen.getByText('Zum Vorrat hinzufügen'));

  expect(mockGetFirstAsync).toHaveBeenCalledWith('select id from products where barcode = ?', [
    '4001234567890',
  ]);
  expect(mockAddProductMutateAsync).toHaveBeenCalledWith(
    expect.objectContaining({
      barcode: '4001234567890',
      name: 'Hafermilch Barista',
      source: 'off',
      created_by: 'user-1',
    }),
  );
  expect(mockAddFridgeItemMutateAsync).toHaveBeenCalled();
  expect(router.back).toHaveBeenCalled();
});

it('legt kein Produkt an, wenn der Barcode lokal bereits existiert', async () => {
  mockGetFirstAsync.mockResolvedValue({ id: 'existing-product' });

  await renderScreen();

  await fireEvent(screen.getByTestId('name-field'), 'focus');
  await fireEvent.press(screen.getByText('Zum Vorrat hinzufügen'));

  expect(mockAddProductMutateAsync).not.toHaveBeenCalled();
  expect(mockAddFridgeItemMutateAsync).toHaveBeenCalled();
});
