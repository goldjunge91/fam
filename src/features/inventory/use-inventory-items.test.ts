import { mapFridgeItemRow } from '@/features/inventory/use-inventory-items';

function rawRow(overrides: Partial<Parameters<typeof mapFridgeItemRow>[0]> = {}) {
  return {
    id: 'item-1',
    household_id: 'household-1',
    location_id: 'loc-1',
    product_id: null,
    name: 'Milch',
    quantity: 1500,
    unit: 'l',
    package_size: 1000,
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
  it('konvertiert quantity/package_size von Integer-Tausendsteln auf Dezimal (fam-lem.30.7.2)', () => {
    const item = mapFridgeItemRow(rawRow({ quantity: 1500, package_size: 500 }));

    expect(item.quantity).toBe(1.5);
    expect(item.package_size).toBe(0.5);
  });

  it('behandelt package_size: null unveraendert', () => {
    const item = mapFridgeItemRow(rawRow({ package_size: null }));

    expect(item.package_size).toBeNull();
  });

  it('reicht alle uebrigen Felder unveraendert durch und konvertiert nur quantity/package_size', () => {
    const row = rawRow();
    const item = mapFridgeItemRow(row);

    expect(item).toEqual({ ...row, quantity: 1.5, package_size: 1 });
  });

  it('konvertiert SQLite-Integer-Werte (1/0) fuer vacuum_sealed und expiry_user_set in echte Booleans', () => {
    const itemWithOnes = mapFridgeItemRow(
      rawRow({
        vacuum_sealed: 1 as unknown as boolean,
        expiry_user_set: 1 as unknown as boolean,
      }),
    );
    expect(itemWithOnes.vacuum_sealed).toBe(true);
    expect(itemWithOnes.expiry_user_set).toBe(true);

    const itemWithZeros = mapFridgeItemRow(
      rawRow({
        vacuum_sealed: 0 as unknown as boolean,
        expiry_user_set: 0 as unknown as boolean,
      }),
    );
    expect(itemWithZeros.vacuum_sealed).toBe(false);
    expect(itemWithZeros.expiry_user_set).toBe(false);
  });
});
