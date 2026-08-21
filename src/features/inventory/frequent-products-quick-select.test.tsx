import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, userEvent, waitFor } from '@testing-library/react-native';

import { FrequentProductsQuickSelect } from '@/features/inventory/frequent-products-quick-select';
import type { ProductUsageRow } from '@/lib/db/product-usage';

const mockGetFrequentProductUsage = jest.fn<Promise<ProductUsageRow[]>, unknown[]>();
let activeTestTrees: (() => Promise<void>)[] = [];

jest.mock('@/lib/db/client', () => ({
  getDatabase: async () => ({}),
}));

jest.mock('@/lib/db/product-usage', () => ({
  getFrequentProductUsage: (...args: unknown[]) => mockGetFrequentProductUsage(...args),
}));

jest.mock('@/hooks/use-theme', () => ({
  useTheme: () => require('@/constants/theme').Colors.light,
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
  const queryClient = new QueryClient({
    // Der produktive Standard-GC-Timer lebt nach dem Unmount weiter und haelt
    // dadurch den Jest-Prozess offen. Im isolierten Test-Client ist GC unnoetig.
    defaultOptions: { queries: { retry: false, gcTime: Number.POSITIVE_INFINITY } },
  });
  const result = await render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
  activeTestTrees.push(async () => {
    await result.unmount();
    queryClient.clear();
  });
}

beforeEach(() => {
  mockGetFrequentProductUsage.mockReset();
});

afterEach(async () => {
  for (const dispose of activeTestTrees) {
    await dispose();
  }
  activeTestTrees = [];
});

test('rendert nichts, solange kein Nutzer bekannt ist', async () => {
  mockGetFrequentProductUsage.mockResolvedValue([]);
  await renderWithClient(
    <FrequentProductsQuickSelect
      feature="fridge"
      userId={undefined}
      mode="frequent"
      onSelectProduct={jest.fn()}
    />,
  );
  expect(mockGetFrequentProductUsage).not.toHaveBeenCalled();
});

test('rendert nichts, wenn es keine Nutzungshistorie gibt', async () => {
  mockGetFrequentProductUsage.mockResolvedValue([]);
  await renderWithClient(
    <FrequentProductsQuickSelect
      feature="fridge"
      userId="user-1"
      mode="frequent"
      onSelectProduct={jest.fn()}
    />,
  );
  await waitFor(() => expect(mockGetFrequentProductUsage).toHaveBeenCalled());
  expect(screen.queryByText('Milch')).not.toBeOnTheScreen();
});

test('gibt den mode an die Abfrage weiter und zeigt die Zeilen in der gelieferten Reihenfolge', async () => {
  // Sortierung/Dedupe passiert seit dem Sheet-Redesign in SQL
  // (getFrequentProductUsage), die Komponente reicht nur noch durch — hier
  // liefert der Mock bereits "Milch vor Butter" wie es die echte SQL-Query
  // fuer mode: 'frequent' taete.
  mockGetFrequentProductUsage.mockResolvedValue([
    row({ name: 'Milch', used_at: '2026-01-02T10:00:00.000Z' }),
    row({ name: 'Butter', used_at: '2026-01-03T10:00:00.000Z' }),
  ]);
  await renderWithClient(
    <FrequentProductsQuickSelect
      feature="fridge"
      userId="user-1"
      mode="frequent"
      onSelectProduct={jest.fn()}
    />,
  );

  const chips = await screen.findAllByText(/Milch|Butter/);
  expect(chips.map((c) => c.props.children)).toEqual(['Milch', 'Butter']);
  expect(mockGetFrequentProductUsage).toHaveBeenCalledWith(
    expect.anything(),
    expect.objectContaining({ mode: 'frequent' }),
  );
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
      mode="frequent"
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
