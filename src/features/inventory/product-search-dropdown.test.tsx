import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable } from 'react-native';

import { space } from '@/components/theme/index';
import {
  calculateProductPanelLayout,
  ProductSearchDropdown,
} from '@/features/inventory/product-search-dropdown';
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
    searchOnline: jest.fn(),
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

describe('calculateProductPanelLayout', () => {
  it('öffnet nach oben, wenn unter dem Suchfeld nur wenig Platz bleibt', () => {
    expect(
      calculateProductPanelLayout({
        anchorY: 700,
        anchorHeight: 60,
        windowHeight: 844,
        keyboardTopY: 650,
      }),
    ).toEqual({ placement: 'above', maxHeight: 676 });
  });

  it('öffnet nach unten, wenn dort ausreichend Platz vorhanden ist', () => {
    expect(
      calculateProductPanelLayout({
        anchorY: 100,
        anchorHeight: 60,
        windowHeight: 844,
        keyboardTopY: null,
      }),
    ).toEqual({ placement: 'below', maxHeight: 660 });
  });
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

it('schliesst die Trefferliste mit X und ueber die freie Flaeche', async () => {
  mockUseProductSearch.mockReturnValue(
    searchState({
      searched: true,
      results: [product({ name: 'Hafermilch', barcode: '123' })],
    }),
  );

  await render(<ControlledDropdown onSelectProduct={() => {}} />);
  await fireEvent.changeText(screen.getByPlaceholderText('z. B. Hafermilch'), 'Hafermilch');

  expect(screen.getByRole('button', { name: 'Suche schließen' })).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: 'Suche schließen' }));
  expect(screen.queryByText('EAN 123')).not.toBeOnTheScreen();

  // Erneut öffnen und den gleichen Dismiss-Mechanismus wie im Artikel-hinzufügen-Flow prüfen.
  await fireEvent.changeText(screen.getByPlaceholderText('z. B. Hafermilch'), 'Hafermilch');
  await fireEvent.press(screen.getByTestId('product-search-dropdown-dismiss-area'));
  expect(screen.queryByText('EAN 123')).not.toBeOnTheScreen();
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

it('startet die Online-Suche nur ueber eine explizite Aktion', async () => {
  const searchOnline = jest.fn();
  mockUseProductSearch.mockReturnValue(searchState({ searched: true, searchOnline }));

  await render(<ControlledDropdown onSelectProduct={() => {}} />);
  await fireEvent.changeText(screen.getByPlaceholderText('z. B. Hafermilch'), 'Fantasieprodukt');

  await fireEvent.press(await screen.findByRole('button', { name: 'Open Food Facts durchsuchen' }));

  expect(searchOnline).toHaveBeenCalledTimes(1);
});

it('zeigt bei einem Suchfehler einen Retry an', async () => {
  const retry = jest.fn();
  mockUseProductSearch.mockReturnValue(searchState({ searched: true, failed: true, retry }));

  await render(<ControlledDropdown onSelectProduct={() => {}} />);
  await fireEvent.changeText(screen.getByPlaceholderText('z. B. Hafermilch'), 'Fantasieprodukt');

  expect(await screen.findByText('Open Food Facts ist gerade nicht erreichbar.')).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: 'Erneut versuchen' }));

  expect(retry).toHaveBeenCalledTimes(1);
  expect(screen.queryByText(/manuell anlegen/)).not.toBeOnTheScreen();
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

it('ordnet eine externe Nebenaktion neben dem Suchfeld an', async () => {
  await render(
    <ProductSearchDropdown
      value=""
      onChangeText={() => {}}
      onSelectProduct={() => {}}
      trailingPlacement="outside"
      trailing={<Pressable accessibilityRole="button" accessibilityLabel="Barcode scannen" />}
    />,
  );

  const input = screen.getByPlaceholderText('z. B. Hafermilch');
  const inputColumn = input.parent?.parent?.parent;
  const searchRow = inputColumn?.parent;

  expect(searchRow).not.toHaveProp('className');
  expect(inputColumn).not.toHaveProp('className');
  expect(searchRow).toHaveStyle({
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  });
  expect(inputColumn).toHaveStyle({ flex: 1, minWidth: 0 });
  expect(screen.getByRole('button', { name: 'Barcode scannen' })).toBeOnTheScreen();
});
