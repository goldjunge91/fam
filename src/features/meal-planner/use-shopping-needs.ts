import { useQuery } from '@tanstack/react-query';

import { getDatabase } from '@/lib/db/client';
import type { RecipeComponentItemRow, RecipeComponentRow } from './shopping-needs';
import {
  computeIngredientNeeds,
  computeMissingIngredients,
  type RecipeNeedInput,
  stockInGrams,
} from './shopping-needs';

export type MissingIngredientView = {
  productId: string;
  name: string;
  missingGrams: number;
  /** Aus der Kaufhistorie: zuletzt fuer dieses Produkt verwendeter Markt (falls vorhanden). */
  preferredStoreId: string | null;
  preferredStoreName: string | null;
  /** Titel der Rezepte, deren Bedarf zu dieser fehlenden Menge beigetragen hat. */
  recipeNames: string[];
};

/** Berechnet fehlende Zutaten samt letzter Markt-Praeferenz lokal aus SQLite. */
export function useMealPlanShoppingNeeds(
  mealPlanId: string | undefined,
  householdId: string | undefined,
  /** Ohne Premiumzugriff wird nicht gerechnet. */
  enabled: boolean = true,
) {
  return useQuery({
    queryKey: ['meal-plan-shopping-needs', mealPlanId],
    queryFn: async (): Promise<MissingIngredientView[]> => {
      if (!mealPlanId || !householdId) return [];
      const db = await getDatabase();

      const entries = await db.getAllAsync<{ recipe_id: string; portions: number }>(
        `select recipe_id, portions from meal_plan_entries
         where meal_plan_id = ? and deleted_at is null`,
        [mealPlanId],
      );
      if (entries.length === 0) return [];

      const portionsByRecipe = new Map<string, number>();
      for (const entry of entries) {
        portionsByRecipe.set(
          entry.recipe_id,
          (portionsByRecipe.get(entry.recipe_id) ?? 0) + entry.portions,
        );
      }
      const recipeIds = [...portionsByRecipe.keys()];
      const placeholders = recipeIds.map(() => '?').join(', ');

      const components = await db.getAllAsync<RecipeComponentRow & { recipe_id: string }>(
        `select id, recipe_id, serving_grams from recipe_components
         where recipe_id in (${placeholders}) and deleted_at is null`,
        recipeIds,
      );
      const items = await db.getAllAsync<RecipeComponentItemRow & { recipe_id: string }>(
        `select component_id, recipe_id, product_id, sub_component_id, grams from recipe_component_items
         where recipe_id in (${placeholders}) and deleted_at is null`,
        recipeIds,
      );

      const recipeNeeds: RecipeNeedInput[] = recipeIds.map((recipeId) => ({
        recipeId,
        portions: portionsByRecipe.get(recipeId) ?? 0,
        components: components.filter((c) => c.recipe_id === recipeId),
        items: items.filter((i) => i.recipe_id === recipeId),
      }));
      const { needs, recipeIdsByProduct } = computeIngredientNeeds(recipeNeeds);
      if (needs.size === 0) return [];

      const recipeTitleRows = await db.getAllAsync<{ id: string; title: string }>(
        `select id, title from recipes where id in (${placeholders})`,
        recipeIds,
      );
      const recipeTitleById = new Map(recipeTitleRows.map((r) => [r.id, r.title]));

      const stockRows = await db.getAllAsync<{
        product_id: string;
        quantity: number;
        unit: string;
      }>(
        `select product_id, quantity, unit from fridge_items
         where household_id = ? and product_id is not null and deleted_at is null`,
        [householdId],
      );

      const productIds = [...needs.keys()];
      const productPlaceholders = productIds.map(() => '?').join(', ');
      const products = await db.getAllAsync<{
        id: string;
        name: string;
        serving_size_g: number | null;
      }>(
        `select id, name, serving_size_g from products where id in (${productPlaceholders})`,
        productIds,
      );
      const productsById = new Map(products.map((p) => [p.id, p]));

      const stock = stockInGrams(stockRows, productsById);
      const missing = computeMissingIngredients(needs, stock);

      const result: MissingIngredientView[] = [];
      for (const item of missing) {
        const product = productsById.get(item.productId);
        const historyRow = await db.getFirstAsync<{
          store_id: string | null;
          store_name: string | null;
        }>(
          `select sli.store_id as store_id, s.name as store_name
           from shopping_list_items sli
           left join stores s on s.id = sli.store_id
           where sli.household_id = ? and sli.product_id = ? and sli.checked_at is not null
           order by sli.checked_at desc
           limit 1`,
          [householdId, item.productId],
        );
        const recipeNames = [...(recipeIdsByProduct.get(item.productId) ?? [])]
          .map((recipeId) => recipeTitleById.get(recipeId))
          .filter((title): title is string => title !== undefined);

        result.push({
          productId: item.productId,
          name: product?.name ?? item.productId,
          missingGrams: Math.round(item.missingGrams),
          preferredStoreId: historyRow?.store_id ?? null,
          preferredStoreName: historyRow?.store_name ?? null,
          recipeNames,
        });
      }
      return result;
    },
    enabled: !!mealPlanId && !!householdId && enabled,
  });
}
