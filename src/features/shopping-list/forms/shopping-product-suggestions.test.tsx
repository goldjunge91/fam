import { render, screen, userEvent } from '@testing-library/react-native';

import { colorsLight } from '@/components/theme';
import type { CatalogProduct } from '@/features/product-search/types';
import { i18n } from '@/i18n';
import type { ShoppingProductSuggestion } from '../hooks/use-shopping-product-suggestions';
import { ShoppingProductSuggestions } from './shopping-product-suggestions';

const mockUseShoppingProductSuggestions = jest.fn();

jest.mock('@/lib/platform/haptics', () => ({
  heavy: jest.fn(),
  light: jest.fn(),
  medium: jest.fn(),
  selection: jest.fn(),
  success: jest.fn(),
}));

jest.mock('../hooks/use-shopping-product-suggestions', () => ({
  useShoppingProductSuggestions: (params: {
    userId: string | undefined;
    householdId: string;
    mode: 'recent' | 'frequent';
  }) => mockUseShoppingProductSuggestions(params),
}));

const suggestions: ShoppingProductSuggestion[] = [
  {
    name: 'Hafermilch',
    brand: 'Hafergut',
    barcode: '4006381333931',
    product_id: 'product-1',
    unit: 'package',
    quantity: 1,
    last_store_id: 'store-1',
    last_store_name: 'Rewe',
  },
  {
    name: 'Bananen',
    brand: null,
    barcode: null,
    product_id: null,
    unit: 'piece',
    quantity: 5,
    last_store_id: null,
    last_store_name: null,
  },
  {
    name: 'Tomaten',
    brand: null,
    barcode: null,
    product_id: 'product-3',
    unit: 'kg',
    quantity: 1,
    last_store_id: 'store-2',
    last_store_name: 'Aldi',
  },
  {
    name: 'Joghurt',
    brand: 'Milchzeit',
    barcode: '4012345678901',
    product_id: 'product-4',
    unit: 'package',
    quantity: 2,
    last_store_id: null,
    last_store_name: null,
  },
  {
    name: 'Äpfel',
    brand: null,
    barcode: null,
    product_id: null,
    unit: 'kg',
    quantity: 2,
    last_store_id: null,
    last_store_name: null,
  },
  {
    name: 'Reis',
    brand: null,
    barcode: null,
    product_id: null,
    unit: 'package',
    quantity: 1,
    last_store_id: null,
    last_store_name: null,
  },
];

describe('ShoppingProductSuggestions', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await i18n.changeLanguage('de');
    mockUseShoppingProductSuggestions.mockReturnValue({ data: suggestions });
  });

  it('zeigt Auswahlstatus, erweitert die Vorschläge und übergibt das Produkt', async () => {
    const user = userEvent.setup();
    const onSelect = jest.fn<void, [CatalogProduct, ShoppingProductSuggestion]>();

    await render(
      <ShoppingProductSuggestions
        userId="user-1"
        householdId="household-1"
        mode="recent"
        selectedName="Hafermilch"
        onSelect={onSelect}
      />,
    );

    const selectedSuggestion = screen.getByRole('button', { name: 'Hafermilch, 1 Packung' });
    expect(selectedSuggestion).toBeSelected();
    expect(selectedSuggestion).toHaveStyle({
      backgroundColor: colorsLight.backgroundSoft,
      borderColor: colorsLight.accent,
    });
    expect(screen.getByText('1 Packung')).toHaveStyle({ color: colorsLight.text });
    expect(screen.getByText('Zuletzt: Rewe')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Joghurt, 2 Packungen' })).not.toBeOnTheScreen();

    const showMore = screen.getByRole('button', { name: 'Weitere Vorschläge anzeigen' });
    expect(showMore).not.toBeExpanded();
    await user.press(showMore);

    expect(screen.getByRole('button', { name: 'Joghurt, 2 Packung' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Weniger Vorschläge anzeigen' })).toBeExpanded();

    await user.press(screen.getByRole('button', { name: 'Joghurt, 2 Packung' }));

    expect(onSelect).toHaveBeenCalledWith(
      {
        productId: 'product-4',
        barcode: '4012345678901',
        name: 'Joghurt',
        brand: 'Milchzeit',
        quantity: 2,
        unit: 'package',
        categoryTags: [],
      },
      suggestions[3],
    );
  });
});
