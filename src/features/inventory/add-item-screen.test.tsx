import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { colorsLight, radius, space } from '@/components/theme';
import { MIN_TOUCH_SIZE } from '@/constants/ui';
import {
  consumePendingProductSelection,
  setPendingProductSelection,
} from '@/features/inventory/pending-product-selection';

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
const mockAddStorageLocationMutateAsync = jest.fn().mockResolvedValue({ id: 'location-1' });
const mockRecordProductUsage = jest.fn().mockResolvedValue(undefined);
const mockGetFirstAsync = jest.fn().mockResolvedValue(null);
let mockLocations: { id: string; name: string }[] = [];
let mockHousehold: { id: string; name: string } | null = { id: 'hh-1', name: 'Zuhause' };
let mockSession: { user: { id: string } } | null = { user: { id: 'user-1' } };

jest.mock('expo-router', () => ({
  router: { back: jest.fn(), canGoBack: () => false },
  useFocusEffect: (callback: () => undefined | (() => void)) => {
    const { useEffect } = require('react') as typeof import('react');
    useEffect(callback, [callback]);
  },
  useNavigation: () => ({ canGoBack: () => false, addListener: () => () => {} }),
}));

jest.mock('@/features/auth/session-provider', () => ({
  useSession: () => ({ session: mockSession }),
}));

jest.mock('@/features/household/active-household-provider', () => ({
  useActiveHousehold: () => ({ activeHousehold: mockHousehold }),
}));

jest.mock('@/features/inventory/use-storage-locations', () => ({
  useStorageLocations: () => ({ data: mockLocations, isLoading: false }),
  useAddStorageLocationMutation: () => ({
    mutateAsync: mockAddStorageLocationMutateAsync,
    isPending: false,
  }),
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

jest.mock('@/lib/db/local-client', () => ({
  getDatabase: async () => ({ getFirstAsync: mockGetFirstAsync }),
}));

jest.mock('@/lib/db/product-usage', () => ({
  recordProductUsage: (...args: unknown[]) => mockRecordProductUsage(...args),
  getFrequentProductUsage: jest.fn().mockResolvedValue([]),
}));

jest.mock('@/features/inventory/barcode-scanner-modal', () => ({
  BarcodeScannerModal: ({ visible, onClose }: { visible: boolean; onClose: () => void }) => {
    const { Button } = require('react-native');
    return visible ? <Button title="Scanner schließen (Test)" onPress={onClose} /> : null;
  },
}));

jest.mock('@/features/inventory/frequent-products-quick-select', () => ({
  FrequentProductsQuickSelect: () => null,
}));

jest.mock('@/features/inventory/product-search-dropdown', () => {
  const { TextInput, View } = require('react-native');
  type MockProps = {
    onChangeText: (text: string) => void;
    onSelectProduct: (product: Record<string, unknown>) => void;
    trailing?: ReactNode;
  };
  return {
    ProductSearchDropdown: ({ onChangeText, onSelectProduct, trailing }: MockProps) => (
      <View>
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
        {trailing}
      </View>
    ),
  };
});

beforeEach(() => {
  jest.clearAllMocks();
  mockLocations = [];
  mockHousehold = { id: 'hh-1', name: 'Zuhause' };
  mockSession = { user: { id: 'user-1' } };
  mockAddStorageLocationMutateAsync.mockResolvedValue({ id: 'location-1' });
  mockRecordProductUsage.mockResolvedValue(undefined);
  consumePendingProductSelection();
  mockAddFridgeItemMutateAsync.mockClear();
  mockAddProductMutateAsync.mockClear();
  mockGetFirstAsync.mockClear();
  mockGetFirstAsync.mockResolvedValue(null);
});

it('verwendet die zentralen Modal-Schließen-Tokens', async () => {
  await renderScreen();

  const closeButton = screen.getByRole('button', { name: 'Schließen' });

  expect(closeButton.props.hitSlop).toBe(6);
  expect(closeButton).toHaveStyle({
    minWidth: MIN_TOUCH_SIZE,
    minHeight: MIN_TOUCH_SIZE,
    borderRadius: radius.sm,
    backgroundColor: colorsLight.backgroundSoft,
  });
});

it('hält den unteren Inhalt mit KeyboardAwareScrollView erreichbar', async () => {
  await renderScreen();

  const [scrollView] = screen.container.queryAll(
    (instance) => instance.props.keyboardShouldPersistTaps === 'handled',
  );
  if (!scrollView) throw new Error('AddItemScreen did not render a keyboard-aware scroll view');

  expect(scrollView.props.bottomOffset).toBe(24);
  expect(scrollView.props.keyboardShouldPersistTaps).toBe('handled');
  expect(scrollView.props.contentContainerStyle.paddingBottom).toBeGreaterThanOrEqual(
    space.xl + space.xs,
  );
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

it('setzt ein MHD aus der Schnellauswahl und speichert es mit dem Vorratseintrag', async () => {
  jest.useFakeTimers().setSystemTime(new Date('2026-10-28T12:00:00.000Z'));

  try {
    await renderScreen();

    await fireEvent.changeText(screen.getByTestId('name-field'), 'Haferdrink');
    await fireEvent.press(screen.getByRole('button', { name: 'Weitere Angaben öffnen' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Schnellauswahl MHD: + 7 Tage' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Zum Vorrat hinzufügen' }));

    expect(mockAddFridgeItemMutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Haferdrink', expiry_date: '2026-11-04' }),
    );
  } finally {
    jest.useRealTimers();
  }
});

it('erstellt einen Lagerort mit getrimmtem Namen und kann die Eingabe abbrechen', async () => {
  await renderScreen();

  await fireEvent.press(screen.getByText('+ Neuer Lagerort'));
  await fireEvent.changeText(screen.getByLabelText('Name des Lagerorts'), '  Vorratskammer  ');
  await fireEvent.press(screen.getByRole('button', { name: 'Erstellen' }));
  await waitFor(() =>
    expect(mockAddStorageLocationMutateAsync).toHaveBeenCalledWith({
      household_id: 'hh-1',
      name: 'Vorratskammer',
    }),
  );

  await fireEvent.press(screen.getByText('+ Neuer Lagerort'));
  await fireEvent.changeText(screen.getByLabelText('Name des Lagerorts'), 'Abbruch');
  await fireEvent.press(screen.getByRole('button', { name: 'Abbrechen' }));
  expect(screen.queryByLabelText('Name des Lagerorts')).toBeNull();
  expect(mockAddStorageLocationMutateAsync).toHaveBeenCalledTimes(1);
});

it('lässt eine erfolgreiche Vorratsspeicherung trotz Fehler im Nutzungsverlauf bestehen', async () => {
  mockRecordProductUsage.mockRejectedValueOnce(new Error('lokale History offline'));
  await renderScreen();

  await fireEvent.changeText(screen.getByTestId('name-field'), 'Reis');
  await fireEvent.press(screen.getByRole('button', { name: 'Zum Vorrat hinzufügen' }));

  await waitFor(() => expect(router.back).toHaveBeenCalled());
  expect(mockAddFridgeItemMutateAsync).toHaveBeenCalledWith(
    expect.objectContaining({ name: 'Reis' }),
  );
});

it('speichert weder Bestand noch Lagerort ohne aktiven Haushalt', async () => {
  mockHousehold = null;
  mockSession = null;
  await renderScreen();

  await fireEvent.changeText(screen.getByTestId('name-field'), 'Reis');
  await fireEvent.press(screen.getByRole('button', { name: 'Zum Vorrat hinzufügen' }));
  await fireEvent.press(screen.getByText('+ Neuer Lagerort'));
  await fireEvent.changeText(screen.getByLabelText('Name des Lagerorts'), 'Vorratskammer');
  await fireEvent.press(screen.getByRole('button', { name: 'Erstellen' }));

  expect(mockAddFridgeItemMutateAsync).not.toHaveBeenCalled();
  expect(mockAddStorageLocationMutateAsync).not.toHaveBeenCalled();
});

it('übernimmt eine zurückgekehrte Produktauswahl beim Fokus und erhält Packungsinhalt', async () => {
  setPendingProductSelection({
    barcode: '',
    name: 'Mandelmilch',
    quantity: 1,
    unit: 'l',
    categoryTags: [],
  });
  await renderScreen();

  expect(await screen.findByText('Mandelmilch')).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: 'Zum Vorrat hinzufügen' }));

  await waitFor(() =>
    expect(mockAddFridgeItemMutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Mandelmilch',
        unit: 'package',
        package_size: 1,
        package_size_unit: 'l',
      }),
    ),
  );
  expect(consumePendingProductSelection()).toBeNull();
});

it('öffnet und schließt den Barcode-Scanner über die Suchaktion', async () => {
  await renderScreen();

  await fireEvent.press(screen.getByRole('button', { name: 'Barcode scannen' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Scanner schließen (Test)' }));

  expect(screen.queryByRole('button', { name: 'Scanner schließen (Test)' })).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: 'Barcode scannen' }));
  expect(screen.getByRole('button', { name: 'Scanner schließen (Test)' })).toBeOnTheScreen();
});
