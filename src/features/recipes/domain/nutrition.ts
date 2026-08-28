export type NutritionPer100 = {
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
};

export type NutritionTotal = {
  grams: number;
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
};

export type RecipeComponentRow = {
  id: string;
  /** Nur bei obersten Komponenten gesetzt (siehe 11_recipes.sql-Kommentar). */
  serving_grams: number | null;
};

export type RecipeComponentItemRow = {
  component_id: string;
  product_id: string | null;
  sub_component_id: string | null;
  grams: number;
};

export type ProductNutritionRow = {
  id: string;
  kcal_per_100: number | null;
  protein_g_per_100: number | null;
  carbs_g_per_100: number | null;
  fat_g_per_100: number | null;
};

const ZERO: NutritionPer100 = { kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0 };

function addScaled(total: NutritionTotal, per100: NutritionPer100, grams: number): void {
  const factor = grams / 100;
  total.grams += grams;
  total.kcal += per100.kcal * factor;
  total.protein_g += per100.protein_g * factor;
  total.carbs_g += per100.carbs_g * factor;
  total.fat_g += per100.fat_g * factor;
}

function toPer100(total: NutritionTotal): NutritionPer100 {
  if (total.grams === 0) return ZERO;
  const factor = 100 / total.grams;
  return {
    kcal: total.kcal * factor,
    protein_g: total.protein_g * factor,
    carbs_g: total.carbs_g * factor,
    fat_g: total.fat_g * factor,
  };
}

export function calculateComponentPer100g(
  componentId: string,
  items: readonly RecipeComponentItemRow[],
  productsById: ReadonlyMap<string, ProductNutritionRow>,
  visiting: ReadonlySet<string> = new Set(),
): NutritionPer100 {
  if (visiting.has(componentId)) {
    throw new Error(`Zyklische Komponenten-Verschachtelung bei ${componentId}`);
  }
  const nextVisiting = new Set(visiting).add(componentId);

  const total: NutritionTotal = { grams: 0, kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0 };

  for (const item of items) {
    if (item.component_id !== componentId) continue;

    if (item.product_id !== null) {
      const product = productsById.get(item.product_id);
      const per100: NutritionPer100 = product
        ? {
            kcal: product.kcal_per_100 ?? 0,
            protein_g: product.protein_g_per_100 ?? 0,
            carbs_g: product.carbs_g_per_100 ?? 0,
            fat_g: product.fat_g_per_100 ?? 0,
          }
        : ZERO;
      addScaled(total, per100, item.grams);
    } else if (item.sub_component_id !== null) {
      const subPer100 = calculateComponentPer100g(
        item.sub_component_id,
        items,
        productsById,
        nextVisiting,
      );
      addScaled(total, subPer100, item.grams);
    }
  }

  return toPer100(total);
}

export function calculateServingNutrition(
  components: readonly RecipeComponentRow[],
  items: readonly RecipeComponentItemRow[],
  productsById: ReadonlyMap<string, ProductNutritionRow>,
): NutritionTotal {
  const total: NutritionTotal = { grams: 0, kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0 };

  for (const component of components) {
    if (component.serving_grams === null) continue;
    const per100 = calculateComponentPer100g(component.id, items, productsById);
    addScaled(total, per100, component.serving_grams);
  }

  return total;
}

export function calculateAdjustedServingNutrition(
  components: readonly RecipeComponentRow[],
  items: readonly RecipeComponentItemRow[],
  productsById: ReadonlyMap<string, ProductNutritionRow>,
  gramsByComponentId: ReadonlyMap<string, number>,
): NutritionTotal {
  const total: NutritionTotal = { grams: 0, kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0 };

  for (const component of components) {
    if (component.serving_grams === null) continue;
    const grams = gramsByComponentId.get(component.id) ?? component.serving_grams;
    if (grams <= 0) continue;
    const per100 = calculateComponentPer100g(component.id, items, productsById);
    addScaled(total, per100, grams);
  }

  return total;
}

/**
 * Klassisches Hochskalieren: "2 Portionen" multipliziert alle
 * Portions-Grammmengen linear (Brainstorm-Entscheidung — kein
 * Baukasten-Skalieren auf dieser Ebene).
 */
export function scaleServing(serving: NutritionTotal, factor: number): NutritionTotal {
  return {
    grams: serving.grams * factor,
    kcal: serving.kcal * factor,
    protein_g: serving.protein_g * factor,
    carbs_g: serving.carbs_g * factor,
    fat_g: serving.fat_g * factor,
  };
}
