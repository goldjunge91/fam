import type { ForeignKeyViolationResolver } from '@/lib/db/entities';

const SYNC_COLUMNS = new Set(['updated_at', 'deleted_at', '_dirty']);

export const repairShoppingListItemForeignKeyViolation: ForeignKeyViolationResolver = async (
  { db, supabase },
  payload,
  error,
) => {
  const isFkError =
    error.code === '23503' ||
    error.message?.includes('shopping_list_items_store_id_fkey') ||
    error.message?.includes('shopping_list_items_product_id_fkey') ||
    error.message?.includes('foreign key');

  if (!isFkError) return null;

  let repairedPayload = { ...payload };
  let modified = false;

  const errorMessage = error.message ?? '';
  const affectsStore =
    errorMessage.includes('store_id') ||
    (!errorMessage.includes('product_id') && Boolean(payload.store_id));
  const affectsProduct =
    errorMessage.includes('product_id') ||
    (!errorMessage.includes('store_id') && Boolean(payload.product_id));

  // Store FK Reparatur
  if (affectsStore && payload.store_id) {
    const storeId = String(payload.store_id);
    const store = await db.getFirstAsync<Record<string, unknown>>(
      'select * from stores where id = ?',
      [storeId],
    );

    if (store) {
      try {
        const insertPayload = Object.fromEntries(
          Object.entries(store).filter(([key]) => !SYNC_COLUMNS.has(key)),
        );
        const res = await supabase
          .from('stores')
          .insert(insertPayload as never)
          .select();
        if (res.error && res.error.code !== '23505') {
          repairedPayload = { ...repairedPayload, store_id: null };
        }
        modified = true;
      } catch {
        repairedPayload = { ...repairedPayload, store_id: null };
        modified = true;
      }
    } else {
      repairedPayload = { ...repairedPayload, store_id: null };
      modified = true;
    }
  }

  // Product FK Reparatur
  if (affectsProduct && payload.product_id) {
    const productId = String(payload.product_id);
    const product = await db.getFirstAsync<Record<string, unknown>>(
      'select * from products where id = ?',
      [productId],
    );

    if (product) {
      try {
        const insertPayload = Object.fromEntries(
          Object.entries(product).filter(([key]) => !SYNC_COLUMNS.has(key)),
        );
        const res = await supabase
          .from('products')
          .insert(insertPayload as never)
          .select();
        if (res.error && res.error.code !== '23505') {
          repairedPayload = { ...repairedPayload, product_id: null };
        }
        modified = true;
      } catch {
        repairedPayload = { ...repairedPayload, product_id: null };
        modified = true;
      }
    } else {
      repairedPayload = { ...repairedPayload, product_id: null };
      modified = true;
    }
  }

  return modified ? repairedPayload : null;
};
