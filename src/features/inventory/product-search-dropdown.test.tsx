import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import { useState } from 'react';

import { ProductSearchDropdown } from '@/features/inventory/product-search-dropdown';
import type { UseProductSearchResult } from '@/features/product-search/hooks/use-product-search';
import type { CatalogProduct } from '@/features/product-search/types';

// ProductSearchDropdown ist eine kontrollierte Komponente (`value` lebt beim
// Aufrufer) — die Suche haengt an der `value`-Prop, nicht am internen
// TextInput-Text. Der Test braucht deshalb einen echten kontrollierten Loop.
function ControlledDropdown({
  onSelectProduct,
  initialValue = '',
}: {
  onSelectProduct: (p: CatalogProduct) => void;
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

// Die Suchlogik selbst ist am Katalog-Seam getestet (product-catalog.test.ts,
// use-product-search.test.ts). Hier zaehlt nur, was die Komponente daraus macht.
const mockUseProductSearch = jest.fn();

jest.mock('@/features/product-search/hooks/use-product-search', () => ({
  useProductSearch: (...args: unknown[]) => mockUseProductSearch(...args),
}));

jest.mock('@/features/product-search/preferred-market', () => ({
  usePreferredProductMarketName: () => null,
}));

jest.mock('@/hooks/use-theme', () => ({
  useTheme: () => require('@/constants/theme').Colors.light,
}));

const loadMore = jest.fn();

function searchState(overrides: Partial<UseProductSearchResult> = {}): UseProductSearchResult {
  return {
    results: [],
    searching: false,
    loadingMore: false,
    failed: false,
    hasMore: false,
    searched: false,
    loadMore,
    retry: jest.fn(),
    ...overrides,
  };
}

function product(overrides: Partial<CatalogProduct> & { name: string }): CatalogProduct {
  return { barcode: '', categoryTags: [], ...overrides };
}

// React-Warnungen sollen den verursachenden Test fehlschlagen lassen.
let consoleErrorSpy: jest.SpiedFunction<typeof console.error>;

beforeEach(() => {
  consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  mockUseProductSearch.mockReset();
  mockUseProductSearch.mockReturnValue(searchState());
  loadMore.mockReset();
  (router.push as jest.Mock).mockReset();
});

afterEach(() => {
  const consoleErrors = [...consoleErrorSpy.mock.calls];
  consoleErrorSpy.mockRestore();
  expect(consoleErrors).toEqual([]);
});

it('zeigt die Treffer der Suche', async () => {
  mockUseProductSearch.mockReturnValue(
    searchState({
      searched: true,
      results: [product({ name: 'Hafermilch', barcode: '123', brand: 'Oatly' })],
    }),
  );

  await render(<ControlledDropdown onSelectProduct={() => {}} />);
  await fireEvent.changeText(screen.getByPlaceholderText('z. B. Hafermilch'), 'Hafermilch');

  expect(await screen.findByText('Hafermilch')).toBeOnTheScreen();
  expect(screen.getByText('EAN 123')).toBeOnTheScreen();
  expect(screen.queryByText(/manuell anlegen/)).not.toBeOnTheScreen();
});

it('meldet den gewaehlten Treffer vollstaendig an den Aufrufer', async () => {
  const onSelectProduct = jest.fn();
  const schnitzel = product({
    name: 'Schweineschnitzel',
    productId: 'p1',
    barcode: 'local-1',
    categoryTags: ['en:meats', 'en:porks'],
    offLastModifiedAt: '2026-01-01T00:00:00.000Z',
  });
  mockUseProductSearch.mockReturnValue(searchState({ searched: true, results: [schnitzel] }));

  await render(<ControlledDropdown onSelectProduct={onSelectProduct} />);
  await fireEvent.changeText(screen.getByPlaceholderText('z. B. Hafermilch'), 'Schwein');

  await fireEvent.press(await screen.findByText('Schweineschnitzel'));

  expect(onSelectProduct).toHaveBeenCalledWith(schnitzel);
});

it('bietet "manuell anlegen" an, wenn nichts gefunden wurde', async () => {
  mockUseProductSearch.mockReturnValue(searchState({ searched: true, results: [] }));

  await render(<ControlledDropdown onSelectProduct={() => {}} />);
  await fireEvent.changeText(screen.getByPlaceholderText('z. B. Hafermilch'), 'Fantasieprodukt');

  await waitFor(() => {
    expect(screen.getByText('+ "Fantasieprodukt" manuell anlegen')).toBeOnTheScreen();
  });

  await fireEvent.press(screen.getByText('+ "Fantasieprodukt" manuell anlegen'));

  expect(router.push).toHaveBeenCalledWith({
    pathname: '/add-product',
    params: { prefillName: 'Fantasieprodukt' },
  });
});

it('sucht nicht, wenn mit bereits gesetztem Wert gemountet wird (Rezept bearbeiten)', async () => {
  await render(<ControlledDropdown initialValue="Hafermilch" onSelectProduct={() => {}} />);

  // Der Wert zaehlt als bereits getroffene Auswahl, nicht als neue Eingabe.
  expect(mockUseProductSearch).toHaveBeenCalledWith('', expect.anything());
  expect(screen.queryByText('EAN 123')).not.toBeOnTheScreen();
});

it('sucht wieder, sobald der Nutzer die Auswahl ueberschreibt', async () => {
  await render(<ControlledDropdown initialValue="Hafermilch" onSelectProduct={() => {}} />);

  await fireEvent.changeText(screen.getByPlaceholderText('z. B. Hafermilch'), 'Hafermilch Barista');

  await waitFor(() => {
    expect(mockUseProductSearch).toHaveBeenLastCalledWith('Hafermilch Barista', expect.anything());
  });
});
