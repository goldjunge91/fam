import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, userEvent, waitFor } from '@testing-library/react-native';

import { FrequentProductsQuickSelect } from '@/features/inventory/frequent-products-quick-select';
import type { ProductUsageRow } from '@/lib/db/product-usage';

const mockGetFrequentProductUsage = jest.fn<Promise<ProductUsageRow[]>, unknown[]>();

jest.mock('@/lib/db/client', () => ({
  getDatabase: async () => ({}),
}));

jest.mock('@/lib/db/product-usage', () => ({
  getFrequentProductUsage: (...args: unknown[]) => mockGetFrequentProductUsage(...args),
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

function row(overrides: Partial<ProductUsageRow>): ProductUsageRow {
  return {
    name: 'Milch',
    brand: null,
    barcode: null,
    product_id: null,
    unit: null,
    quantity: null,
    kcal: null,
    protein_g: null,
    carbs_g: null,
    fat_g: null,
    used_at: '2026-01-01T10:00:00.000Z',
    ...overrides,
  };
}

async function renderWithClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

beforeEach(() => {
  mockGetFrequentProductUsage.mockReset();
});

test('rendert nichts, solange kein Nutzer bekannt ist', async () => {
  mockGetFrequentProductUsage.mockResolvedValue([]);
  await renderWithClient(
    <FrequentProductsQuickSelect feature="fridge" userId={undefined} onSelectProduct={jest.fn()} />,
  );
  expect(mockGetFrequentProductUsage).not.toHaveBeenCalled();
});

test('rendert nichts, wenn es keine Nutzungshistorie gibt', async () => {
  mockGetFrequentProductUsage.mockResolvedValue([]);
  await renderWithClient(
    <FrequentProductsQuickSelect feature="fridge" userId="user-1" onSelectProduct={jest.fn()} />,
  );
  await waitFor(() => expect(mockGetFrequentProductUsage).toHaveBeenCalled());
  expect(screen.queryByText('Häufig verwendet')).not.toBeOnTheScreen();
});

test('sortiert nach Haeufigkeit — mehrfach verwendetes Produkt vor einmalig verwendetem', async () => {
  mockGetFrequentProductUsage.mockResolvedValue([
    row({ name: 'Butter', used_at: '2026-01-03T10:00:00.000Z' }),
    row({ name: 'Milch', used_at: '2026-01-02T10:00:00.000Z' }),
    row({ name: 'Milch', used_at: '2026-01-01T10:00:00.000Z' }),
  ]);
  await renderWithClient(
    <FrequentProductsQuickSelect feature="fridge" userId="user-1" onSelectProduct={jest.fn()} />,
  );

  await screen.findByText('Häufig verwendet');
  const chips = await screen.findAllByText(/Milch|Butter/);
  expect(chips.map((c) => c.props.children)).toEqual(['Milch', 'Butter']);
});

test('ein Tap auf einen Chip liefert das Produkt an onSelectProduct', async () => {
  mockGetFrequentProductUsage.mockResolvedValue([
    row({ name: 'Milch', unit: 'l', barcode: '123', brand: 'Test' }),
  ]);
  const onSelectProduct = jest.fn();
  await renderWithClient(
    <FrequentProductsQuickSelect
      feature="fridge"
      userId="user-1"
      onSelectProduct={onSelectProduct}
    />,
  );

  const chip = await screen.findByText('Milch');
  const user = userEvent.setup();
  await user.press(chip);

  expect(onSelectProduct).toHaveBeenCalledWith(
    expect.objectContaining({ name: 'Milch', unit: 'l', barcode: '123', brand: 'Test' }),
  );
});
