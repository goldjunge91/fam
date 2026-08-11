import { getDatabase } from '@/lib/db/client';
import type { OpenFoodFactsProduct } from '@/lib/open-food-facts';
import type { useAddProductMutation } from './use-product-mutations';

type AddProductMutation = ReturnType<typeof useAddProductMutation>;

/**
 * Persistiert einen OFF-Treffer in `products` (#74), wenn er tatsaechlich
 * uebernommen wird — nicht schon bei der Auswahl im Dropdown/Scanner, sonst
 * wuerden auch verworfene Formulare Zeilen anlegen. Dedupe per
 * Barcode-Lookup VOR dem Enqueue: `enqueueMutation` kann kein Upsert, und
 * ein Race mit einem zweiten Client faengt der 23505-Fallback in push.ts.
 *
 * Gemeinsam genutzt von Vorrat- und Einkaufslisten-Formular, damit beide
 * dieselbe Nährwert-Verknüpfung (`product_id`) bekommen.
 */
export async function persistOffProductIfNeeded(
  product: OpenFoodFactsProduct,
  userId: string | undefined,
  addProductMutation: AddProductMutation,
): Promise<string | null> {
  if (!product.barcode || !userId) return null;
  const db = await getDatabase();
  const existing = await db.getFirstAsync<{ id: string }>(
    'select id from products where barcode = ?',
    [product.barcode],
  );
  if (existing) return existing.id;

  const created = await addProductMutation.mutateAsync({
    barcode: product.barcode,
    name: product.name,
    brand: product.brand ?? undefined,
    kcal_per_100: product.caloriesPer100g ?? undefined,
    protein_g_per_100: product.proteinsPer100g ?? undefined,
    carbs_g_per_100: product.carbsPer100g ?? undefined,
    fat_g_per_100: product.fatPer100g ?? undefined,
    sugar_g_per_100: product.sugarsPer100g ?? undefined,
    salt_g_per_100: product.saltPer100g ?? undefined,
    source: 'off',
    created_by: userId,
  });
  return created.id;
}
