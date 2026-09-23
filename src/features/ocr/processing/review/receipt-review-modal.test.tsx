import { render, screen, userEvent } from '@testing-library/react-native';
import { i18n } from '@/i18n';
import { REWE_RECEIPT_LINES } from '../domain/fixtures/german-receipts';
import { parseGermanReceipt } from '../domain/parser';
import { ReceiptReviewModal } from './receipt-review-modal';

jest.mock('@/lib/observability/debug-log', () => ({
  debugLogEvent: jest.fn(),
}));

const { debugLogEvent: mockDebugLogEvent } = jest.requireMock('@/lib/observability/debug-log') as {
  debugLogEvent: jest.Mock;
};

describe('ReceiptReviewModal', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('de');
    mockDebugLogEvent.mockClear();
  });

  it('shows an accessible error and blocks confirmation without a store selection', async () => {
    const onConfirm = jest.fn();
    await render(
      <ReceiptReviewModal
        visible
        draft={parseGermanReceipt(REWE_RECEIPT_LINES)}
        stores={[{ id: 'store-1', name: 'REWE' }]}
        onCancel={jest.fn()}
        onConfirm={onConfirm}
      />,
    );

    await userEvent.setup().press(screen.getByRole('button', { name: 'Kassenbon speichern' }));

    expect(screen.getByRole('alert')).toHaveTextContent('Wähle einen bestehenden Markt aus.');
    expect(mockDebugLogEvent).toHaveBeenCalledWith('receipt.capture.save.button_pressed', {
      item_count: expect.any(Number),
      has_store: false,
    });
    expect(mockDebugLogEvent).toHaveBeenCalledWith(
      'receipt.capture.save.validation_failed',
      expect.objectContaining({ error_type: 'Error' }),
    );
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('passes the explicitly selected existing store to confirmation', async () => {
    const onConfirm = jest.fn();
    await render(
      <ReceiptReviewModal
        visible
        draft={parseGermanReceipt(REWE_RECEIPT_LINES)}
        stores={[{ id: 'store-1', name: 'REWE' }]}
        onCancel={jest.fn()}
        onConfirm={onConfirm}
      />,
    );

    const user = userEvent.setup();
    await user.press(screen.getByRole('radio', { name: 'REWE' }));
    await user.press(screen.getByRole('button', { name: 'Kassenbon speichern' }));

    expect(onConfirm).toHaveBeenCalledWith(
      expect.anything(),
      'store-1',
      expect.objectContaining({ storeId: 'store-1' }),
    );
    expect(mockDebugLogEvent).toHaveBeenCalledWith('receipt.capture.button_pressed', {
      button: 'store_select',
    });
    expect(mockDebugLogEvent).toHaveBeenCalledWith('receipt.capture.save.button_pressed', {
      item_count: expect.any(Number),
      has_store: true,
    });
  });

  it('normalizes a German purchase date before confirmation', async () => {
    const onConfirm = jest.fn();
    await render(
      <ReceiptReviewModal
        visible
        draft={parseGermanReceipt(REWE_RECEIPT_LINES)}
        stores={[{ id: 'store-1', name: 'REWE' }]}
        onCancel={jest.fn()}
        onConfirm={onConfirm}
      />,
    );

    const user = userEvent.setup();
    await user.press(screen.getByRole('radio', { name: 'REWE' }));
    const dateInput = screen.getByLabelText('Datum');
    await user.clear(dateInput);
    await user.type(dateInput, '22.09.2026');
    await user.press(screen.getByRole('button', { name: 'Kassenbon speichern' }));

    expect(onConfirm).toHaveBeenCalledWith(
      expect.objectContaining({
        purchaseDate: expect.objectContaining({ value: '2026-09-22' }),
      }),
      'store-1',
      expect.objectContaining({ storeId: 'store-1' }),
    );
  });
});
