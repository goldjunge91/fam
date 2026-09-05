import type { GatewayRecipe } from './handler.ts';
import {
  comparableMeasurement,
  type RecipeSuggestionContext,
  type RecipeSuggestionMeal,
  validateRecipeSuggestionResponse,
} from './recipe-suggestion-contract.ts';

const normalize = (value: string) => value.trim().toLocaleLowerCase('de-DE');

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
    if (!recipe?.steps?.length || recipe.servings !== context.request.servings) continue;
    const stocks = [
      ...context.priority_foods.map((food) => ({
        name: food.name, unit: food.unit, quantity: food.available_quantity,
        id: food.inventory_item_id, inventory: true,
      })),
      ...context.planned_shopping_items.map((food) => ({
        name: food.name, unit: food.unit, quantity: food.quantity,
        id: food.shopping_item_id, inventory: false,
      })),
    ].map((stock) => ({ ...stock, available: comparableMeasurement(stock.quantity, stock.unit) }));
    const used = new Map<string, RecipeSuggestionMeal['used_items'][number]>();
    const additional = new Set<string>();
    let feasible = true;
    for (const ingredient of recipe.ingredients) {
      const required = ingredient.quantity === null || ingredient.unit === null
        ? null : comparableMeasurement(ingredient.quantity, ingredient.unit);
      if (required === null) { feasible = false; break; }
      let remaining = required.value;
      for (const stock of stocks) {
        if (normalize(stock.name) !== normalize(ingredient.normalizedName) ||
            stock.available?.dimension !== required.dimension) continue;
        const amount = Math.min(remaining, stock.available.value);
        if (amount <= 0) continue;
        const original = comparableMeasurement(stock.quantity, stock.unit)!;
        const quantity = amount * stock.quantity / original.value;
        if (stock.inventory) {
          const previous = used.get(stock.id)?.quantity ?? 0;
          used.set(stock.id, { inventory_item_id: stock.id, quantity: previous + quantity, unit: stock.unit });
        } else additional.add(stock.name);
        stock.available.value -= amount;
        remaining -= amount;
      }
      if (remaining > Number.EPSILON * Math.max(1, required.value) * 8) { feasible = false; break; }
    }
    if (!feasible) continue;
    const meal: RecipeSuggestionMeal = {
      title: recipe.title, source: candidate.source, recipe_id: recipe.recipeId,
      servings: context.request.servings, used_items: [...used.values()],
      additional_ingredients: [...additional], steps: [...recipe.steps], notes: [],
    };
    const fingerprint = JSON.stringify([
      recipe.ingredients.map((item) => normalize(item.normalizedName)).sort(),
      meal.steps.map(normalize),
    ]);
    if (fingerprints.has(fingerprint)) continue;
    if (!validateRecipeSuggestionResponse(context, { schema_version: 1, meals: [meal] }).ok) continue;
    fingerprints.add(fingerprint);
    meals.push(meal);
  }
  return meals;
}
