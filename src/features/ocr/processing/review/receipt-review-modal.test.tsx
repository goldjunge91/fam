import { render, screen, userEvent } from '@testing-library/react-native';
import { i18n } from '@/i18n';
import { REWE_RECEIPT_LINES } from '../domain/fixtures/german-receipts';
import { parseGermanReceipt } from '../domain/parser';
import { ReceiptReviewModal } from './receipt-review-modal';

describe('ReceiptReviewModal', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('de');
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
  });
});
