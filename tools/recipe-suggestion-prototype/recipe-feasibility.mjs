import { normalizeMeasurement } from './unit-normalization.mjs';

const normalize = (value) => typeof value === 'string' ? value.trim().toLocaleLowerCase('de-DE') : '';
const positive = (value) => typeof value === 'number' && Number.isFinite(value) && value > 0;
const failure = (reason) => ({ feasible: false, reason, missingIngredients: [] });

function measure(item) {
  const measurement = normalizeMeasurement(item?.quantity, item?.unit);
  if (!normalize(item?.name) || !measurement) return null;
  return {
    key: JSON.stringify([normalize(item.name), measurement.dimension]),
    name: item.name,
    quantity: measurement.quantity,
    unit: measurement.unit,
  };
}

// Checks each recipe independently as an alternative, without reserving or changing stock.
// allowedStaples is the existing explicit pantry assumption, not inferred availability.
export function assessRecipeFeasibility(recipe, {
  servings, inventory, plannedShoppingItems = [], allowedStaples = [],
}) {
  if (!Number.isInteger(servings) || servings < 1) return failure('invalid_servings');
  if (!Array.isArray(inventory) || !Array.isArray(plannedShoppingItems)
    || !Array.isArray(allowedStaples)) return failure('invalid_availability');
  if (!Number.isInteger(recipe?.servings) || recipe.servings < 1
    || !Array.isArray(recipe.ingredients) || recipe.ingredients.length === 0) {
    return failure('missing_recipe_quantities');
  }
  if (!Array.isArray(recipe.ingredientNames)) return failure('invalid_recipe_ingredients');
  const ingredientNames = new Set(recipe.ingredientNames.map(normalize));
  if (ingredientNames.size === 0 || ingredientNames.has('')) return failure('invalid_recipe_ingredients');
  const needs = new Map();
  const measuredNames = new Set();
  for (const ingredient of recipe.ingredients) {
    const amount = measure(ingredient);
    if (!amount || !ingredientNames.has(normalize(ingredient.name))) return failure('invalid_recipe_quantities');
    measuredNames.add(normalize(ingredient.name));
    const quantity = (needs.get(amount.key)?.quantity ?? 0) + amount.quantity * (servings / recipe.servings);
    if (!positive(quantity)) return failure('invalid_recipe_quantities');
    needs.set(amount.key, { ...amount, quantity });
  }
  if (measuredNames.size !== ingredientNames.size) return failure('missing_recipe_quantities');

  const available = new Map();
  const identities = new Set();
  for (const [source, items] of [['inventory', inventory], ['shopping', plannedShoppingItems]]) {
    for (const item of items) {
      const id = source === 'inventory' ? item?.id : item?.shopping_item_id;
      const identity = JSON.stringify([source, id]);
      if (!normalize(id) || identities.has(identity)) return failure('invalid_stock_identity');
      identities.add(identity);
      const amount = measure(item);
      if (!amount) return failure('invalid_stock_quantity');
      const quantity = (available.get(amount.key) ?? 0) + amount.quantity;
      if (!positive(quantity)) return failure('invalid_stock_quantity');
      available.set(amount.key, quantity);
    }
  }
  const staples = new Set(allowedStaples.map(normalize));
  const missingIngredients = [];
  for (const { key, name, quantity, unit } of needs.values()) {
    if (staples.has(normalize(name))) continue;
    const present = available.get(key) ?? 0;
    const shortage = quantity - present;
    const tolerance = Number.EPSILON * 8 * Math.max(quantity, present);
    if (shortage > tolerance) missingIngredients.push({ name, quantity: shortage, unit });
  }
  return { feasible: missingIngredients.length === 0,
    reason: missingIngredients.length ? 'insufficient_quantity' : null, missingIngredients };
}
