import type { GatewayRecipe } from './handler.ts';
import {
  comparableMeasurement,
  type RecipeSuggestionContext,
  type RecipeSuggestionMeal,
  validateRecipeSuggestionResponse,
} from './recipe-suggestion-contract.ts';

function normalize(value: string): string {
  return value.trim().toLocaleLowerCase('de-DE');
}

type AvailableStock = {
  id: string;
  name: string;
  unit: string;
  quantity: number;
  inventory: boolean;
  available: ReturnType<typeof comparableMeasurement>;
};

function buildStockList(context: RecipeSuggestionContext): AvailableStock[] {
  return [
    ...context.priority_foods.map((food) => ({
      id: food.inventory_item_id,
      name: food.name,
      unit: food.unit,
      quantity: food.available_quantity,
      inventory: true,
      available: comparableMeasurement(food.available_quantity, food.unit),
    })),
    ...context.planned_shopping_items.map((item) => ({
      id: item.shopping_item_id,
      name: item.name,
      unit: item.unit,
      quantity: item.quantity,
      inventory: false,
      available: comparableMeasurement(item.quantity, item.unit),
    })),
  ];
}

function allocateIngredient(
  ingredient: GatewayRecipe['ingredients'][number],
  stocks: AvailableStock[],
  usedItems: Map<string, RecipeSuggestionMeal['used_items'][number]>,
  additionalIngredients: Set<string>,
  shoppingNeeds: Map<string, NonNullable<RecipeSuggestionMeal['shopping_needs']>[number]>,
  servingsScale: number,
  allowMissingIngredients: boolean,
): boolean {
  if (ingredient.quantity === null || ingredient.unit === null) return false;
  const scaledQuantity = ingredient.quantity * servingsScale;
  const required = comparableMeasurement(scaledQuantity, ingredient.unit);
  if (required === null) return false;

  let remaining = required.value;
  const ingredientName = normalize(ingredient.normalizedName);
  for (const stock of stocks) {
    if (
      stock.available === null ||
      normalize(stock.name) !== ingredientName ||
      stock.available.dimension !== required.dimension
    ) {
      continue;
    }

    const allocated = Math.min(remaining, stock.available.value);
    if (allocated <= 0) continue;
    const original = comparableMeasurement(stock.quantity, stock.unit);
    if (original === null) continue;
    const quantityInOriginalUnit = (allocated * stock.quantity) / original.value;

    if (stock.inventory) {
      const previous = usedItems.get(stock.id)?.quantity ?? 0;
      usedItems.set(stock.id, {
        inventory_item_id: stock.id,
        quantity: previous + quantityInOriginalUnit,
        unit: stock.unit,
      });
    } else {
      additionalIngredients.add(stock.name);
    }
    stock.available.value -= allocated;
    remaining -= allocated;
  }

  const tolerance = Number.EPSILON * Math.max(required.value, 1) * 8;
  if (remaining > tolerance) {
    if (!allowMissingIngredients) return false;
    const key = `${ingredientName}\u0000${normalize(ingredient.unit)}`;
    const quantity = (remaining / required.value) * scaledQuantity;
    const previous = shoppingNeeds.get(key);
    shoppingNeeds.set(key, {
      name: ingredient.normalizedName.trim(),
      quantity: (previous?.quantity ?? 0) + quantity,
      unit: ingredient.unit,
    });
  }
  return true;
}

function recipeFingerprint(recipe: GatewayRecipe): string {
  const ingredients = recipe.ingredients
    .map((ingredient) => [
      normalize(ingredient.normalizedName),
      ingredient.quantity,
      ingredient.unit === null ? null : normalize(ingredient.unit),
    ])
    .sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)));
  return JSON.stringify([
    ingredients,
    recipe.steps.map(normalize),
  ]);
}

/** Builds catalog alternatives without invoking a model or mutating source data. */
export function buildCatalogSuggestions(
  context: RecipeSuggestionContext,
  recipes: readonly GatewayRecipe[],
  allowMissingIngredients = false,
): RecipeSuggestionMeal[] {
  const meals: RecipeSuggestionMeal[] = [];
  const fingerprints = new Set<string>();

  for (const candidate of context.candidate_recipes) {
    const recipe = recipes.find((item) => item.recipeId === candidate.id);
    if (
      recipe === undefined ||
      recipe.steps.length === 0 ||
      recipe.servings === null ||
      !Number.isInteger(recipe.servings) ||
      recipe.servings <= 0 ||
      (!allowMissingIngredients && recipe.servings !== context.request.servings)
    ) {
      continue;
    }

    const servingsScale = context.request.servings / recipe.servings;
    const stocks = buildStockList(context);
    const usedItems = new Map<string, RecipeSuggestionMeal['used_items'][number]>();
    const additionalIngredients = new Set<string>();
    const shoppingNeeds = new Map<
      string,
      NonNullable<RecipeSuggestionMeal['shopping_needs']>[number]
    >();
    const feasible = recipe.ingredients.every((ingredient) =>
      allocateIngredient(
        ingredient,
        stocks,
        usedItems,
        additionalIngredients,
        shoppingNeeds,
        servingsScale,
        allowMissingIngredients,
      )
    );
    if (!feasible) continue;

    const meal: RecipeSuggestionMeal = {
      title: recipe.title,
      source: candidate.source,
      recipe_id: recipe.recipeId,
      servings: context.request.servings,
      used_items: [...usedItems.values()],
      additional_ingredients: [...additionalIngredients],
      steps: [...recipe.steps],
      notes: [],
    };
    const mealWithShopping = shoppingNeeds.size === 0
      ? meal
      : { ...meal, shopping_needs: [...shoppingNeeds.values()] };
    const fingerprint = recipeFingerprint(recipe);
    if (fingerprints.has(fingerprint)) continue;

    const validation = validateRecipeSuggestionResponse(context, {
      schema_version: 1,
      meals: [mealWithShopping],
    });
    if (!validation.ok) continue;

    fingerprints.add(fingerprint);
    const validatedMeal = validation.value.meals[0];
    if (validatedMeal !== undefined) meals.push(validatedMeal);
  }

  return meals;
}
