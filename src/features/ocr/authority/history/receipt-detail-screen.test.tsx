import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, userEvent, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import { Alert } from 'react-native';
import { i18n } from '@/i18n';
import { ReceiptDetailScreen } from './receipt-detail-screen';

const mockDeleteAsset = jest.fn();
const mockDeleteReceipt = jest.fn();

jest.mock('@/lib/observability/debug-log', () => ({
  debugLogEvent: jest.fn(),
}));

const { debugLogEvent: mockDebugLogEvent } = jest.requireMock('@/lib/observability/debug-log') as {
  debugLogEvent: jest.Mock;
};

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
  useDeleteReceiptMutation: () => ({ mutateAsync: mockDeleteReceipt, isPending: false }),
}));

describe('ReceiptDetailScreen', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('de');
    mockDeleteReceipt.mockResolvedValue(undefined);
    mockDebugLogEvent.mockClear();
    jest.spyOn(Alert, 'alert').mockImplementation((_title, _message, buttons) => {
      buttons?.find((button) => button.style === 'destructive')?.onPress?.();
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
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

  it('löscht den strukturierten Bon nach Bestätigung und kehrt zur Historie zurück', async () => {
    const queryClient = new QueryClient();
    await render(
      <QueryClientProvider client={queryClient}>
        <ReceiptDetailScreen />
      </QueryClientProvider>,
    );

    const user = userEvent.setup();
    await user.press(screen.getByRole('button', { name: 'Bon löschen' }));

    await waitFor(() =>
      expect(mockDeleteReceipt).toHaveBeenCalledWith({
        householdId: 'household-1',
        receiptId: 'receipt-1',
      }),
    );
    expect(mockDebugLogEvent).toHaveBeenCalledWith('receipt.history.delete.button_pressed', {
      receipt_id: 'receipt-1',
    });
    expect(mockDebugLogEvent).toHaveBeenCalledWith('receipt.history.delete.started', {
      receipt_id: 'receipt-1',
    });
    expect(mockDebugLogEvent).toHaveBeenCalledWith('receipt.history.delete.completed', {
      receipt_id: 'receipt-1',
    });
    expect(router.back).toHaveBeenCalled();
  });
});
