import { createInventoryQuantityCorrectionMutation } from '@/lib/sync/inventory-quantity';
import { parseInventoryQuantityCorrectionPayload } from '@/lib/sync/inventory-quantity-correction';

describe('inventory quantity correction', () => {
  const payload = {
    operation_id: 'operation-1',
    transaction_id: 'transaction-1',
    item_id: 'item-1',
    household_id: 'household-1',
    expected_quantity: 1.1,
    new_quantity: 0.1,
    created_at: '2026-09-07T10:00:00.000Z',
  };

  it('validiert erwartete und neue Menge in Tausendsteln', () => {
    expect(parseInventoryQuantityCorrectionPayload(payload)).toEqual(payload);
    expect(() =>
      parseInventoryQuantityCorrectionPayload({ ...payload, new_quantity: 0.1001 }),
    ).toThrow('hoechstens drei Nachkommastellen');
  });

  it('schreibt Bestand und Ledger lokal in einer Outbox-Operation', async () => {
    const runAsync = jest.fn().mockResolvedValue({ changes: 1, lastInsertRowId: 1 });
    const mutation = createInventoryQuantityCorrectionMutation({
      payload,
      transaction: {
        id: 'transaction-1',
        household_id: 'household-1',
        fridge_item_id: 'item-1',
        type: 'out',
        quantity: 1,
      },
      nowMs: 1,
    });

    await mutation.applyLocally({ runAsync } as never);

    expect(mutation).toMatchObject({
      entity: 'fridge_items',
      entityId: 'item-1',
      op: 'correct_quantity',
      payload,
    });
    expect(runAsync).toHaveBeenCalledTimes(2);
  });
});
