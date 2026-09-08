import { mapFridgeItemRow } from '@/features/inventory/use-inventory-items';

function rawRow(overrides: Partial<Parameters<typeof mapFridgeItemRow>[0]> = {}) {
  return {
    id: 'item-1',
    household_id: 'household-1',
    location_id: 'loc-1',
    product_id: null,
    name: 'Milch',
    quantity: 1.5,
    unit: 'l',
    package_size: 1,
    package_size_unit: 'l',
    expiry_date: null,
    opened_at: null,
    vacuum_sealed: false,
    expiry_user_set: false,
    added_by: null,
    created_at: '2026-09-08T00:00:00.000Z',
    updated_at: null,
    location_kind: 'fridge',
    location_name: 'Kuehlschrank',
    ...overrides,
  };
}

describe('mapFridgeItemRow (Persistenz-/View-Grenze fridge_items)', () => {
  it('gibt Mengen unveraendert durch, solange fridge_items.quantity/package_size dezimal gespeichert sind', () => {
    const item = mapFridgeItemRow(rawRow({ quantity: 1.5, package_size: 0.5 }));

    expect(item.quantity).toBe(1.5);
    expect(item.package_size).toBe(0.5);
  });

  it('behandelt package_size: null unveraendert', () => {
    const item = mapFridgeItemRow(rawRow({ package_size: null }));

    expect(item.package_size).toBeNull();
  });

  it('reicht alle uebrigen Felder unveraendert durch', () => {
    const row = rawRow();
    const item = mapFridgeItemRow(row);

    expect(item).toEqual(row);
  });
});
