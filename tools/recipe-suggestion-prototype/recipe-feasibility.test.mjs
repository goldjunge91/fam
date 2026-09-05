import assert from 'node:assert/strict';
import { test } from 'node:test';
import { assessRecipeFeasibility } from './recipe-feasibility.mjs';

const recipe = {
  servings: 2, ingredientNames: ['Tomaten', 'Spinat'],
  ingredients: [{ name: 'Tomaten', quantity: 300, unit: 'g' }, { name: 'Spinat', quantity: 200, unit: 'g' }],
};
const stock = [
  { id: 'tomaten-alt', name: 'Tomaten', quantity: 0.2, unit: 'kg' },
  { id: 'tomaten-neu', name: 'Tomaten', quantity: 400, unit: 'g' },
  { id: 'spinat', name: 'Spinat', quantity: 400, unit: 'g' },
];
const assess = (candidate = recipe, inventory = stock, servings = 4, extra = {}) =>
  assessRecipeFeasibility(candidate, { inventory, servings, ...extra });

test('scales recipe requirements for household size and combines compatible inventory lots', () => {
  assert.equal(assess().feasible, true);
  assert.equal(assess(recipe, stock, 6).feasible, false);
  assert.deepEqual(assess(recipe, stock, 6).missingIngredients, [
    { name: 'Tomaten', quantity: 300, unit: 'g' }, { name: 'Spinat', quantity: 200, unit: 'g' },
  ]);
});

test('repeated ingredient rows share availability instead of spending the same stock twice', () => {
  const candidate = { servings: 1, ingredientNames: ['Tomaten'], ingredients: [
    { name: 'Tomaten', quantity: 200, unit: 'g' }, { name: 'Tomaten', quantity: 200, unit: 'g' },
  ] };
  assert.equal(assess(candidate, [{ id: 'tomaten', name: 'Tomaten', quantity: 300, unit: 'g' }], 1).feasible, false);
});

test('does not infer piece weights or pack sizes from names', () => {
  for (const unit of ['pcs', 'pack', 'dose']) {
    const inventory = stock.map((item) => ({ ...item, quantity: 999, unit }));
    assert.equal(assess(recipe, inventory).feasible, false);
  }
  const liquid = { servings: 1, ingredientNames: ['Haferdrink'], ingredients: [{ name: 'Haferdrink', quantity: 250, unit: 'ml' }] };
  assert.equal(assess(liquid, [{ id: 'haferdrink', name: 'Haferdrink', quantity: 0.5, unit: 'l' }], 2).feasible, true);
});

test('only explicitly passed confirmed shopping can cover shortages and is not added to stock', () => {
  const inventory = structuredClone(stock);
  const before = structuredClone(inventory);
  const plannedShoppingItems = [{ shopping_item_id: 'shop-spinat', name: 'Spinat', quantity: 0.2, unit: 'kg' }];
  assert.equal(assess(recipe, inventory, 5).feasible, false);
  assert.equal(assess(recipe, inventory, 5, { plannedShoppingItems }).feasible, false, 'tomatoes still short');
  plannedShoppingItems.push({ shopping_item_id: 'shop-tomaten', name: 'Tomaten', quantity: 150, unit: 'g' });
  assert.equal(assess(recipe, inventory, 5, { plannedShoppingItems }).feasible, true);
  assert.deepEqual(inventory, before);
});

test('explicit staple allowlist supplies only the declared staple ingredients', () => {
  const candidate = { servings: 1, ingredientNames: ['Salz'], ingredients: [{ name: 'Salz', quantity: 1, unit: 'g' }] };
  assert.equal(assess(candidate, [], 1).feasible, false);
  assert.equal(assess(candidate, [], 1, { allowedStaples: ['Salz'] }).feasible, true);
});

test('missing recipe measures are unknown, never silently treated as enough', () => {
  assert.equal(assess({ ingredientNames: ['Tomaten'] }).reason, 'missing_recipe_quantities');
  for (const candidate of [
    { ...recipe, servings: 0 }, { ...recipe, ingredients: [] },
    { ...recipe, ingredients: recipe.ingredients.slice(0, 1) },
    { ...recipe, ingredients: [{ name: 'Tomaten', quantity: NaN, unit: 'g' }, recipe.ingredients[1]] },
  ]) assert.equal(assess(candidate).feasible, false);
  assert.equal(assess(recipe, stock, 0).feasible, false);
});

test('duplicate inventory identities and nonfinite aggregate quantities cannot inflate availability', () => {
  assert.equal(assess(recipe, [stock[0], stock[0], ...stock]).feasible, false);
  assert.equal(assess(recipe, stock.map((item) => ({ ...item, quantity: Infinity }))).feasible, false);
});

test('fractional quantities allow roundoff but reject a real shortage', () => {
  const candidate = { servings: 1, ingredientNames: ['Reis'], ingredients: [{ name: 'Reis', quantity: 0.1 + 0.2, unit: 'kg' }] };
  assert.equal(assess(candidate, [{ id: 'reis', name: 'Reis', quantity: 300, unit: 'g' }], 1).feasible, true);
  assert.equal(assess(candidate, [{ id: 'reis', name: 'Reis', quantity: 299.99, unit: 'g' }], 1).feasible, false);
});

test('malformed ingredient and stock collections fail closed rather than throwing or guessing', () => {
  for (const candidate of [
    { ...recipe, ingredientNames: 'Tomaten' }, { ...recipe, ingredientNames: [42] },
    { ...recipe, ingredients: [null] },
  ]) assert.equal(assess(candidate).feasible, false);
  assert.equal(assess(recipe, null).feasible, false);
  assert.equal(assess(recipe, [null]).feasible, false);
  assert.equal(assess(recipe, stock, 4, { plannedShoppingItems: null }).feasible, false);
});
