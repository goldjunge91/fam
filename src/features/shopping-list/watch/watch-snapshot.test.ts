import type { LocalShoppingItem } from '../hooks/use-shopping-list';
import { createWatchShoppingSnapshot } from './watch-snapshot-contract';

function makeItem(overrides: Partial<LocalShoppingItem> = {}): LocalShoppingItem {
  return {
    id: 'item-1',
    household_id: 'household-1',
    product_id: null,
    name: 'Hafermilch',
    quantity: 2,
    unit: 'l',
    package_size: null,
    package_size_unit: null,
    category_id: 'beverages',
    category_source: 'name_fallback',
    category_classifier_version: null,
    category: 'Getränke',
    store_id: 'store-1',
    price_estimate: null,
    recipe_names: [],
    checked_at: null,
    checked_by: null,
    sort_index: 0,
    created_at: '2026-09-28T08:00:00.000Z',
    updated_at: '2026-09-28T08:00:00.000Z',
    ...overrides,
  };
}

describe('createWatchShoppingSnapshot', () => {
  it('maps the local shopping list into the watch contract', () => {
    const snapshot = createWatchShoppingSnapshot(
      [
        makeItem({ id: 'milk', name: 'Milch', quantity: 2, unit: 'l' }),
        makeItem({
          id: 'bread',
          name: 'Brot',
          category: null,
          checked_at: '2026-09-28T09:00:00.000Z',
        }),
      ],
      'REWE',
    );

    expect(snapshot.storeName).toBe('REWE');
    expect(snapshot.items).toEqual([
      {
        id: 'milk',
        name: 'Milch',
        quantityLabel: '2 l',
        category: 'Getränke',
        isChecked: false,
      },
      {
        id: 'bread',
        name: 'Brot',
        quantityLabel: '2 l',
        category: 'Sonstiges',
        isChecked: true,
      },
    ]);
    expect(snapshot.updatedAt).toEqual(expect.any(String));
  });

  it('preserves an empty store selection and an empty list', () => {
    expect(createWatchShoppingSnapshot([], null)).toMatchObject({
      storeName: null,
      items: [],
    });
  });
});
