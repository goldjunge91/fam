import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, userEvent } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import type { LocalProduct } from '@/features/inventory/use-product';
import type { CatalogProduct } from '@/features/product-search/types';

import { ProductInformation, type ProductInformationItem } from './product-information';

let mockLocalProduct: LocalProduct | null;
let mockOffProduct: CatalogProduct | null;
const mockFindByBarcode = jest.fn();

jest.mock('@/features/inventory/use-product', () => ({
  useProduct: () => ({ data: mockLocalProduct, isLoading: false }),
}));

jest.mock('@/features/product-search/sources/off-api-source', () => ({
  offApiSource: {
    findByBarcode: mockFindByBarcode,
  },
}));

const item: ProductInformationItem = {
  product_id: 'product-1',
  name: 'Haferdrink',
  quantity: 1,
  unit: 'l',
  expiry_date: '2026-10-31',
};

function createLocalProduct(): LocalProduct {
  return {
    id: 'product-1',
    barcode: '4000000000001',
    name: 'Haferdrink',
    brand: 'Fam',
    kcal_per_100: 42,
    protein_g_per_100: 1,
    carbs_g_per_100: 6,
    fat_g_per_100: 1.5,
    fiber_g_per_100: 0.8,
    sugar_g_per_100: 4,
    salt_g_per_100: 0.1,
    serving_size_g: 100,
    source: 'local',
  };
}

function createOffProduct(nutriScore?: CatalogProduct['nutriScore']): CatalogProduct {
  return {
    barcode: '4000000000001',
    name: 'Haferdrink',
    brand: 'Open Brand',
    caloriesPer100g: 42,
    proteinsPer100g: 1,
    carbsPer100g: 6,
    fatPer100g: 1.5,
    sugarsPer100g: 4,
    saltPer100g: 0.1,
    nutriScore,
    ingredients: 'Wasser, Hafer',
    allergens: ['Hafer'],
    categoryTags: [],
  };
}

async function renderSheet(onClose = jest.fn()) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Number.POSITIVE_INFINITY } },
  });
  queryClient.setQueryData(['open-food-facts-product', mockLocalProduct?.barcode], mockOffProduct);

  await render(
    <QueryClientProvider client={queryClient}>
      <SafeAreaProvider
        initialMetrics={{
          frame: { x: 0, y: 0, width: 390, height: 844 },
          insets: { top: 47, left: 0, right: 0, bottom: 34 },
        }}>
        <ProductInformation visible item={item} onClose={onClose} />
      </SafeAreaProvider>
    </QueryClientProvider>,
  );

  return onClose;
}

describe('ProductInformation', () => {
  beforeEach(() => {
    mockLocalProduct = createLocalProduct();
    mockOffProduct = createOffProduct('c');
    mockFindByBarcode.mockImplementation(async () => mockOffProduct);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('zeigt Produktdaten, Nutri-Score, Zutaten und Allergene aus Open Food Facts', async () => {
    await renderSheet();

    expect(await screen.findByText('Nutri-Score C')).toBeOnTheScreen();
    expect(screen.getByText('Open Brand')).toBeOnTheScreen();
    expect(screen.getByText('Wasser, Hafer')).toBeOnTheScreen();
    expect(screen.getByText('Hafer')).toBeOnTheScreen();
    expect(screen.getByText('Nährwerte pro 100 ml')).toBeOnTheScreen();
  });

  it('zeigt einen neutralen Fallback, wenn Open Food Facts keinen Nutri-Score liefert', async () => {
    mockOffProduct = createOffProduct();

    await renderSheet();

    expect(await screen.findByText('Nutri-Score –')).toBeOnTheScreen();
    expect(screen.getByText('Produktdaten von Open Food Facts')).toBeOnTheScreen();
    expect(screen.getByText('–')).toBeOnTheScreen();
  });

  it('ruft den Close-Callback über die sichtbare Schließen-Aktion auf', async () => {
    const onClose = await renderSheet();
    const user = userEvent.setup();

    await user.press(screen.getByRole('button', { name: 'Schließen' }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
