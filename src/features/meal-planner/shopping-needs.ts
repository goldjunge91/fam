import { toGramsEquivalent } from '@/lib/units';
import type {
  ProductNutritionRow,
  RecipeComponentItemRow,
  RecipeComponentRow,
} from '../recipes/nutrition';

/** Berechnet rekursiv Produktbedarf und zieht den vereinheitlichten Vorrat ab. */

export type RecipeNeedInput = {
  recipeId: string;
  portions: number;
  components: readonly RecipeComponentRow[];
  items: readonly RecipeComponentItemRow[];
};

function flattenComponentGramsPer100g(
  componentId: string,
  items: readonly RecipeComponentItemRow[],
  visiting: ReadonlySet<string> = new Set(),
): Map<string, number> {
  if (visiting.has(componentId)) {
    throw new Error(`Zyklische Komponenten-Verschachtelung bei ${componentId}`);
  }
  const nextVisiting = new Set(visiting).add(componentId);

  let totalGrams = 0;
  const productGrams = new Map<string, number>();

  for (const item of items) {
    if (item.component_id !== componentId) continue;
    totalGrams += item.grams;

    if (item.product_id !== null) {
      productGrams.set(item.product_id, (productGrams.get(item.product_id) ?? 0) + item.grams);
    } else if (item.sub_component_id !== null) {
      const subPer100 = flattenComponentGramsPer100g(item.sub_component_id, items, nextVisiting);
      const factor = item.grams / 100;
      for (const [productId, gramsPer100] of subPer100) {
        productGrams.set(productId, (productGrams.get(productId) ?? 0) + gramsPer100 * factor);
      }
    }
  }

  if (totalGrams === 0) return new Map();
  const scale = 100 / totalGrams;
  const result = new Map<string, number>();
  for (const [productId, grams] of productGrams) {
    result.set(productId, grams * scale);
  }
  return result;
}

/** Skaliert die obersten Rezeptkomponenten auf die geplanten Portionen. */
function ingredientNeedsForRecipe(need: RecipeNeedInput): Map<string, number> {
  const result = new Map<string, number>();

  for (const component of need.components) {
    if (component.serving_grams === null) continue;
    const per100g = flattenComponentGramsPer100g(component.id, need.items);
    const targetGrams = component.serving_grams * need.portions;
    for (const [productId, gramsPer100] of per100g) {
      const grams = (gramsPer100 / 100) * targetGrams;
      result.set(productId, (result.get(productId) ?? 0) + grams);
    }
  }

  return result;
}

export type IngredientNeedsResult = {
  needs: Map<string, number>;
  recipeIdsByProduct: Map<string, Set<string>>;
};

export function computeIngredientNeeds(
  recipeNeeds: readonly RecipeNeedInput[],
): IngredientNeedsResult {
  const total = new Map<string, number>();
  const recipeIdsByProduct = new Map<string, Set<string>>();
  for (const need of recipeNeeds) {
    const perRecipe = ingredientNeedsForRecipe(need);
    for (const [productId, grams] of perRecipe) {
      total.set(productId, (total.get(productId) ?? 0) + grams);
      const recipeIds = recipeIdsByProduct.get(productId) ?? new Set<string>();
      recipeIds.add(need.recipeId);
      recipeIdsByProduct.set(productId, recipeIds);
    }
  }
  return { needs: total, recipeIdsByProduct };
}

export type StockRow = {
  product_id: string;
  quantity: number;
  unit: string;
};

/** Summiert nur sicher in Gramm umrechenbaren Vorrat. */
export function stockInGrams(
  stock: readonly StockRow[],
  productsById: ReadonlyMap<string, { serving_size_g: number | null }>,
): Map<string, number> {
  const result = new Map<string, number>();
  for (const row of stock) {
    const servingWeightG = productsById.get(row.product_id)?.serving_size_g ?? undefined;
    const equivalent = toGramsEquivalent(row.quantity, row.unit, { servingWeightG });
    if (!equivalent.convertible) continue;
    result.set(row.product_id, (result.get(row.product_id) ?? 0) + equivalent.grams);
  }
  return result;
}

export type MissingIngredient = {
  productId: string;
  neededGrams: number;
  availableGrams: number;
  missingGrams: number;
};

/** Liefert nur Produkte mit positivem Fehlbestand. */
export function computeMissingIngredients(
  needs: ReadonlyMap<string, number>,
  stock: ReadonlyMap<string, number>,
): MissingIngredient[] {
  const missing: MissingIngredient[] = [];
  for (const [productId, neededGrams] of needs) {
    const availableGrams = stock.get(productId) ?? 0;
    const missingGrams = neededGrams - availableGrams;
    if (missingGrams > 0.0001) {
      missing.push({ productId, neededGrams, availableGrams, missingGrams });
    }
  }
  return missing.sort((a, b) => b.missingGrams - a.missingGrams);
}

export type { ProductNutritionRow, RecipeComponentItemRow, RecipeComponentRow };
