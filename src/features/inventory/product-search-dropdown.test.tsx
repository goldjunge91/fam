import { onlineManager } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import { useState } from 'react';

import { ProductSearchDropdown } from '@/features/inventory/product-search-dropdown';
import { type OpenFoodFactsProduct, searchOpenFoodFacts } from '@/lib/open-food-facts';

// ProductSearchDropdown ist eine kontrollierte Komponente (`value` lebt beim
// Aufrufer) — der Such-Effekt haengt an der `value`-Prop, nicht am internen
// TextInput-Text. Der Test braucht deshalb einen echten kontrollierten Loop.
function ControlledDropdown({
  onSelectProduct,
  initialValue = '',
}: {
  onSelectProduct: (p: OpenFoodFactsProduct) => void;
  initialValue?: string;
}) {
  const [value, setValue] = useState(initialValue);
  return (
    <ProductSearchDropdown
      value={value}
      onChangeText={setValue}
      onSelectProduct={onSelectProduct}
    />
  );
}

jest.mock('expo-router', () => ({
  router: { push: jest.fn() },
}));

jest.mock('@/lib/open-food-facts', () => ({
  ...jest.requireActual('@/lib/open-food-facts'),
  searchOpenFoodFacts: jest.fn(),
}));

const mockGetAllAsync = jest.fn().mockResolvedValue([]);

jest.mock('@/lib/db/client', () => ({
  getDatabase: async () => ({ getAllAsync: mockGetAllAsync }),
}));

let mockOffDumpAttached = false;

jest.mock('@/lib/off-dump/off-dump', () => ({
  ...jest.requireActual('@/lib/off-dump/off-dump'),
  isOffDumpAttached: () => mockOffDumpAttached,
}));

jest.mock('@/hooks/use-theme', () => ({
  useTheme: () => require('@/constants/theme').Colors.light,
}));

const mockSearch = searchOpenFoodFacts as jest.Mock;

beforeEach(() => {
  mockSearch.mockReset();
  mockGetAllAsync.mockReset();
  mockGetAllAsync.mockResolvedValue([]);
  (router.push as jest.Mock).mockReset();
  mockOffDumpAttached = false;
});

it('bietet "manuell anlegen" an, wenn Open Food Facts keinen Treffer liefert', async () => {
  mockSearch.mockResolvedValue({ products: [] });
  const onSelectProduct = jest.fn();

  await render(<ControlledDropdown onSelectProduct={onSelectProduct} />);

  await fireEvent.changeText(screen.getByPlaceholderText('z. B. Hafermilch'), 'Fantasieprodukt');

  await waitFor(() => {
    expect(screen.getByText('+ "Fantasieprodukt" manuell anlegen')).toBeTruthy();
  });

  await fireEvent.press(screen.getByText('+ "Fantasieprodukt" manuell anlegen'));

  expect(router.push).toHaveBeenCalledWith({
    pathname: '/add-product',
    params: { prefillName: 'Fantasieprodukt' },
  });
});

it('zeigt keine "manuell anlegen"-Affordance, wenn Treffer gefunden werden', async () => {
  mockSearch.mockResolvedValue({
    products: [{ barcode: '123', name: 'Hafermilch', quantity: 1, unit: 'l' }],
  });

  await render(<ControlledDropdown onSelectProduct={() => {}} />);

  await fireEvent.changeText(screen.getByPlaceholderText('z. B. Hafermilch'), 'Hafermilch');

  await waitFor(() => {
    expect(screen.getByText('Hafermilch')).toBeTruthy();
  });

  expect(screen.queryByText(/manuell anlegen/)).not.toBeOnTheScreen();
});

it('zeigt lokale Treffer und fragt Open Food Facts nicht an, wenn genug lokale Treffer da sind', async () => {
  mockGetAllAsync.mockResolvedValue(
    Array.from({ length: 5 }, (_, i) => ({
      barcode: `local-${i}`,
      name: `Lokales Produkt ${i}`,
      brand: null,
      kcal_per_100: 100,
      protein_g_per_100: null,
      carbs_g_per_100: null,
      fat_g_per_100: null,
    })),
  );

  await render(<ControlledDropdown onSelectProduct={() => {}} />);
  await fireEvent.changeText(screen.getByPlaceholderText('z. B. Hafermilch'), 'Produkt');

  await waitFor(() => {
    expect(screen.getByText('Lokales Produkt 0')).toBeTruthy();
  });

  expect(mockSearch).not.toHaveBeenCalled();
});

it('ergaenzt OFF-Treffer, wenn lokale Treffer unter dem Schwellwert liegen', async () => {
  mockGetAllAsync.mockResolvedValue([
    {
      barcode: 'local-1',
      name: 'Lokale Milch',
      brand: null,
      kcal_per_100: 42,
      protein_g_per_100: null,
      carbs_g_per_100: null,
      fat_g_per_100: null,
    },
  ]);
  mockSearch.mockResolvedValue({
    products: [{ barcode: 'off-1', name: 'OFF Milch', quantity: 1, unit: 'l' }],
  });

  await render(<ControlledDropdown onSelectProduct={() => {}} />);
  await fireEvent.changeText(screen.getByPlaceholderText('z. B. Hafermilch'), 'Milch');

  await waitFor(() => {
    expect(screen.getByText('Lokale Milch')).toBeTruthy();
    expect(screen.getByText('OFF Milch')).toBeTruthy();
  });
});

it('ergaenzt Treffer aus dem angehaengten OFF-Dump auch offline, wenn lokale Treffer unter dem Schwellwert liegen', async () => {
  onlineManager.setOnline(false);
  mockOffDumpAttached = true;
  mockGetAllAsync.mockImplementation((sql: string) => {
    if (sql.includes('off_dump.products')) {
      return Promise.resolve([
        {
          code: 'dump-1',
          product_name: 'Dump Hafermilch',
          brand: 'Oatly',
          quantity: '1l',
          nutriscore: 'b',
          energy_kcal: 59,
          fat: 1.5,
          saturated_fat: 0.2,
          carbohydrates: 6.6,
          sugars: 3.3,
          proteins: 1,
          salt: 0.1,
        },
      ]);
    }
    return Promise.resolve([]);
  });

  await render(<ControlledDropdown onSelectProduct={() => {}} />);
  await fireEvent.changeText(screen.getByPlaceholderText('z. B. Hafermilch'), 'Hafermilch');

  await waitFor(() => {
    expect(screen.getByText('Dump Hafermilch')).toBeTruthy();
  });

  expect(mockSearch).not.toHaveBeenCalled();
  onlineManager.setOnline(true);
});

it('oeffnet das Dropdown nicht, wenn mit bereits gesetztem Wert gemountet wird (Rezept bearbeiten)', async () => {
  mockSearch.mockResolvedValue({
    products: [{ barcode: '123', name: 'Hafermilch', quantity: 1, unit: 'l' }],
  });

  await render(<ControlledDropdown initialValue="Hafermilch" onSelectProduct={() => {}} />);

  // Genug Zeit fuer den 300ms-Debounce der Suche verstreichen lassen, damit
  // ein faelschlich ausgeloester Effekt sich auch tatsaechlich zeigen wuerde.
  await new Promise((resolve) => setTimeout(resolve, 400));

  expect(screen.queryByText('Hafermilch')).not.toBeOnTheScreen();
  expect(mockSearch).not.toHaveBeenCalled();
});

it('fragt Open Food Facts nicht an, wenn offline', async () => {
  onlineManager.setOnline(false);
  mockGetAllAsync.mockResolvedValue([]);

  await render(<ControlledDropdown onSelectProduct={() => {}} />);
  await fireEvent.changeText(screen.getByPlaceholderText('z. B. Hafermilch'), 'Fantasieprodukt');

  await waitFor(() => {
    expect(screen.getByText('+ "Fantasieprodukt" manuell anlegen')).toBeTruthy();
  });

  expect(mockSearch).not.toHaveBeenCalled();
  onlineManager.setOnline(true);
});
