import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildRecipeContext } from '../../recipe-suggestion-prototype/recipe-suggestion.mjs';
import { syntheticScenarios } from './scenarios.mjs';

const referenceDate = '2026-09-03';
const bestBefore = (days) => new Date(Date.parse(referenceDate) + days * 86_400_000).toISOString().slice(0, 10);

test('all 75 inventories support computed priorities and exact quantity boundaries without mutations', () => {
  for (const scenario of syntheticScenarios) {
    const compact = scenario.compact_context;
    // Explicit synthetic recipe requirements, not evidence of nutritional/culinary quality.
    const ingredients = [
      ...compact.priority_foods.map((item) => ({ name: item.name, quantity: item.available_quantity, unit: item.unit })),
      ...compact.planned_shopping_items.map(({ name, quantity, unit }) => ({ name, quantity, unit })),
      ...compact.constraints.allowed_staples.map((name) => ({ name, quantity: 1, unit: 'g' })),
    ];
    const input = {
      referenceDate, servings: compact.request.servings,
      allergies: [...compact.constraints.allergies], preferences: [...compact.constraints.preferences],
      allowedStaples: [...compact.constraints.allowed_staples], forbiddenIngredients: [...compact.constraints.forbidden_ingredients],
      inventory: scenario.synthetic_inventory.map((item) => ({
        id: item.inventory_item_id, name: item.name, quantity: item.quantity, unit: item.unit,
        allergens: [...item.allergens], expired: !item.usable,
        bestBefore: bestBefore(item.expiry_days),
        // The older dataset has only a flag; this test explicitly assumes two opening days.
        openedAt: item.opened ? '2026-09-01' : null,
      })),
      shoppingList: scenario.shopping_list.map((item) => ({
        id: item.shopping_item_id, name: item.name, quantity: item.quantity, unit: item.unit,
      })),
      candidateRecipes: [{
        id: `${scenario.scenario_id}-measured`, source: 'template', title: 'Mengenbelegtes Testrezept',
        servings: compact.request.servings, ingredientNames: [...new Set(ingredients.map((item) => item.name))], ingredients,
      }],
    };
    const before = structuredClone(input);
    const decision = { accepted: 'yes', declined: 'no' }[scenario.shopping_decision];
    const context = buildRecipeContext(input, decision);
    assert.equal(context.candidate_recipes.length, 1, `${scenario.scenario_id}: exact amounts`);
    for (const item of context.priority_foods) assert.ok(Number.isFinite(item.priority_score));
    assert.deepEqual(input, before);
    const shortage = buildRecipeContext({ ...input, servings: input.servings * 2 }, decision);
    assert.equal(shortage.candidate_recipes.length, 0, `${scenario.scenario_id}: doubled portions`);
    assert.equal(shortage.fallback_allowed, true);
    assert.deepEqual(input, before);
  }
});
