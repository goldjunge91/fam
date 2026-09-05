import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { buildRecipeContext } from './recipe-suggestion.mjs';

function rawInput() {
  return {
    referenceDate: '2026-09-03', servings: 4, allergies: [], preferences: [], allowedStaples: [],
    forbiddenIngredients: [], shoppingList: [],
    inventory: [
      { id: 'tomaten-alt', name: 'Tomaten', quantity: 200, unit: 'g', bestBefore: '2026-09-04', allergens: [] },
      { id: 'tomaten-neu', name: 'Tomaten', quantity: 0.4, unit: 'kg', bestBefore: '2026-09-08', allergens: [] },
      { id: 'spinat', name: 'Spinat', quantity: 400, unit: 'g', bestBefore: '2026-09-03', allergens: [] },
    ],
    candidateRecipes: [{
      id: 'spinat-tomaten-pfanne', title: 'Spinat-Tomaten-Pfanne', source: 'template',
      ingredientNames: ['Spinat', 'Tomaten'], servings: 2,
      ingredients: [{ name: 'Spinat', quantity: 200, unit: 'g' }, { name: 'Tomaten', quantity: 300, unit: 'g' }],
    }],
  };
}

test('raw dates drive the context order and known amounts admit exactly enough food for four', () => {
  const input = rawInput();
  const before = structuredClone(input);
  const context = buildRecipeContext(input);
  assert.deepEqual(context.priority_foods.map((item) => item.inventory_item_id), ['spinat', 'tomaten-alt', 'tomaten-neu']);
  assert.deepEqual(context.priority_foods.map((item) => item.priority_score), [80, 40, 13.333]);
  assert.equal(context.candidate_recipes[0].id, 'spinat-tomaten-pfanne');
  assert.equal(context.fallback_allowed, false);
  assert.deepEqual(Object.keys(context.candidate_recipes[0]).sort(), ['id', 'ingredient_names', 'source', 'title']);
  assert.deepEqual(input, before);
});

test('insufficient portions or absent recipe quantities cannot pass the new selection path', () => {
  const input = rawInput();
  input.servings = 6;
  assert.deepEqual(buildRecipeContext(input).candidate_recipes, []);
  input.servings = 4;
  delete input.candidateRecipes[0].ingredients;
  delete input.candidateRecipes[0].servings;
  assert.equal(buildRecipeContext(input).fallback_allowed, true);
});

test('recipe quantity checks apply even to pre-scored legacy inputs when measures are supplied', () => {
  const input = rawInput();
  delete input.referenceDate;
  input.inventory.forEach((item) => { delete item.bestBefore; item.priorityScore = 1; });
  input.servings = 6;
  assert.deepEqual(buildRecipeContext(input).candidate_recipes, []);
});

test('only confirmed shopping can bridge a shortage; no inventory changes or token-heavy recipe metadata', () => {
  const input = rawInput();
  input.servings = 6;
  input.shoppingList = [
    { id: 'shop-spinat', name: 'Spinat', quantity: 200, unit: 'g' },
    { id: 'shop-tomaten', name: 'Tomaten', quantity: 300, unit: 'g' },
  ];
  const before = structuredClone(input);
  assert.equal(buildRecipeContext(input).fallback_allowed, true);
  assert.equal(buildRecipeContext(input).shopping_question, 'Willst du heute noch einkaufen?');
  assert.equal(buildRecipeContext(input, 'no').fallback_allowed, true);
  assert.equal(buildRecipeContext(input, 'yes').fallback_allowed, false);
  assert.equal(buildRecipeContext(input, 'yes').priority_foods.length, 3);
  assert.deepEqual(input, before);
});

test('supplied fixture scores cannot override computed dates and raw dates require an explicit clock', () => {
  const input = rawInput();
  input.inventory[2].priorityScore = -999;
  assert.equal(buildRecipeContext(input).priority_foods[0].inventory_item_id, 'spinat');
  delete input.referenceDate;
  assert.throws(() => buildRecipeContext(input), /referenceDate/);
});

test('explicit unusability and forbidden ingredients still override freshness and quantities', () => {
  const input = rawInput();
  input.inventory[2].expired = true;
  assert.equal(buildRecipeContext(input).fallback_allowed, true);
  assert.equal(buildRecipeContext(input).priority_foods.some((item) => item.name === 'Spinat'), false);
  input.inventory[2].expired = false;
  input.forbiddenIngredients = ['Spinat'];
  assert.equal(buildRecipeContext(input).fallback_allowed, true);
});

test('optional recipe-source quantities stay outside the compact context schema', async () => {
  const source = JSON.parse(await readFile(new URL('schemas/recipe-source.schema.json', import.meta.url)));
  const context = JSON.parse(await readFile(new URL('schemas/recipe-suggestion-context.schema.json', import.meta.url)));
  assert.deepEqual(source.dependentRequired, { servings: ['ingredients'], ingredients: ['servings'] });
  assert.equal(source.properties.servings.minimum, 1);
  assert.deepEqual(source.properties.ingredients.items.required, ['name', 'quantity', 'unit']);
  assert.equal(source.properties.ingredients.items.additionalProperties, false);
  assert.equal(Object.hasOwn(context.properties.candidate_recipes.items.properties, 'ingredients'), false);
});
