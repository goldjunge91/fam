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

  it('confirms corrected totals and item values instead of the OCR values', async () => {
    const onConfirm = jest.fn();
    const draft = parseGermanReceipt(REWE_RECEIPT_LINES);
    await render(
      <ReceiptReviewModal
        visible
        draft={draft}
        stores={[{ id: 'store-1', name: 'REWE' }]}
        onCancel={jest.fn()}
        onConfirm={onConfirm}
      />,
    );

    const user = userEvent.setup();
    await user.press(screen.getByRole('radio', { name: 'REWE' }));

    const totalInput = screen.getByLabelText('Gesamtsumme (EUR)');
    await user.clear(totalInput);
    await user.type(totalInput, '42,37');

    const [itemNameInput] = screen.getAllByLabelText('Artikelname');
    const [quantityInput] = screen.getAllByLabelText('Menge');
    const [lineTotalInput] = screen.getAllByLabelText('Preis (EUR)');
    if (!itemNameInput || !quantityInput || !lineTotalInput) {
      throw new Error('The first receipt item fields should be available for review.');
    }

    await user.clear(itemNameInput);
    await user.type(itemNameInput, 'Vollmilch bio');
    await user.clear(quantityInput);
    await user.type(quantityInput, '1,5');
    await user.clear(lineTotalInput);
    await user.type(lineTotalInput, '3,45');
    await user.press(screen.getByRole('button', { name: 'Kassenbon speichern' }));

    expect(onConfirm).toHaveBeenCalledWith(
      expect.objectContaining({
        totalCents: expect.objectContaining({ value: 4237, evidence: 'manual' }),
        items: expect.arrayContaining([
          expect.objectContaining({
            name: 'Vollmilch bio',
            quantity: 1.5,
            lineTotalCents: expect.objectContaining({ value: 345, evidence: 'manual' }),
          }),
        ]),
      }),
      'store-1',
      expect.objectContaining({ storeId: 'store-1' }),
    );
  });

  it('keeps an invalid total visible and does not confirm the receipt', async () => {
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
    const totalInput = screen.getByLabelText('Gesamtsumme (EUR)');
    await user.clear(totalInput);
    await user.type(totalInput, 'ungültig');
    await user.press(screen.getByRole('button', { name: 'Kassenbon speichern' }));

    expect(screen.getByRole('alert')).toBeOnTheScreen();
    expect(onConfirm).not.toHaveBeenCalled();
    expect(mockDebugLogEvent).toHaveBeenCalledWith('receipt.capture.save.button_pressed', {
      item_count: expect.any(Number),
      has_store: true,
    });
    expect(mockDebugLogEvent).toHaveBeenCalledWith(
      'receipt.capture.save.validation_failed',
      expect.objectContaining({ error_type: 'Error' }),
    );
  });

  it('logs visible add, remove, and cancel actions', async () => {
    const onCancel = jest.fn();
    const draft = parseGermanReceipt(REWE_RECEIPT_LINES);
    await render(
      <ReceiptReviewModal
        visible
        draft={draft}
        stores={[{ id: 'store-1', name: 'REWE' }]}
        onCancel={onCancel}
        onConfirm={jest.fn()}
      />,
    );

    const user = userEvent.setup();
    const newItemLabel = `Artikel ${draft.items.length + 1}`;
    await user.press(screen.getByRole('button', { name: 'Artikel hinzufügen' }));
    expect(screen.getByText(newItemLabel)).toBeOnTheScreen();
    expect(mockDebugLogEvent).toHaveBeenCalledWith('receipt.capture.button_pressed', {
      button: 'add_item',
    });

    const removeButtons = screen.getAllByRole('button', { name: 'Artikel entfernen' });
    expect(removeButtons).toHaveLength(draft.items.length + 1);
    const newItemRemoveButton = removeButtons.at(-1);
    if (!newItemRemoveButton) throw new Error('The added item should have a remove button.');
    await user.press(newItemRemoveButton);
    expect(mockDebugLogEvent).toHaveBeenCalledWith('receipt.capture.button_pressed', {
      button: 'remove_item',
      item_position: draft.items.length,
    });

    await user.press(screen.getByRole('button', { name: 'Abbrechen' }));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(mockDebugLogEvent).toHaveBeenCalledWith('receipt.capture.button_pressed', {
      button: 'cancel_review',
    });
  });
});
