import { parseInventoryMergeUndoPayload } from '@/lib/sync/inventory-open-merge';
import { createInventoryMergeUndoMutation } from '@/lib/sync/inventory-quantity';

describe('inventory open merge-undo', () => {
  const payload = {
    reversal_transaction_id: 'reversal-1',
    reversal_of: 'original-1',
    household_id: 'household-1',
    created_at: '2026-09-07T10:05:00.000Z',
    notes: '[Undone] Öffnung rückgängig gemacht',
    opened_item_id: 'opened-1',
  };

  it('validiert alle Pflichtfelder', () => {
    expect(parseInventoryMergeUndoPayload(payload)).toEqual(payload);
    expect(() => parseInventoryMergeUndoPayload({ ...payload, notes: '' })).toThrow(
      'kein gueltiges Feld notes',
    );
    expect(() => parseInventoryMergeUndoPayload({ ...payload, opened_item_id: '' })).toThrow(
      'kein gueltiges Feld opened_item_id',
    );
  });

  it('schreibt versiegeltes Los, geoeffnetes Los und Gegenbuchung lokal in einer Outbox-Operation', async () => {
    const runAsync = jest.fn().mockResolvedValue({ changes: 1, lastInsertRowId: 1 });
    const mutation = createInventoryMergeUndoMutation({
      payload,
      sealedItemId: 'sealed-1',
      sealedQuantityAfterMerge: 5,
      openedItemId: 'opened-1',
      transaction: {
        id: 'reversal-1',
        household_id: 'household-1',
        fridge_item_id: 'sealed-1',
        type: 'open',
        quantity: 1,
        reversal_of: 'original-1',
      },
      nowMs: 1,
    });

    await mutation.applyLocally({ runAsync } as never);

    expect(mutation).toMatchObject({
      entity: 'fridge_items',
      entityId: 'sealed-1',
      op: 'merge_undo_open',
      payload,
    });
    expect(runAsync).toHaveBeenCalledTimes(3);
  });
});
