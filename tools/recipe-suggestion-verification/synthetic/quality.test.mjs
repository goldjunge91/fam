import assert from 'node:assert/strict';
import { test } from 'node:test';
import { assessSyntheticResponse } from './quality.mjs';
import assertSyntheticQuality from '../promptfoo/assertions/synthetic-quality.js';

const compact = { request: { servings: 3 }, constraints: {
  allergies: ['Milch'], allowed_staples: ['Wasser'], forbidden_ingredients: ['Milch', 'Käse'],
}, planned_shopping_items: [{ name: 'Zitrone' }], candidate_recipes: [{
  id: 'recipe-spinach', source: 'template', title: 'Spinat mit Tomate',
  ingredient_names: ['Spinat', 'Tomate', 'Wasser', 'Zitrone', 'Zucchini'],
}], priority_foods: [
  { inventory_item_id: 'spinach', name: 'Spinat', available_quantity: 300, unit: 'g' },
  { inventory_item_id: 'tomato', name: 'Tomate', available_quantity: 4, unit: 'pcs' },
] };
const expected = { servings: 3, required_priority_ids: ['spinach'], min_used_items: 2 };
const response = () => ({ meals: [{ servings: 3, used_items: [
  { inventory_item_id: 'spinach', quantity: 150, unit: 'g' },
  { inventory_item_id: 'tomato', quantity: 2, unit: 'pcs' },
], additional_ingredients: ['Wasser'], steps: ['Spinat und Tomate mit Wasser zubereiten.'],
}] });

const responseWithRecipe = () => ({ schema_version: 1, meals: [{
  title: 'Spinat mit Tomate', source: 'template', recipe_id: 'recipe-spinach', servings: 3,
  used_items: response().meals[0].used_items,
  additional_ingredients: ['Wasser'], steps: ['Spinat und Tomate mit Wasser zubereiten.'], notes: [],
}] });

test('synthetic quality reports unit-independent consumption metrics', () => {
  const result = assessSyntheticResponse(JSON.stringify(response()), compact, expected);
  assert.equal(result.pass, true);
  assert.deepEqual(result.metrics, { priority_item_coverage: 1, mean_available_quantity_used: 0.5 });
});

test('synthetic quality compares compatible units in canonical quantities', () => {
  const compactWithKg = structuredClone(compact);
  compactWithKg.priority_foods[0].available_quantity = 0.3;
  compactWithKg.priority_foods[0].unit = 'kg';
  const result = assessSyntheticResponse(response(), compactWithKg, expected);
  assert.equal(result.pass, true);
  assert.equal(result.metrics.mean_available_quantity_used, 0.5);
});

test('synthetic expectations reject wrong servings, no food use and skipped urgent food', () => {
  for (const mutate of [
    (value) => { value.meals[0].servings = 2; },
    (value) => { value.meals[0].used_items = []; },
    (value) => { value.meals[0].used_items.shift(); },
    (value) => { value.meals[0].used_items.pop(); },
  ]) {
    const value = response();
    mutate(value);
    assert.equal(assessSyntheticResponse(value, compact, expected).pass, false);
  }
});

test('an otherwise valid response cannot append a recipe with no inventory ingredients', () => {
  const value = response();
  value.meals.push({ servings: 3, used_items: [] });
  const result = assessSyntheticResponse(value, compact, expected);
  assert.equal(result.pass, false);
  assert.match(result.reason, /every meal must use available inventory|catalog or template.*exactly one meal/i);
});

test('multiple fallback meals remain valid when each uses stock and the shared budget is respected', () => {
  const value = response();
  value.meals.push(structuredClone(value.meals[0]));
  const fallbackCompact = structuredClone(compact);
  fallbackCompact.candidate_recipes = [];
  fallbackCompact.fallback_allowed = true;
  const result = assessSyntheticResponse(value, fallbackCompact, expected);
  assert.equal(result.pass, true);
  assert.equal(result.metrics.mean_available_quantity_used, 1);
});

test('catalog suggestions reject multiple meals without an explicit meal count override', () => {
  const value = response();
  value.meals.push(structuredClone(value.meals[0]));
  const result = assessSyntheticResponse(value, compact, expected);
  assert.equal(result.pass, false);
  assert.match(result.reason, /catalog or template.*exactly one meal/i);
});

test('synthetic quality rejects duplicate inventory IDs within one meal', () => {
  const value = response();
  value.meals[0].used_items.push({ ...value.meals[0].used_items[0] });
  const result = assessSyntheticResponse(value, compact, expected);
  assert.equal(result.pass, false);
  assert.match(result.reason, /duplicate inventory item within meal/i);
});

test('explicit minimum quantities reject implausible token consumption', () => {
  const value = responseWithRecipe();
  value.meals[0].used_items[0].quantity = 1;
  const result = assessSyntheticResponse(value, compact, {
    ...expected, minimum_quantities: { spinach: 100, tomato: 1 },
  });
  assert.equal(result.pass, false);
  assert.match(result.reason, /minimum quantity.*spinach/i);
});

test('ingredient references must be known by inventory, allowed additions, or the selected candidate', () => {
  const value = responseWithRecipe();
  value.meals[0].additional_ingredients = ['mystery spice'];
  const result = assessSyntheticResponse(value, compact, expected);
  assert.equal(result.pass, false);
  assert.match(result.reason, /ingredient.*recognized|known/i);
});

test('allergy and forbidden ingredient references fail in additions and steps', () => {
  for (const mutate of [
    (value) => { value.meals[0].additional_ingredients = ['Milch']; },
    (value) => { value.meals[0].steps = ['Milch und Spinat zubereiten.']; },
  ]) {
    const value = responseWithRecipe();
    mutate(value);
    const result = assessSyntheticResponse(value, compact, expected);
    assert.equal(result.pass, false);
    assert.match(result.reason, /forbidden|allerg/i);
  }
});

test('allergen metadata on an inventory food also blocks its use', () => {
  const compactWithAllergen = structuredClone(compact);
  compactWithAllergen.priority_foods[0].allergens = ['Milch'];
  const result = assessSyntheticResponse(responseWithRecipe(), compactWithAllergen, expected);
  assert.equal(result.pass, false);
  assert.match(result.reason, /allergy|forbidden/i);
});

test('steps may only refer to ingredients present in the meal', () => {
  const value = responseWithRecipe();
  value.meals[0].steps = ['Zucchini anbraten.'];
  const result = assessSyntheticResponse(value, compact, expected);
  assert.equal(result.pass, false);
  assert.match(result.reason, /step.*ingredient|ingredient.*step/i);
});

test('an explicit meal count rejects an appended otherwise non-empty meal', () => {
  const value = responseWithRecipe();
  value.meals.push(structuredClone(value.meals[0]));
  const result = assessSyntheticResponse(value, compact, { ...expected, meal_count: 1 });
  assert.equal(result.pass, false);
  assert.match(result.reason, /meal count|meal number|catalog or template.*exactly one meal/i);
});

test('Promptfoo quality adapter uses only explicit test expectations and fails closed', () => {
  assert.equal(assertSyntheticQuality(JSON.stringify(response()), { vars: {
    compact_context: JSON.stringify(compact), expected: JSON.stringify(expected),
  } }).pass, true);
  assert.equal(assertSyntheticQuality('{}', { vars: {} }).pass, false);
  assert.equal(assertSyntheticQuality('not json', { vars: {
    compact_context: JSON.stringify(compact), expected: JSON.stringify(expected),
  } }).pass, false);
});
