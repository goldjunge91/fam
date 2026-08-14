import { toGramsEquivalent } from '@/lib/units';
import type {
  ProductNutritionRow,
  RecipeComponentItemRow,
  RecipeComponentRow,
} from '../recipes/nutrition';

/**
 * Reine Berechnungsfunktionen fuer die Meal-Planner -> Einkaufsliste-
 * Generierung (#131). Kein I/O — analog zu `../recipes/nutrition.ts`.
 *
 * Zwei Schritte, zwei Funktionen:
 *
 * 1. `computeIngredientNeeds`: aus den Rezept-Komponenten/-Positionen eines
 *    Wochenplans den Zutatenbedarf in Gramm je Produkt berechnen — die
 *    rekursive Baukasten-Traversierung ist dieselbe Idee wie
 *    `calculateComponentPer100g` in `nutrition.ts` (Positionen einer
 *    Komponente aufsummieren, Unterkomponenten rekursiv gewichten), aber ein
 *    eigenstaendiger Durchlauf: statt eines kcal/Makro-Skalars entsteht hier
 *    eine Map(productId -> Gramm), das laesst sich nicht in dieselbe
 *    Reduce-Funktion pressen, ohne beide Anwendungsfaelle zu verkomplizieren.
 * 2. `computeMissingIngredients`: Bedarf minus Vorratsbestand
 *    (`fridge_items`, ueber `toGramsEquivalent` aus `src/lib/units.ts`
 *    vereinheitlicht) -> fehlende Menge je Produkt.
 */

export type RecipeNeedInput = {
  recipeId: string;
  /** Summe der Portionen aller Wochenplan-Eintraege, die auf dieses Rezept zeigen. */
  portions: number;
  components: readonly RecipeComponentRow[];
  items: readonly RecipeComponentItemRow[];
};

/** Gramm-Anteil je Basis-Produkt fuer 100g einer Komponenten-Mischung. */
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

/**
 * Zutatenbedarf eines einzelnen Rezepts (alle obersten Komponenten,
 * skaliert auf die im Wochenplan eingetragene Portionenzahl).
 * `portions` verhaelt sich wie der `factor` in `scaleServing` (nutrition.ts):
 * `serving_grams` je oberster Komponente entspricht "1 Portion".
 */
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
  /** Bedarf in Gramm je Produkt, ueber alle Rezepte des Wochenplans summiert. */
  needs: Map<string, number>;
  /** Welche Rezepte zu diesem Produktbedarf beigetragen haben (fuer die Anzeige "aus welchem Gericht"). */
  recipeIdsByProduct: Map<string, Set<string>>;
};

/** Summierter Zutatenbedarf ueber alle Rezepte eines Wochenplans hinweg. */
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

/**
 * Vorratsbestand (`fridge_items`) in Gramm je Produkt, ueber
 * `toGramsEquivalent` vereinheitlicht. Positionen, die sich nicht
 * umrechnen lassen (stueckbasiert ohne bekanntes `serving_size_g`), zaehlen
 * bewusst NICHT zum Bestand — sie duerfen den Bedarf nicht kuenstlich
 * senken, wenn die tatsaechliche Menge unklar ist.
 */
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

/**
 * Bedarf minus Bestand. Nur Produkte mit tatsaechlich fehlender Menge
 * (`missingGrams > 0`) landen im Ergebnis — Kernfunktion aus #131-AC 1
 * ("berechnet fehlende Zutaten ... automatisch").
 */
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
