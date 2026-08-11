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
}: {
  onSelectProduct: (p: OpenFoodFactsProduct) => void;
}) {
  const [value, setValue] = useState('');
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
  searchOpenFoodFacts: jest.fn(),
}));

jest.mock('@/hooks/use-theme', () => ({
  useTheme: () => ({
    background: '#FFFFFF',
    backgroundElement: '#F0F0F3',
    border: '#DDDDE3',
    text: '#000000',
    textSecondary: '#60646C',
    accent: '#208AEF',
  }),
}));

const mockSearch = searchOpenFoodFacts as jest.Mock;

beforeEach(() => {
  mockSearch.mockReset();
  (router.push as jest.Mock).mockReset();
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
