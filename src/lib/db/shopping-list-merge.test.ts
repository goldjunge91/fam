import {
  applyLocalSchema,
  createTestDatabase,
  type TestDatabase,
} from '../../../test/node-sqlite-adapter';
import { addOrMergeShoppingItem } from './shopping-list-merge';

describe('shopping-list merge without a product id', () => {
  let db: TestDatabase;

  beforeEach(async () => {
    db = createTestDatabase();
    await applyLocalSchema(db);
  });

  afterEach(() => db.close());

  it('merges active items by normalized name and unit', async () => {
    await expect(
      addOrMergeShoppingItem(db, 'item-1', {
        household_id: 'hh-1',
        name: 'Hafermilch',
        quantity: 1,
        unit: 'Liter',
      }),
    ).resolves.toBe('item-1');

    await expect(
      addOrMergeShoppingItem(db, 'item-2', {
        household_id: 'hh-1',
        name: ' hafermilch ',
        quantity: 2,
        unit: 'l',
      }),
    ).resolves.toBe('item-1');

    await expect(
      db.getFirstAsync<{ quantity: number; name: string }>(
        'select quantity, name from shopping_list_items where id = ?',
        ['item-1'],
      ),
    ).resolves.toEqual({ quantity: 3, name: 'Hafermilch' });
  });
});
