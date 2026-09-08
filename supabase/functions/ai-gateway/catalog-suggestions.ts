import type { GatewayRecipe } from './handler.ts';
import {
  comparableMeasurement,
  type RecipeSuggestionContext,
  type RecipeSuggestionMeal,
  validateRecipeSuggestionResponse,
} from './recipe-suggestion-contract.ts';

const normalize = (value: string) => value.trim().toLocaleLowerCase('de-DE');

type AvailableStock = {
  id: string;
  name: string;
  unit: string;
  quantity: number;
  inventory: boolean;
  available: ReturnType<typeof comparableMeasurement>;
};

function buildStockList(context: RecipeSuggestionContext): AvailableStock[] {
  const inventoryStocks = context.priority_foods.map((food) => ({
    id: food.inventory_item_id,
    name: food.name,
    unit: food.unit,
    quantity: food.available_quantity,
    inventory: true,
    available: comparableMeasurement(food.available_quantity, food.unit),
  }));

  const shoppingStocks = context.planned_shopping_items.map((food) => ({
    id: food.shopping_item_id,
    name: food.name,
    unit: food.unit,
    quantity: food.quantity,
    inventory: false,
    available: comparableMeasurement(food.quantity, food.unit),
  }));

  return [...inventoryStocks, ...shoppingStocks];
}

function allocateIngredient(
  ingredient: GatewayRecipe['ingredients'][number],
  stocks: AvailableStock[],
  used: Map<string, RecipeSuggestionMeal['used_items'][number]>,
  additional: Set<string>,
): boolean {
  if (ingredient.quantity === null || ingredient.unit === null) {
    return false;
  }
  const required = comparableMeasurement(ingredient.quantity, ingredient.unit);
  if (required === null) {
    return false;
  }

  let remaining = required.value;
  const normalizedIngredientName = normalize(ingredient.normalizedName);

  for (const stock of stocks) {
    if (
      normalize(stock.name) !== normalizedIngredientName ||
      stock.available?.dimension !== required.dimension
    ) {
      continue;
    }

    const amount = Math.min(remaining, stock.available.value);
    if (amount <= 0) continue;

    const original = comparableMeasurement(stock.quantity, stock.unit)!;
    const quantity = (amount * stock.quantity) / original.value;

    if (stock.inventory) {
      const previous = used.get(stock.id)?.quantity ?? 0;
      used.set(stock.id, {
        inventory_item_id: stock.id,
        quantity: previous + quantity,
        unit: stock.unit,
      });
    } else {
      additional.add(stock.name);
    }

    stock.available.value -= amount;
    remaining -= amount;
  }

  const tolerance = Number.EPSILON * Math.max(1, required.value) * 8;
  return remaining <= tolerance;
}

function recipeFingerprint(recipe: GatewayRecipe, steps: readonly string[]): string {
  const sortedIngredients = recipe.ingredients
    .map((item) => normalize(item.normalizedName))
    .sort();
  const normalizedSteps = steps.map(normalize);
  return JSON.stringify([sortedIngredients, normalizedSteps]);
}

/** Allocates each alternative independently, without changing stock or catalog instructions. */
export function buildCatalogSuggestions(
  context: RecipeSuggestionContext,
  recipes: readonly GatewayRecipe[],
): RecipeSuggestionMeal[] {
  const meals: RecipeSuggestionMeal[] = [];
  const fingerprints = new Set<string>();

  for (const candidate of context.candidate_recipes) {
    const recipe = recipes.find((item) => item.recipeId === candidate.id);
    // Free-text steps can contain quantities; scaling needs structured references.
    if (!recipe?.steps?.length || recipe.servings !== context.request.servings) {
      continue;
    }

    const stocks = buildStockList(context);
    const used = new Map<string, RecipeSuggestionMeal['used_items'][number]>();
    const additional = new Set<string>();

    let feasible = true;
    for (const ingredient of recipe.ingredients) {
      if (!allocateIngredient(ingredient, stocks, used, additional)) {
        feasible = false;
        break;
      }
    }
    if (!feasible) continue;

    const meal: RecipeSuggestionMeal = {
      title: recipe.title,
      source: candidate.source,
      recipe_id: recipe.recipeId,
      servings: context.request.servings,
      used_items: [...used.values()],
      additional_ingredients: [...additional],
      steps: [...recipe.steps],
      notes: [],
    };

    const fingerprint = recipeFingerprint(recipe, meal.steps);
    if (fingerprints.has(fingerprint)) continue;

    const validation = validateRecipeSuggestionResponse(context, {
      schema_version: 1,
      meals: [meal],
    });
    if (!validation.ok) continue;

    fingerprints.add(fingerprint);
    meals.push(meal);
  }

  return meals;
}
