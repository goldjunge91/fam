import { createInventoryQuantityReversalMutation } from '@/lib/sync/inventory-quantity';
import { parseInventoryQuantityReversalPayload } from '@/lib/sync/inventory-quantity-reversal';

describe('inventory quantity reversal', () => {
  const payload = {
    reversal_transaction_id: 'reversal-1',
    reversal_of: 'source-1',
    item_id: 'item-1',
    household_id: 'household-1',
    created_at: '2026-09-07T10:00:00.000Z',
    notes: '[Undone] Gegenbuchung',
  };

  it('fordert eine stabile Reversal-ID und Provenienz', () => {
    expect(parseInventoryQuantityReversalPayload(payload)).toEqual(payload);
    expect(() => parseInventoryQuantityReversalPayload({ ...payload, reversal_of: '' })).toThrow(
      'reversal_of',
    );
  });

  it('schreibt Bestandsänderung und Gegenbuchung lokal in einer Operation', async () => {
    const runAsync = jest.fn().mockResolvedValue({ changes: 1, lastInsertRowId: 1 });
    const mutation = createInventoryQuantityReversalMutation({
      payload,
      transaction: {
        id: 'reversal-1',
        household_id: 'household-1',
        fridge_item_id: 'item-1',
        type: 'in',
        quantity: 1,
        reversal_of: 'source-1',
      },
      resultQuantity: 2,
      restore: false,
      nowMs: 1,
    });

    await mutation.applyLocally({ runAsync } as never);

    expect(mutation).toMatchObject({
      entity: 'fridge_items',
      entityId: 'item-1',
      op: 'reverse_quantity',
      payload,
    });
    expect(runAsync).toHaveBeenCalledTimes(2);
  });
});
