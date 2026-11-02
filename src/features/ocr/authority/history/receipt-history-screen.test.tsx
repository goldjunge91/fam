import { act, render, screen, userEvent } from '@testing-library/react-native';
import { router } from 'expo-router';
import { i18n } from '@/i18n';
import type { PendingReceiptAssetUpload } from '../../capture/api';
import type { LocalReceiptRow } from '../api';
import { ReceiptHistoryScreen } from './receipt-history-screen';

jest.mock('expo-router', () => ({
  router: { push: jest.fn() },
}));

jest.mock('@/lib/observability/debug-log', () => ({
  debugLogEvent: jest.fn(),
}));

const { debugLogEvent: mockDebugLogEvent } = jest.requireMock('@/lib/observability/debug-log') as {
  debugLogEvent: jest.Mock;
};

const mockHistoryQuery: {
  current: { data: LocalReceiptRow[] | undefined; isLoading: boolean; isError: boolean };
} = {
  current: {
    data: [
      {
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
    ],
    isLoading: false,
    isError: false,
  },
};
const mockPendingUpload: { current: { data: PendingReceiptAssetUpload | undefined } } = {
  current: { data: { receiptId: 'receipt-1', pageCount: 1, updatedAt: '', errorMessage: null } },
};

jest.mock('@/components/layout/screen', () => ({
  Screen: ({ children }: { children: React.ReactNode }) => children,
}));

jest.mock('@/features/household/active-household-provider', () => ({
  useActiveHousehold: () => ({ activeHouseholdId: 'household-1' }),
}));

jest.mock('@/features/auth/session-provider', () => ({
  useSession: () => ({ session: { user: { id: 'user-1' } } }),
}));

jest.mock('@/features/ocr/capture/api', () => ({
  usePendingReceiptAssetUpload: () => mockPendingUpload.current,
}));

jest.mock('@/features/ocr/authority/api', () => ({
  useConfirmedReceipts: () => mockHistoryQuery.current,
}));

describe('ReceiptHistoryScreen', () => {
  async function renderAfterListLayout() {
    const screenRender = await render(<ReceiptHistoryScreen />);
    await act(async () => {
      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => resolve());
      });
    });
    return screenRender;
  }

  beforeEach(async () => {
    await i18n.changeLanguage('de');
    jest.mocked(router.push).mockClear();
    mockDebugLogEvent.mockClear();
    mockHistoryQuery.current = {
      data: [
        {
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
      ],
      isLoading: false,
      isError: false,
    };
    mockPendingUpload.current = {
      data: { receiptId: 'receipt-1', pageCount: 1, updatedAt: '', errorMessage: null },
    };
  });

  it('zeigt Markt, Kaufdatum und Gesamtsumme und öffnet die stabile Receipt-Route', async () => {
    await renderAfterListLayout();

    expect(screen.getByText('EDEKA')).toBeOnTheScreen();
    expect(screen.getByText('39,14 €')).toBeOnTheScreen();
    expect(screen.getByText('Bilder warten auf Upload')).toBeOnTheScreen();

    const user = userEvent.setup();
    await user.press(screen.getByRole('button', { name: /EDEKA/ }));

    expect(router.push).toHaveBeenCalledWith('/household/receipt/receipt-1');
    expect(mockDebugLogEvent).toHaveBeenCalledWith('receipt.history.button_pressed', {
      button: 'open_receipt',
    });

    const logOrder = mockDebugLogEvent.mock.invocationCallOrder.at(0);
    const routeOrder = jest.mocked(router.push).mock.invocationCallOrder.at(0);
    expect(logOrder).toBeDefined();
    expect(routeOrder).toBeDefined();
    if (logOrder === undefined || routeOrder === undefined) {
      throw new Error('Opening a receipt should log the action and navigate.');
    }
    expect(logOrder).toBeLessThan(routeOrder);
  });

  it('zeigt Lade-, Fehler- und Leerzustand der Historie', async () => {
    mockHistoryQuery.current = { data: undefined, isLoading: true, isError: false };
    await renderAfterListLayout();
    expect(screen.getByText('Wird geladen…')).toBeOnTheScreen();

    mockHistoryQuery.current = { data: undefined, isLoading: false, isError: true };
    await renderAfterListLayout();
    expect(screen.getByText('Die Bon-Historie konnte nicht geladen werden.')).toBeOnTheScreen();

    mockHistoryQuery.current = { data: [], isLoading: false, isError: false };
    await renderAfterListLayout();
    expect(screen.getByText('Noch keine bestätigten Bons.')).toBeOnTheScreen();
  });

  it('zeigt Ersatztexte, wenn Bonangaben fehlen und kein Upload offen ist', async () => {
    mockPendingUpload.current = { data: undefined };
    mockHistoryQuery.current = {
      data: [
        {
          id: 'receipt-empty-fields',
          household_id: 'household-1',
          store_id: null,
          store_name: null,
          purchase_date: null,
          currency: 'EUR',
          total_cents: null,
          processing_status: 'confirmed',
          created_by: 'user-1',
          confirmed_by: 'user-1',
          confirmed_at: '2026-09-21T10:00:00.000Z',
          created_at: '2026-09-21T09:00:00.000Z',
          updated_at: 0,
          deleted_at: null,
          _dirty: 0,
        },
      ],
      isLoading: false,
      isError: false,
    };

    await renderAfterListLayout();

    expect(screen.getByText('Markt unbekannt')).toBeOnTheScreen();
    expect(screen.getByText('Kaufdatum unbekannt')).toBeOnTheScreen();
    expect(screen.getByText('Summe unbekannt')).toBeOnTheScreen();
    expect(screen.queryByText('Bilder warten auf Upload')).not.toBeOnTheScreen();
  });
});
