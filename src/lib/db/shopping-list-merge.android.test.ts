import {
  applyLocalSchema,
  createTestDatabase,
  type TestDatabase,
} from '../../../test/node-sqlite-adapter';
import { addOrMergeShoppingItem } from './shopping-list-merge.android';

type ShoppingItemRow = {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  package_size_unit: string | null;
  sort_index: number;
  recipe_names: string;
  category_id: string | null;
  category_source: string | null;
  category_classifier_version: string | null;
};

describe('Android shopping-list merge', () => {
  let db: TestDatabase;
  let nextId: number;

  beforeEach(async () => {
    db = createTestDatabase();
    await applyLocalSchema(db);
    nextId = 1;
  });

  afterEach(() => {
    db.close();
  });

  function add(input: Parameters<typeof addOrMergeShoppingItem>[2]) {
    return addOrMergeShoppingItem(db, `item-${nextId++}`, input);
  }

  async function readItems() {
    return db.getAllAsync<ShoppingItemRow>(
      `select id, name, quantity, unit, package_size_unit, sort_index, recipe_names,
              category_id, category_source, category_classifier_version
       from shopping_list_items where household_id = ? and deleted_at is null order by sort_index`,
      ['hh-1'],
    );
  }

  test('inserts a normalized item when no matching product or name exists', async () => {
    await expect(
      add({
        household_id: 'hh-1',
        name: 'Hafermilch',
        quantity: 2,
        unit: 'Liter',
        package_size: 1000,
        package_size_unit: 'Milliliter',
        recipe_names: ['Porridge'],
      }),
    ).resolves.toBe('item-1');

    await expect(readItems()).resolves.toEqual([
      expect.objectContaining({
        id: 'item-1',
        name: 'Hafermilch',
        quantity: 2,
        unit: 'l',
        package_size_unit: 'ml',
        sort_index: 0,
        recipe_names: '["Porridge"]',
      }),
    ]);
  });

  test('merges quantities, recipe names, and keeps the strongest category source', async () => {
    const productId = 'prod-mehl';
    await add({
      household_id: 'hh-1',
      name: 'Mehl',
      quantity: 1,
      unit: 'kg',
      product_id: productId,
      category_id: 'produce',
      category_source: 'name_fallback',
      category_classifier_version: 'v1',
      recipe_names: ['Brot', 'Kuchen'],
    });
    await add({
      household_id: 'hh-1',
      name: 'Mehl',
      quantity: 0.5,
      unit: 'kg',
      product_id: productId,
      category_id: 'baking',
      category_source: 'user',
      category_classifier_version: 'v2',
      recipe_names: ['Kuchen', 'Porridge'],
    });
    await add({
      household_id: 'hh-1',
      name: 'Mehl',
      quantity: 1,
      unit: 'kg',
      product_id: productId,
      category_id: 'produce',
      category_source: 'name_fallback',
      category_classifier_version: 'v3',
      recipe_names: ['Brot', 'Muffins'],
    });

    await expect(readItems()).resolves.toEqual([
      expect.objectContaining({
        id: 'item-1',
        quantity: 2.5,
        recipe_names: '["Brot","Kuchen","Porridge","Muffins"]',
        category_id: 'baking',
        category_source: 'user',
        category_classifier_version: 'v2',
      }),
    ]);
  });
});
