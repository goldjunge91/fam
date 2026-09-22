import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react-native';
import { router } from 'expo-router';
import { i18n } from '@/i18n';
import { ReceiptDetailScreen } from './receipt-detail-screen';

const mockDeleteAsset = jest.fn();

jest.mock('expo-router', () => ({
  router: { back: jest.fn() },
  useLocalSearchParams: () => ({ receiptId: 'receipt-1' }),
}));

jest.mock('@/components/layout/screen', () => ({
  Screen: ({ children }: { children: React.ReactNode }) => children,
}));

jest.mock('@/features/household/active-household-provider', () => ({
  useActiveHousehold: () => ({ activeHouseholdId: 'household-1' }),
}));

jest.mock('@/features/ocr/authority/api', () => ({
  useReceipt: () => ({
    data: {
      id: 'receipt-1',
      household_id: 'household-1',
      store_id: 'store-1',
      store_name: 'EDEKA',
      purchase_date: '2026-09-21',
      currency: 'EUR',
      total_cents: 3914,
      processing_status: 'confirmed',
      created_by: 'user-1',
      confirmed_by: 'user-1',
      confirmed_at: '2026-09-21T10:00:00.000Z',
      created_at: '2026-09-21T09:00:00.000Z',
      updated_at: 0,
      deleted_at: null,
      _dirty: 0,
    },
    isLoading: false,
  }),
  useConfirmedReceiptItems: () => ({
    data: [
      {
        id: 'item-1',
        receipt_id: 'receipt-1',
        household_id: 'household-1',
        position: 0,
        name: 'Milch',
        product_id: 'product-1',
        product_name: 'Vollmilch',
        product_brand: 'Hausmarke',
        category_id: 'dairy',
        quantity: 2,
        unit: 'Stück',
        package_size: 1,
        package_size_unit: 'l',
        line_total_cents: 299,
        review_status: 'confirmed',
        created_at: '2026-09-21T09:00:00.000Z',
        updated_at: 0,
        deleted_at: null,
        _dirty: 0,
      },
    ],
    isLoading: false,
  }),
  useReceiptAssets: () => ({ data: [], isLoading: false, isError: false }),
  useDeleteReceiptAssetMutation: () => ({ mutateAsync: mockDeleteAsset }),
}));

describe('ReceiptDetailScreen', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('de');
  });

  it('zeigt vollständige Receipt- und Artikelpreise ohne Haushaltsfremde Daten', async () => {
    const queryClient = new QueryClient();
    await render(
      <QueryClientProvider client={queryClient}>
        <ReceiptDetailScreen />
      </QueryClientProvider>,
    );

    expect(screen.getByText('EDEKA')).toBeOnTheScreen();
    expect(screen.getByText('39,14 €')).toBeOnTheScreen();
    expect(screen.getByText('Milch')).toBeOnTheScreen();
    expect(screen.getByText('2 Stück · 1 l')).toBeOnTheScreen();
    expect(screen.getByText('2,99 €')).toBeOnTheScreen();
    expect(screen.getByText('Produkt: Vollmilch · Hausmarke')).toBeOnTheScreen();
    expect(screen.getByText('Kategorie: Milchprodukte & Eier')).toBeOnTheScreen();
    expect(screen.queryByText('anderer Haushalt')).not.toBeOnTheScreen();
  });

  it('zeigt bei fehlenden Assets einen ehrlichen Offline-Zustand', async () => {
    const queryClient = new QueryClient();
    await render(
      <QueryClientProvider client={queryClient}>
        <ReceiptDetailScreen />
      </QueryClientProvider>,
    );

    expect(screen.getByText('Keine Bonbilder verfügbar.')).toBeOnTheScreen();
    expect(mockDeleteAsset).not.toHaveBeenCalled();
    expect(router.back).not.toHaveBeenCalled();
  });
});
