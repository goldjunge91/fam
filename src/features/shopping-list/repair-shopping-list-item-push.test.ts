import { MIGRATIONS } from '@/lib/db/migrations';
import { runMigrations } from '@/lib/db/migrator';
import type { TypedSupabaseClient } from '@/lib/supabase';
import { createTestDatabase, type TestDatabase } from '../../../test/node-sqlite-adapter';
import { repairShoppingListItemForeignKeyViolation } from './repair-shopping-list-item-push';

function fakeSupabase(insertResponse: { error: { message: string; code?: string } | null }) {
  const select = jest.fn().mockResolvedValue(insertResponse);
  const insert = jest.fn().mockReturnValue({ select });
  const from = jest.fn().mockReturnValue({ insert });
  return { client: { from } as unknown as TypedSupabaseClient, from, insert };
}

const fkStoreError = {
  code: '23503',
  message:
    'insert or update on table "shopping_list_items" violates foreign key constraint "shopping_list_items_store_id_fkey"',
};

const fkProductError = {
  code: '23503',
  message:
    'insert or update on table "shopping_list_items" violates foreign key constraint "shopping_list_items_product_id_fkey"',
};

describe('repairShoppingListItemForeignKeyViolation', () => {
  let db: TestDatabase;

  beforeEach(async () => {
    db = createTestDatabase();
    await runMigrations(db, MIGRATIONS);
  });

  afterEach(() => db.close());

  it('gibt null zurueck, wenn der Fehler keine FK-Verletzung ist', async () => {
    const { client } = fakeSupabase({ error: null });
    const result = await repairShoppingListItemForeignKeyViolation(
      { db, supabase: client },
      { id: 'item-1', store_id: 'store-1' },
      { code: '23505', message: 'duplicate key' },
    );
    expect(result).toBeNull();
  });

  it('pusht den lokal vorhandenen Store nach und liefert den unveraenderten Payload', async () => {
    await db.runAsync(
      'insert into stores (id, household_id, name, color, sort_order, category_order, created_at, updated_at) values (?, ?, ?, ?, ?, ?, ?, ?)',
      ['store-1', 'hh-1', 'Supermarkt', '#ff0000', 0, '[]', '2026-01-01T00:00:00Z', 0],
    );
    const { client, from, insert } = fakeSupabase({ error: null });
    const payload = { id: 'item-1', store_id: 'store-1', name: 'Brot' };

    const result = await repairShoppingListItemForeignKeyViolation(
      { db, supabase: client },
      payload,
      fkStoreError,
    );

    expect(from).toHaveBeenCalledWith('stores');
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'store-1', name: 'Supermarkt' }),
    );
    expect(result).toEqual(payload);
  });

  it('setzt store_id auf null, wenn der Store lokal nicht existiert', async () => {
    const { client } = fakeSupabase({ error: null });
    const payload = { id: 'item-1', store_id: 'store-missing', name: 'Brot' };

    const result = await repairShoppingListItemForeignKeyViolation(
      { db, supabase: client },
      payload,
      fkStoreError,
    );

    expect(result).toEqual({ ...payload, store_id: null });
  });

  it('pusht das lokal vorhandene Product nach und liefert den unveraenderten Payload', async () => {
    await db.runAsync(
      'insert into products (id, name, created_at, updated_at) values (?, ?, ?, ?)',
      ['prod-1', 'Milch 3.5%', '2026-01-01T00:00:00Z', 0],
    );
    const { client, from, insert } = fakeSupabase({ error: null });
    const payload = { id: 'item-1', product_id: 'prod-1', name: 'Milch' };

    const result = await repairShoppingListItemForeignKeyViolation(
      { db, supabase: client },
      payload,
      fkProductError,
    );

    expect(from).toHaveBeenCalledWith('products');
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'prod-1', name: 'Milch 3.5%' }),
    );
    expect(result).toEqual(payload);
  });

  it('setzt product_id auf null, wenn das Product lokal nicht existiert', async () => {
    const { client } = fakeSupabase({ error: null });
    const payload = { id: 'item-1', product_id: 'prod-missing', name: 'Milch' };

    const result = await repairShoppingListItemForeignKeyViolation(
      { db, supabase: client },
      payload,
      fkProductError,
    );

    expect(result).toEqual({ ...payload, product_id: null });
  });
});
