import {
  filterTransactionsForProduct,
  groupTransactionsByDay,
  isInventoryTransactionUndoable,
  type LocalInventoryTransaction,
  transactionLabel,
  transactionReasonLabel,
  transactionUndoLabel,
} from './use-inventory-transactions';

function transaction(
  overrides: Partial<LocalInventoryTransaction> = {},
): LocalInventoryTransaction & { operation_legs: number } {
  return {
    id: 'tx-1',
    household_id: 'household-1',
    fridge_item_id: 'lot-1',
    product_id: 'product-1',
    actor: 'user-1',
    type: 'out',
    quantity: 1,
    location_id: 'fridge',
    reason: null,
    previous_expiry_date: null,
    notes: null,
    undone: false,
    operation_legs: 0,
    created_at: '2026-09-04T10:00:00.000Z',
    ...overrides,
  };
}

describe('inventory transaction presentation helpers', () => {
  it('filters a product by product id and all its known lots', () => {
    const rows = [
      transaction({ id: 'product', product_id: 'product-1', fridge_item_id: 'other-lot' }),
      transaction({ id: 'lot', product_id: null, fridge_item_id: 'lot-1' }),
      transaction({ id: 'other', product_id: 'product-2', fridge_item_id: 'other-lot' }),
    ];

    expect(filterTransactionsForProduct(rows, 'product-1', new Set(['lot-1']))).toHaveLength(2);
  });

  it('vermischt Produkte ohne product_id nicht über null-Werte', () => {
    const rows = [
      transaction({ id: 'known-lot', product_id: null, fridge_item_id: 'lot-1' }),
      transaction({ id: 'other-null-product', product_id: null, fridge_item_id: 'lot-2' }),
    ];

    expect(filterTransactionsForProduct(rows, null, new Set(['lot-1']))).toEqual([rows[0]]);
  });

  it('groups rows into Heute, Gestern and calendar dates', () => {
    const now = new Date('2026-09-04T16:00:00.000Z');
    const groups = groupTransactionsByDay(
      [
        transaction({ id: 'today', created_at: '2026-09-04T10:00:00.000Z' }),
        transaction({ id: 'yesterday', created_at: '2026-09-03T10:00:00.000Z' }),
        transaction({ id: 'older', created_at: '2026-08-31T10:00:00.000Z' }),
      ],
      now,
    );

    expect(groups.map((group) => group.label)).toEqual(['Heute', 'Gestern', '31.08.2026']);
  });

  it('priorisiert den Verschwendungsgrund für die Verlaufszeile', () => {
    expect(transactionLabel(transaction({ type: 'waste', reason: 'spoiled' }))).toBe(
      'Schlecht geworden',
    );
    expect(transactionReasonLabel('expired')).toBe('Abgelaufen');
  });

  it.each(['in', 'out', 'waste', 'open'] as const)(
    'erlaubt Undo für %s innerhalb des 24-Stunden-Fensters',
    (type) => {
      expect(
        isInventoryTransactionUndoable(
          transaction({ type, created_at: '2026-09-04T15:00:00.000Z' }),
          new Date('2026-09-04T16:00:00.000Z'),
        ),
      ).toBe(true);
    },
  );

  it('zeigt für einen Move nur auf dem In-Leg eine Undo-Aktion', () => {
    const createdAt = '2026-09-04T15:00:00.000Z';
    expect(
      isInventoryTransactionUndoable(
        transaction({
          type: 'out',
          operation_id: 'move-1',
          operation_legs: 2,
          created_at: createdAt,
        }),
        new Date('2026-09-04T16:00:00.000Z'),
      ),
    ).toBe(false);
    expect(
      isInventoryTransactionUndoable(
        transaction({
          type: 'in',
          operation_id: 'move-1',
          operation_legs: 2,
          created_at: createdAt,
        }),
        new Date('2026-09-04T16:00:00.000Z'),
      ),
    ).toBe(true);
    expect(
      transactionUndoLabel(transaction({ type: 'in', operation_id: 'move-1', operation_legs: 2 })),
    ).toBe('Verschiebung rückgängig machen');
  });

  it('behandelt eine einzelne Mengenbuchung mit operation_id als normale Undo-Buchung', () => {
    const quantityOut = transaction({ type: 'out', operation_id: 'quantity-1', operation_legs: 1 });
    const quantityIn = transaction({ type: 'in', operation_id: 'quantity-2', operation_legs: 1 });

    expect(isInventoryTransactionUndoable(quantityOut, new Date('2026-09-04T16:00:00.000Z'))).toBe(
      true,
    );
    expect(transactionUndoLabel(quantityOut)).toBe('Verbrauch rückgängig machen');
    expect(transactionUndoLabel(quantityIn)).toBe('Einkauf rückgängig machen');
  });

  it('blendet abgelaufene, zukünftige und bereits reversal-verknüpfte Buchungen aus', () => {
    const now = new Date('2026-09-04T16:00:00.000Z');
    expect(
      isInventoryTransactionUndoable(transaction({ created_at: '2026-09-03T15:59:59.999Z' }), now),
    ).toBe(false);
    expect(
      isInventoryTransactionUndoable(transaction({ created_at: '2026-09-04T16:00:00.001Z' }), now),
    ).toBe(false);
    expect(isInventoryTransactionUndoable(transaction({ has_reversal: true }), now)).toBe(false);
    expect(isInventoryTransactionUndoable(transaction({ reversal_of: 'source-1' }), now)).toBe(
      false,
    );
  });
});
