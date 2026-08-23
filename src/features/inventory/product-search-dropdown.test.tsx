import { onlineManager } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import { useState } from 'react';

import { ProductSearchDropdown } from '@/features/inventory/product-search-dropdown';
import { type OpenFoodFactsProduct, searchOpenFoodFacts } from '@/lib/open-food-facts';

// Der Wrapper bildet den kontrollierten `value`-Loop des Aufrufers ab.
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

// React-Warnungen sollen den verursachenden Test fehlschlagen lassen.
let consoleErrorSpy: jest.SpiedFunction<typeof console.error>;

beforeEach(() => {
  consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

  mockSearch.mockReset();
  mockGetAllAsync.mockReset();
  mockGetAllAsync.mockResolvedValue([]);
  (router.push as jest.Mock).mockReset();
  mockOffDumpAttached = false;
});

afterEach(() => {
  const consoleErrors = [...consoleErrorSpy.mock.calls];

  consoleErrorSpy.mockRestore();
  onlineManager.setOnline(true);

  expect(consoleErrors).toEqual([]);
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

it('gibt off_category_tags/off_last_modified_at eines lokalen Treffers an onSelectProduct weiter (#223)', async () => {
  const onSelectProduct = jest.fn();
  mockGetAllAsync.mockImplementation((sql: string) => {
    if (sql.includes('off_dump.products')) return Promise.resolve([]);
    if (sql.includes('from products')) {
      return Promise.resolve([
        {
          barcode: 'local-1',
          name: 'Schweineschnitzel',
          brand: null,
          kcal_per_100: null,
          protein_g_per_100: null,
          carbs_g_per_100: null,
          fat_g_per_100: null,
          off_category_tags: '["en:meats","en:porks"]',
          off_last_modified_at: '2026-01-01T00:00:00.000Z',
        },
      ]);
    }
    return Promise.resolve([]);
  });
  mockSearch.mockResolvedValue({ products: [], hasMore: false });

  await render(<ControlledDropdown onSelectProduct={onSelectProduct} />);
  await fireEvent.changeText(screen.getByPlaceholderText('z. B. Hafermilch'), 'Schwein');

  await fireEvent.press(await screen.findByText('Schweineschnitzel'));

  expect(onSelectProduct).toHaveBeenCalledWith(
    expect.objectContaining({
      categoryTags: ['en:meats', 'en:porks'],
      offLastModifiedAt: '2026-01-01T00:00:00.000Z',
    }),
  );
});

it('liefert ein leeres categoryTags-Array, wenn der lokale Treffer keine OFF-Tags hat', async () => {
  const onSelectProduct = jest.fn();
  mockGetAllAsync.mockImplementation((sql: string) => {
    if (sql.includes('off_dump.products')) return Promise.resolve([]);
    if (sql.includes('from products')) {
      return Promise.resolve([
        {
          barcode: 'local-2',
          name: 'Handgemachtes Brot',
          brand: null,
          kcal_per_100: null,
          protein_g_per_100: null,
          carbs_g_per_100: null,
          fat_g_per_100: null,
          off_category_tags: null,
          off_last_modified_at: null,
        },
      ]);
    }
    return Promise.resolve([]);
  });
  mockSearch.mockResolvedValue({ products: [], hasMore: false });

  await render(<ControlledDropdown onSelectProduct={onSelectProduct} />);
  await fireEvent.changeText(screen.getByPlaceholderText('z. B. Hafermilch'), 'Brot');

  await fireEvent.press(await screen.findByText('Handgemachtes Brot'));

  expect(onSelectProduct).toHaveBeenCalledWith(
    expect.objectContaining({ categoryTags: [], offLastModifiedAt: undefined }),
  );
});

it('ergaenzt OFF-Treffer, wenn lokale Treffer unter dem Schwellwert liegen', async () => {
  // Ein DB-Mock bedient zwei unterschiedliche Zeilenformen.
  mockGetAllAsync.mockImplementation((sql: string) => {
    if (sql.includes('off_dump.products')) {
      return Promise.resolve([]);
    }

    if (sql.includes('from products')) {
      return Promise.resolve([
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
    }

    return Promise.resolve([]);
  });
  mockSearch.mockResolvedValue({
    products: [{ barcode: 'off-1', name: 'OFF Milch', quantity: 1, unit: 'l' }],
  });

  await render(<ControlledDropdown onSelectProduct={() => {}} />);
  await fireEvent.changeText(screen.getByPlaceholderText('z. B. Hafermilch'), 'Milch');

  expect(await screen.findByText('Lokale Milch')).toBeOnTheScreen();
  expect(screen.getByText('OFF Milch')).toBeOnTheScreen();
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

  // Laesst einen faelschlich ausgeloesten Debounce sichtbar werden.
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
