import { parseInventorySplitPayload } from '@/lib/sync/inventory-open-split';
import { createInventorySplitMutation } from '@/lib/sync/inventory-quantity';

describe('inventory open split', () => {
  const payload = {
    transaction_id: 'transaction-1',
    source_item_id: 'source-1',
    opened_item_id: 'opened-1',
    household_id: 'household-1',
    expected_source_quantity: 5,
    open_quantity: 1,
    opened_at: '2026-09-07T10:00:00.000Z',
    new_expiry_date: '2026-09-10',
    expiry_user_set: true,
    created_at: '2026-09-07T10:00:00.000Z',
  };

  it('validiert Ausgangs- und Öffnungsmenge in Tausendsteln', () => {
    expect(parseInventorySplitPayload(payload)).toEqual(payload);
    expect(() => parseInventorySplitPayload({ ...payload, open_quantity: 6 })).toThrow(
      'höchstens die Ausgangsmenge',
    );
    expect(() => parseInventorySplitPayload({ ...payload, open_quantity: 0 })).toThrow(
      'größer als 0',
    );
  });

  it('weist identische Quell- und Ziel-IDs zurueck', () => {
    expect(() =>
      parseInventorySplitPayload({ ...payload, opened_item_id: payload.source_item_id }),
    ).toThrow('zwei unterschiedliche Bestands-IDs');
  });

  it('schreibt Rest-Los, geoeffnetes Los und Ledger lokal in einer Outbox-Operation', async () => {
    const runAsync = jest.fn().mockResolvedValue({ changes: 1, lastInsertRowId: 1 });
    const mutation = createInventorySplitMutation({
      payload,
      openedItem: { id: 'opened-1', household_id: 'household-1', quantity: 1 },
      transaction: {
        id: 'transaction-1',
        household_id: 'household-1',
        fridge_item_id: 'opened-1',
        type: 'open',
        quantity: 1,
      },
      nowMs: 1,
    });

    await mutation.applyLocally({ runAsync } as never);

    expect(mutation).toMatchObject({
      entity: 'fridge_items',
      entityId: 'source-1',
      op: 'split_open',
      payload,
    });
    expect(runAsync).toHaveBeenCalledTimes(3);
  });

  it('loescht das Rest-Los weich, wenn die Öffnungsmenge alles verbraucht', async () => {
    const runAsync = jest.fn().mockResolvedValue({ changes: 1, lastInsertRowId: 1 });
    const mutation = createInventorySplitMutation({
      payload: { ...payload, expected_source_quantity: 1, open_quantity: 1 },
      openedItem: { id: 'opened-1', household_id: 'household-1', quantity: 1 },
      transaction: {
        id: 'transaction-1',
        household_id: 'household-1',
        fridge_item_id: 'opened-1',
        type: 'open',
        quantity: 1,
      },
      nowMs: 1,
    });

    await mutation.applyLocally({ runAsync } as never);
    expect(runAsync).toHaveBeenCalledTimes(3);
    expect(runAsync.mock.calls[0]?.[0]).toEqual(expect.stringContaining('deleted_at'));
  });
});
