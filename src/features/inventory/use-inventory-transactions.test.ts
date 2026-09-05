import {
  filterTransactionsForProduct,
  groupTransactionsByDay,
  type LocalInventoryTransaction,
  transactionLabel,
  transactionReasonLabel,
} from './use-inventory-transactions';

function transaction(
  overrides: Partial<LocalInventoryTransaction> = {},
): LocalInventoryTransaction {
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
});
