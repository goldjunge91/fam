import type { SqlDatabase } from '@/lib/db/types';

type ProductStoreLookup = {
  householdId: string;
  productId?: string | null;
  barcode?: string | null;
  name?: string | null;
};

type StoreRow = { store_id: string | null };

async function findStore(
  db: SqlDatabase,
  sql: string,
  params: (string | null)[],
): Promise<string | null> {
  const row = await db.getFirstAsync<StoreRow>(sql, params);
  return row?.store_id ?? null;
}

/** Liefert den zuletzt verwendeten aktiven Markt fuer ein konkretes Produkt. */
export async function findLastStoreForProduct(
  db: SqlDatabase,
  input: ProductStoreLookup,
): Promise<string | null> {
  const productId = input.productId?.trim() || null;
  if (productId) {
    const storeId = await findStore(
      db,
      `select item.store_id
       from shopping_list_items item
       join stores store on store.id = item.store_id
       where item.household_id = ? and item.product_id = ?
         and item.store_id is not null and store.deleted_at is null
       order by item.updated_at desc
       limit 1`,
      [input.householdId, productId],
    );
    if (storeId) return storeId;
  }

  const barcode = input.barcode?.trim() || null;
  if (barcode) {
    const storeId = await findStore(
      db,
      `select item.store_id
       from shopping_list_items item
       join products product on product.id = item.product_id
       join stores store on store.id = item.store_id
       where item.household_id = ? and product.barcode = ?
         and item.store_id is not null and store.deleted_at is null
       order by item.updated_at desc
       limit 1`,
      [input.householdId, barcode],
    );
    if (storeId) return storeId;
  }

  const name = input.name?.trim() || null;
  if (!name) return null;

  return findStore(
    db,
    `select item.store_id
     from shopping_list_items item
     join stores store on store.id = item.store_id
     where item.household_id = ? and lower(trim(item.name)) = lower(trim(?))
       and item.store_id is not null and store.deleted_at is null
     order by item.updated_at desc
     limit 1`,
    [input.householdId, name],
  );
}
