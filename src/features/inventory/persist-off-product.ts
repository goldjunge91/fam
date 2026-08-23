import { getDatabase } from '@/lib/db/client';
import type { OpenFoodFactsProduct } from '@/lib/open-food-facts';
import { triggerOffEnrichment } from './trigger-off-enrichment';
import type { useAddProductMutation } from './use-product-mutations';

type AddProductMutation = ReturnType<typeof useAddProductMutation>;

/** Persistiert einen uebernommenen OFF-Treffer dedupliziert und startet die Anreicherung. */
export async function persistOffProductIfNeeded(
  product: OpenFoodFactsProduct,
  userId: string | undefined,
  addProductMutation: AddProductMutation,
): Promise<string | null> {
  if (!product.barcode || !userId) return null;
  triggerOffEnrichment(product.barcode);

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
