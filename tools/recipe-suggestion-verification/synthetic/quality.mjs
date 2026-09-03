// Contract/schema checks run separately. These are the scenario-specific expectations.
export function assessSyntheticResponse(output, compact, expected) {
  let response;
  try { response = typeof output === 'string' ? JSON.parse(output) : output; }
  catch { return { pass: false, score: 0, reason: 'Output is not JSON' }; }
  if (!Array.isArray(response?.meals) || !expected) {
    return { pass: false, score: 0, reason: 'Missing meals or scenario expectation' };
  }
  const used = new Map();
  for (const meal of response.meals) {
    if (meal.servings !== expected.servings || meal.servings !== compact.request.servings) {
      return { pass: false, score: 0, reason: 'servings must equal the requested household size' };
    }
    if (!Array.isArray(meal.used_items) || meal.used_items.length === 0) {
      return { pass: false, score: 0, reason: 'Every meal must use available inventory; omit recipes without remaining ingredients' };
    }
    for (const item of meal.used_items ?? []) {
      used.set(item.inventory_item_id, (used.get(item.inventory_item_id) ?? 0) + item.quantity);
    }
  }
  for (const id of expected.required_priority_ids) {
    if (!(used.get(id) > 0)) {
      return { pass: false, score: 0, reason: `Highest-priority food was not used: ${id}` };
    }
  }
  const foods = compact.priority_foods;
  const usedFoods = foods.filter((food) => used.get(food.inventory_item_id) > 0);
  if (usedFoods.length < expected.min_used_items) {
    return { pass: false, score: 0, reason: `Use at least ${expected.min_used_items} priority foods` };
  }
  // Ratios are unitless; no invented g/ml/piece conversions or claims about actual waste.
  return { pass: true, score: 1, reason: 'Synthetic inventory expectations satisfied', metrics: {
    priority_item_coverage: usedFoods.length / foods.length,
    mean_available_quantity_used: foods.reduce((sum, food) =>
      sum + (used.get(food.inventory_item_id) ?? 0) / food.available_quantity, 0) / foods.length,
  } };
}
