import { useQuery } from '@tanstack/react-query';

import {
  computeIngredientNeeds,
  computeMissingIngredients,
  stockInGrams,
} from '@/features/meal-planner/shopping-needs';
import { getDatabase } from '@/lib/db/client';
import { fromInventoryQuantityUnits } from '@/lib/inventory-quantity';

import type { RecipeDetail } from '../hooks/use-recipes';

export type RecipeShoppingNeed = {
  productId: string;
  name: string;
  /** Gesamtbedarf des Rezepts bei den gewaehlten Portionen, in Gramm. */
  neededGrams: number;
  /** Aktuell verfügbare Gesamtmenge (Vorrat + ungecheckte Einkaufsliste), in Gramm. */
  availableGrams: number;
  /** Menge im physischen Vorrat, in Gramm. */
  stockGrams?: number;
  /** Bereits ungecheckt auf der Einkaufsliste stehende Menge, in Gramm. */
  shoppingListGrams?: number;
  /**
   * `neededGrams - availableGrams`, kann <= 0 sein, wenn Vorrat und Einkaufsliste den
   * Bedarf bereits decken — solche Zutaten bleiben sichtbar (Nachschub-Fall,
   * siehe docs/issue-131-missing-ingredients-transfer.md), werden von der UI
   * aber nicht mehr automatisch vorausgewaehlt.
   */
  missingGrams: number;
  preferredStoreId: string | null;
};

export function useRecipeShoppingNeeds(
  detail: RecipeDetail | null | undefined,
  servings: number,
  enabled: boolean,
) {
  const recipeId = detail?.recipe.id;
  const householdId = detail?.recipe.household_id;

  return useQuery({
    queryKey: ['recipe-shopping-needs', recipeId, householdId, servings],
    queryFn: async (): Promise<RecipeShoppingNeed[]> => {
      if (!detail || !recipeId || !householdId) return [];

      const { needs } = computeIngredientNeeds([
        {
          recipeId,
          portions: servings,
          components: detail.components,
          items: detail.items,
        },
      ]);
      if (needs.size === 0) return [];

      const db = await getDatabase();
      const productIds = [...needs.keys()];
      const placeholders = productIds.map(() => '?').join(', ');
      const [rawStockRows, rawShoppingListRows, products] = await Promise.all([
        db.getAllAsync<{ product_id: string; quantity: number; unit: string }>(
          `select product_id, quantity, unit from fridge_items
           where household_id = ? and product_id is not null and deleted_at is null`,
          [householdId],
        ),
        db.getAllAsync<{ product_id: string; quantity: number; unit: string }>(
          `select product_id, quantity, unit from shopping_list_items
           where household_id = ? and product_id is not null and deleted_at is null and checked_at is null`,
          [householdId],
        ),
        db.getAllAsync<{ id: string; name: string; serving_size_g: number | null }>(
          `select id, name, serving_size_g from products where id in (${placeholders})`,
          productIds,
        ),
      ]);
      // Persistenz-/View-Grenze (contract.md Abschnitt 3): fridge_items.quantity
      // ist Integer-Tausendstel, stockInGrams erwartet die dezimale Menge.
      const stockRows = rawStockRows.map((row) => ({
        ...row,
        quantity: fromInventoryQuantityUnits(row.quantity),
      }));
      const productsById = new Map(products.map((product) => [product.id, product]));
      const stock = stockInGrams(stockRows, productsById);
      const shoppingListStock = stockInGrams(rawShoppingListRows, productsById);
      const missing = computeMissingIngredients(needs, stock, shoppingListStock);

      return Promise.all(
        missing.map(async (item) => {
          const history = await db.getFirstAsync<{ store_id: string | null }>(
            `select store_id from shopping_list_items
             where household_id = ? and product_id = ? and checked_at is not null
             order by checked_at desc limit 1`,
            [householdId, item.productId],
          );
          return {
            productId: item.productId,
            name: productsById.get(item.productId)?.name ?? 'Zutat',
            neededGrams: Math.round(item.neededGrams),
            availableGrams: Math.round(item.availableGrams),
            stockGrams: item.stockGrams !== undefined ? Math.round(item.stockGrams) : undefined,
            shoppingListGrams:
              item.shoppingListGrams !== undefined ? Math.round(item.shoppingListGrams) : undefined,
            missingGrams: Math.round(item.missingGrams),
            preferredStoreId: history?.store_id ?? null,
          };
        }),
      );
    },
    enabled: enabled && !!detail && servings > 0,
  });
}
