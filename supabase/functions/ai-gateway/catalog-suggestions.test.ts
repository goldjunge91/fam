import { assertEquals } from 'jsr:@std/assert@1';
import { buildCatalogSuggestions } from './catalog-suggestions.ts';
import type { GatewayRecipe } from './handler.ts';
import type { RecipeSuggestionContext } from './recipe-suggestion-contract.ts';

const recipe: GatewayRecipe = {
  recipeId: 'tomatoes', title: 'Tomatensalat', source: 'catalog', estimatedMinutes: 5,
  servings: 2, allergens: [], dietaryTags: [], steps: ['Tomaten schneiden und servieren.'],
  ingredients: [{ productId: null, normalizedName: 'Tomaten', quantity: 600, unit: 'g' }],
};
const context: RecipeSuggestionContext = {
  schema_version: 1, request: { type: 'recipe_suggestion', servings: 2 },
  constraints: { allergies: [], preferences: [], allowed_staples: [], forbidden_ingredients: [] },
  priority_foods: [
    { inventory_item_id: 'opened', name: 'Tomaten', available_quantity: 200, unit: 'g', priority_score: 2 },
    { inventory_item_id: 'fresh', name: 'Tomaten', available_quantity: 1, unit: 'kg', priority_score: 1 },
  ],
  planned_shopping_items: [], shopping_question: null, fallback_allowed: false,
  candidate_recipes: [{ id: 'tomatoes', title: 'Tomatensalat', source: 'catalog', ingredient_names: ['Tomaten'] }],
};

Deno.test('allocates urgent lots first in their original units and preserves catalog steps', () => {
  const before = JSON.stringify({ context, recipe });
  const meals = buildCatalogSuggestions(context, [recipe]);
  assertEquals(meals[0].used_items, [
    { inventory_item_id: 'opened', quantity: 200, unit: 'g' },
    { inventory_item_id: 'fresh', quantity: 0.4, unit: 'kg' },
  ]);
  assertEquals(meals[0].steps, recipe.steps);
  assertEquals(JSON.stringify({ context, recipe }), before);
});

Deno.test('rejects missing steps, implicit step scaling and aggregate ingredient overdraw', () => {
  assertEquals(buildCatalogSuggestions(context, [{ ...recipe, steps: [] }]), []);
  assertEquals(buildCatalogSuggestions(context, [{ ...recipe, servings: 4 }]), []);
  assertEquals(buildCatalogSuggestions(context, [{
    ...recipe, ingredients: [recipe.ingredients[0], recipe.ingredients[0], recipe.ingredients[0]],
  }]), []);
});

Deno.test('deduplicates relabelled recipes but does not reserve inventory across alternatives', () => {
  const duplicate = { ...recipe, recipeId: 'copy', title: 'Anderer Titel' };
  const distinct = { ...recipe, recipeId: 'roasted', steps: ['Tomaten im Ofen backen.'] };
  const expanded = { ...context, candidate_recipes: [recipe, duplicate, distinct].map((item) => ({
    ...context.candidate_recipes[0], id: item.recipeId, title: item.title,
  })) };
  const meals = buildCatalogSuggestions(expanded, [recipe, duplicate, distinct]);
  assertEquals(meals.map((item) => item.recipe_id), ['tomatoes', 'roasted']);
  assertEquals(meals[0].used_items, meals[1].used_items);
});
