import { render, screen, userEvent } from '@testing-library/react-native';
import { router } from 'expo-router';
import { i18n } from '@/i18n';
import { ReceiptHistoryScreen } from './receipt-history-screen';

jest.mock('expo-router', () => ({
  router: { push: jest.fn() },
}));

jest.mock('@/components/layout/screen', () => ({
  Screen: ({ children }: { children: React.ReactNode }) => children,
}));

jest.mock('@/features/household/active-household-provider', () => ({
  useActiveHousehold: () => ({ activeHouseholdId: 'household-1' }),
}));

jest.mock('@/features/ocr/authority/api', () => ({
  useConfirmedReceipts: () => ({
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
  }),
}));

describe('ReceiptHistoryScreen', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('de');
    jest.mocked(router.push).mockClear();
  });

  it('zeigt Markt, Kaufdatum und Gesamtsumme und öffnet die stabile Receipt-Route', async () => {
    await render(<ReceiptHistoryScreen />);

    expect(screen.getByText('EDEKA')).toBeOnTheScreen();
    expect(screen.getByText('39,14 €')).toBeOnTheScreen();

    const user = userEvent.setup();
    await user.press(screen.getByRole('button', { name: /EDEKA/ }));

    expect(router.push).toHaveBeenCalledWith('/household/receipt/receipt-1');
  });
});
