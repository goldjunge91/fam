import { getTableConfig } from 'drizzle-orm/sqlite-core';

import { localDrizzleSchema } from './index';

describe('local SQLite schema registry', () => {
  it('builds metadata for every registered table and its constraints', () => {
    const tables = Object.values(localDrizzleSchema).map((table) => getTableConfig(table));
    const tableNames = tables.map(({ name }) => name);

    expect(tables).toHaveLength(34);
    expect(new Set(tableNames).size).toBe(34);
    expect(tables.every(({ columns }) => columns.length > 0)).toBe(true);
    for (const name of ['households', 'shopping_list_items', 'purchase_receipt_items', 'outbox']) {
      expect(tableNames).toContain(name);
    }

    const shoppingItems = tables.find(({ name }) => name === 'shopping_list_items');
    expect(shoppingItems?.checks.map(({ name }) => name)).toContain(
      'shopping_list_items_category_id_check',
    );
    expect(shoppingItems?.indexes.map(({ config }) => config.name)).toContain(
      'shopping_list_items_dirty_idx',
    );
  });
});
