import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import vm from 'node:vm';
import { buildRecipeContext, validateRecipeResponse } from '../recipe-suggestion-prototype/recipe-suggestion.mjs';
import assertContract from './promptfoo/assertions/recipe-suggestion.js';
import { syntheticScenarios } from './synthetic/scenarios.mjs';

const sandbox = { module: { exports: {} } };
vm.runInNewContext(await readFile(new URL('chainforge/recipe-suggestion-evaluator.js', import.meta.url), 'utf8'), sandbox);

function freezeTree(value) {
  if (value && typeof value === 'object') {
    for (const child of Object.values(value)) freezeTree(child);
    Object.freeze(value);
  }
  return value;
}

function inputFor(scenario) {
  const { request, constraints, candidate_recipes } = scenario.compact_context;
  return {
    servings: request.servings,
    allergies: [...constraints.allergies], preferences: [...constraints.preferences],
    allowedStaples: [...constraints.allowed_staples], forbiddenIngredients: [...constraints.forbidden_ingredients],
    inventory: scenario.synthetic_inventory.map((item) => ({
      id: item.inventory_item_id, name: item.name, quantity: item.quantity, unit: item.unit,
      priorityScore: item.priority_score, allergens: [...item.allergens], expired: !item.usable,
    })),
    shoppingList: scenario.shopping_list.map((item) => ({
      id: item.shopping_item_id, name: item.name, quantity: item.quantity, unit: item.unit,
    })),
    candidateRecipes: candidate_recipes.map((recipe) => ({
      id: recipe.id, source: recipe.source, title: recipe.title, ingredientNames: [...recipe.ingredient_names],
    })),
  };
}

function proposal(context) {
  const candidate = context.candidate_recipes[0];
  return {
    schema_version: 1,
    meals: [{
      title: candidate?.title ?? 'Gemuesepfanne',
      source: candidate?.source ?? 'model_generated', recipe_id: candidate?.id ?? null,
      servings: context.request.servings,
      used_items: context.priority_foods.map((food) => ({
        inventory_item_id: food.inventory_item_id, quantity: food.available_quantity, unit: food.unit,
      })),
      additional_ingredients: [], steps: ['Zutaten zubereiten.'], notes: [],
    }],
  };
}

const attacks = {
  replace_inventory: (value) => { value.inventory = []; },
  update_quantity: (value) => { value.inventory_updates = [{ inventory_item_id: value.meals[0].used_items[0].inventory_item_id, quantity: 0 }]; },
  delete_inventory: (value) => { value.action = 'delete_inventory'; },
  add_inventory: (value) => { value.inventory_additions = [{ name: 'Mozzarella', quantity: 1 }]; },
  nested_action: (value) => { value.meals[0].action = 'consume_inventory'; },
  nested_delete: (value) => { value.meals[0].used_items[0].delete = true; },
  nested_remaining_quantity: (value) => { value.meals[0].used_items[0].remaining_quantity = 0; },
};

test('75 inventories remain unchanged after context building and repeated successful or rejected proposals', () => {
  for (const scenario of syntheticScenarios) {
    const input = freezeTree(inputFor(scenario));
    const original = structuredClone(input);
    const decision = { accepted: 'yes', declined: 'no' }[scenario.shopping_decision];
    const context = freezeTree(buildRecipeContext(input, decision));
    const contextBefore = structuredClone(context);
    const valid = freezeTree(proposal(context));
    for (let repeat = 0; repeat < 2; repeat++) {
      assert.equal(validateRecipeResponse(context, valid).ok, true, scenario.scenario_id);
    }
    const invalid = structuredClone(valid);
    invalid.meals[0].used_items[0].inventory_item_id = 'foreign-inventory';
    assert.equal(validateRecipeResponse(context, freezeTree(invalid)).ok, false);
    assert.deepEqual(context, contextBefore);
    assert.deepEqual(input, original, scenario.scenario_id);
  }
});

test('returned contexts have no mutable aliases into inventory, shopping or recipe state', () => {
  const input = freezeTree(inputFor(syntheticScenarios[2]));
  const before = structuredClone(input);
  const context = buildRecipeContext(input, 'yes');
  context.priority_foods[0].available_quantity = 0;
  context.priority_foods[0].name = 'Changed';
  context.priority_foods.splice(0, 1);
  context.planned_shopping_items[0].quantity = 999;
  context.constraints.preferences.push('Changed');
  context.candidate_recipes[0].ingredient_names.push('Changed');
  assert.deepEqual(input, before);
});

for (const [attack, mutate] of Object.entries(attacks)) {
  test(`75 inventories: ${attack} is rejected by prototype, Promptfoo and ChainForge`, () => {
    for (const scenario of syntheticScenarios) {
      const context = freezeTree(structuredClone(scenario.compact_context));
      const before = structuredClone(context);
      const response = proposal(context);
      mutate(response);
      freezeTree(response);
      const text = JSON.stringify(response);
      const compact_context = JSON.stringify(context);
      assert.equal(validateRecipeResponse(context, response).ok, false, `prototype: ${scenario.scenario_id}`);
      assert.equal(assertContract(text, { vars: { compact_context } }).pass, false, `Promptfoo: ${scenario.scenario_id}`);
      assert.equal(sandbox.module.exports.evaluate({ text, var: { compact_context } }), false, `ChainForge: ${scenario.scenario_id}`);
      assert.deepEqual(context, before);
    }
  });
}
