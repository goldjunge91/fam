const QUALITY_UNIT_DEFINITIONS = new Map([
  ['g', { dimension: 'mass', factor: 1 }], ['kg', { dimension: 'mass', factor: 1000 }],
  ['ml', { dimension: 'volume', factor: 1 }], ['l', { dimension: 'volume', factor: 1000 }],
  ['pcs', { dimension: 'count', factor: 1 }], ['piece', { dimension: 'count', factor: 1 }],
  ['pack', { dimension: 'package', factor: 1 }], ['package', { dimension: 'package', factor: 1 }],
  ['dose', { dimension: 'dose', factor: 1 }], ['portion', { dimension: 'portion', factor: 1 }],
]);
const qualityNormalizeUnit = (value) => typeof value === 'string'
  ? value.trim().toLocaleLowerCase('de-DE') : '';
const qualityNormalizeMeasurement = (quantity, unit) => {
  if (!qualityIsPositiveNumber(quantity)) return null;
  const definition = QUALITY_UNIT_DEFINITIONS.get(qualityNormalizeUnit(unit));
  if (!definition) return null;
  const normalizedQuantity = quantity * definition.factor;
  return Number.isFinite(normalizedQuantity)
    ? { quantity: normalizedQuantity, dimension: definition.dimension }
    : null;
};
const qualityNormalize = (value) => typeof value === 'string'
  ? value.trim().toLocaleLowerCase('de-DE')
  : '';

const qualityIsObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const qualityIsFiniteNumber = (value) => typeof value === 'number' && Number.isFinite(value);
const qualityIsPositiveNumber = (value) => qualityIsFiniteNumber(value) && value > 0;

function qualityFailure(reason) {
  return { pass: false, score: 0, reason };
}

function qualityIngredientMentioned(text, ingredient) {
  const normalizedText = qualityNormalize(text);
  const normalizedIngredient = qualityNormalize(ingredient);
  if (!normalizedText || !normalizedIngredient) return false;
  const escaped = normalizedIngredient.replace(/[.*+?^$()|[\]\\]/g, '\\$&');
  return new RegExp(`(?:^|[^\\p{L}\\p{N}])${escaped}(?:$|[^\\p{L}\\p{N}])`, 'u')
    .test(normalizedText);
}

function qualityNamesFrom(values) {
  return values
    .map((value) => qualityNormalize(value?.name ?? value))
    .filter(Boolean);
}

function qualityGetContext(compact) {
  if (!qualityIsObject(compact)) return qualityFailure('Synthetic context must be an object');
  const priorityFoods = Array.isArray(compact.priority_foods) ? compact.priority_foods : null;
  const constraints = qualityIsObject(compact.constraints) ? compact.constraints : {};
  const candidates = Array.isArray(compact.candidate_recipes) ? compact.candidate_recipes : [];
  if (!priorityFoods) return qualityFailure('Synthetic context is missing priority foods');

  const priorityById = new Map();
  for (const food of priorityFoods) {
    if (!qualityIsObject(food) || typeof food.inventory_item_id !== 'string' || !food.inventory_item_id
      || !qualityIsPositiveNumber(food.available_quantity) || typeof food.unit !== 'string'
      || !food.unit || !qualityNormalizeMeasurement(food.available_quantity, food.unit)) {
      return qualityFailure('Priority foods must contain usable IDs, quantities, and units');
    }
    if (priorityById.has(food.inventory_item_id)) {
      return qualityFailure(`Duplicate priority food ID: ${food.inventory_item_id}`);
    }
    priorityById.set(food.inventory_item_id, food);
  }

  const allergies = new Set(qualityNamesFrom(Array.isArray(constraints.allergies)
    ? constraints.allergies : []));
  const forbiddenIngredients = qualityNamesFrom(Array.isArray(constraints.forbidden_ingredients)
    ? constraints.forbidden_ingredients : []);
  const allowedStaples = qualityNamesFrom(Array.isArray(constraints.allowed_staples)
    ? constraints.allowed_staples : []);
  const plannedIngredients = qualityNamesFrom(Array.isArray(compact.planned_shopping_items)
    ? compact.planned_shopping_items : []);
  const candidateIngredients = candidates.flatMap((candidate) =>
    Array.isArray(candidate?.ingredient_names) ? qualityNamesFrom(candidate.ingredient_names) : []);
  const priorityIngredients = qualityNamesFrom(priorityFoods);
  const recognizedIngredients = new Set([
    ...priorityIngredients, ...allowedStaples, ...plannedIngredients, ...candidateIngredients,
  ]);

  return {
    value: {
      allergies,
      candidates,
      forbiddenIngredients,
      priorityById,
      recognizedIngredients,
      allowedStaples,
    },
  };
}

function qualityGetMinimumQuantities(expected) {
  if (expected.minimum_quantities === undefined) return { value: new Map() };
  if (!qualityIsObject(expected.minimum_quantities)) {
    return qualityFailure('expected.minimum_quantities must be an object');
  }
  const minimums = new Map();
  for (const [inventoryItemId, quantity] of Object.entries(expected.minimum_quantities)) {
    if (!inventoryItemId || !qualityIsPositiveNumber(quantity)) {
      return qualityFailure('expected.minimum_quantities must contain positive finite quantities');
    }
    minimums.set(inventoryItemId, quantity);
  }
  return { value: minimums };
}

function qualityIsBlockedIngredient(name, context) {
  return [...context.forbiddenIngredients, ...context.allergies]
    .some((blocked) => qualityIngredientMentioned(name, blocked));
}

function qualityIsAllergenicFood(food, context) {
  return Array.isArray(food.allergens)
    && food.allergens.some((allergen) => context.allergies.has(qualityNormalize(allergen)));
}

function qualityGetSelectedCandidate(meal, context) {
  if (typeof meal.recipe_id !== 'string') return null;
  return context.candidates.find((candidate) => candidate?.id === meal.recipe_id) ?? null;
}

function qualityAssertMealIngredients(meal, selectedCandidate, context, mealIndex) {
  const mealPath = `meals[${mealIndex}]`;
  const usedNames = [];
  for (const usedItem of meal.used_items) {
    const food = context.priorityById.get(usedItem.inventory_item_id);
    if (qualityIsBlockedIngredient(food.name, context) || qualityIsAllergenicFood(food, context)) {
      return qualityFailure(`${mealPath} uses an allergy or forbidden ingredient`);
    }
    usedNames.push(qualityNormalize(food.name));
  }

  if (!Array.isArray(meal.additional_ingredients)) {
    return qualityFailure(`${mealPath}.additional_ingredients must be an array`);
  }
  const additionalNames = [];
  for (const ingredient of meal.additional_ingredients) {
    if (typeof ingredient !== 'string' || !ingredient.trim()) {
      return qualityFailure(`${mealPath}.additional_ingredients must contain non-empty strings`);
    }
    if (qualityIsBlockedIngredient(ingredient, context)) {
      return qualityFailure(`${mealPath} uses an allergy or forbidden ingredient`);
    }
    const normalizedIngredient = qualityNormalize(ingredient);
    if (!context.recognizedIngredients.has(normalizedIngredient)) {
      return qualityFailure(`${mealPath}.additional_ingredients contains an unrecognized ingredient`);
    }
    additionalNames.push(normalizedIngredient);
  }

  const mealIngredients = new Set([...usedNames, ...additionalNames]);
  const candidateNames = selectedCandidate && Array.isArray(selectedCandidate.ingredient_names)
    ? qualityNamesFrom(selectedCandidate.ingredient_names)
    : [];
  if (selectedCandidate) {
    for (const ingredient of mealIngredients) {
      if (!candidateNames.includes(ingredient)) {
        return qualityFailure(`${mealPath} contains an ingredient outside its candidate recipe`);
      }
    }
  }

  if (!Array.isArray(meal.steps) || meal.steps.length === 0
    || meal.steps.some((step) => typeof step !== 'string' || !step.trim())) {
    return qualityFailure(`${mealPath}.steps must contain non-empty strings`);
  }
  const knownIngredientNames = new Set([
    ...context.recognizedIngredients, ...context.forbiddenIngredients, ...context.allergies,
  ]);
  const blockedIngredients = new Set([...context.forbiddenIngredients, ...context.allergies]);
  for (const step of meal.steps) {
    for (const ingredient of knownIngredientNames) {
      if (!qualityIngredientMentioned(step, ingredient)) continue;
      if (blockedIngredients.has(ingredient)) {
        return qualityFailure(`${mealPath}.steps uses an allergy or forbidden ingredient`);
      }
      if (!mealIngredients.has(ingredient)) {
        return qualityFailure(`${mealPath}.steps refers to an ingredient not used by the meal`);
      }
    }
  }
  return null;
}

// Contract/schema checks run separately. These are the scenario-specific expectations.
export function assessSyntheticResponse(output, compact, expected) {
  let response;
  try {
    response = typeof output === 'string' ? JSON.parse(output) : output;
  } catch {
    return qualityFailure('Output is not JSON');
  }
  if (!qualityIsObject(response) || !Array.isArray(response.meals) || !qualityIsObject(expected)) {
    return qualityFailure('Missing meals or scenario expectation');
  }
  if (!qualityIsObject(compact.request) || response.meals.length === 0) {
    return qualityFailure('Missing request or meals');
  }
  if (Array.isArray(compact.candidate_recipes) && compact.candidate_recipes.length > 0
    && response.meals.length !== 1) {
    return qualityFailure('Catalog or template suggestions must contain exactly one meal');
  }
  if (expected.meal_count !== undefined
    && (!Number.isInteger(expected.meal_count) || expected.meal_count < 1
      || response.meals.length !== expected.meal_count)) {
    return qualityFailure('Meal count does not match the explicit expectation');
  }

  const contextResult = qualityGetContext(compact);
  if (contextResult.pass === false) return contextResult;
  const context = contextResult.value;
  const minimumResult = qualityGetMinimumQuantities(expected);
  if (minimumResult.pass === false) return minimumResult;
  const used = new Map();

  for (const [mealIndex, meal] of response.meals.entries()) {
    if (!qualityIsObject(meal)) return qualityFailure(`meals[${mealIndex}] must be an object`);
    if (meal.servings !== expected.servings || meal.servings !== compact.request.servings) {
      return qualityFailure('servings must equal the requested household size');
    }
    if (!Array.isArray(meal.used_items) || meal.used_items.length === 0) {
      return qualityFailure('Every meal must use available inventory; omit recipes without remaining ingredients');
    }

    const selectedCandidate = qualityGetSelectedCandidate(meal, context);
    const mealUsedIds = new Set();
    for (const item of meal.used_items) {
      if (!qualityIsObject(item) || typeof item.inventory_item_id !== 'string') {
        return qualityFailure('used_items must refer to known inventory items');
      }
      if (mealUsedIds.has(item.inventory_item_id)) {
        return qualityFailure(`Duplicate inventory item within meal: ${item.inventory_item_id}`);
      }
      mealUsedIds.add(item.inventory_item_id);
      const food = context.priorityById.get(item.inventory_item_id);
      if (!food) return qualityFailure(`Unknown inventory item: ${item.inventory_item_id}`);
      const usedMeasurement = qualityNormalizeMeasurement(item.quantity, item.unit);
      const availableMeasurement = qualityNormalizeMeasurement(food.available_quantity, food.unit);
      if (!usedMeasurement || !availableMeasurement
        || usedMeasurement.dimension !== availableMeasurement.dimension) {
        return qualityFailure(`Invalid quantity or unit for inventory item: ${item.inventory_item_id}`);
      }
      if (selectedCandidate && !qualityNamesFrom(selectedCandidate.ingredient_names)
        .includes(qualityNormalize(food.name))) {
        return qualityFailure(`Inventory ingredient is outside the selected candidate recipe: ${food.name}`);
      }
      const totalQuantity = (used.get(item.inventory_item_id) ?? 0) + usedMeasurement.quantity;
      const tolerance = Number.EPSILON * Math.max(totalQuantity, availableMeasurement.quantity) * 4;
      if (totalQuantity - availableMeasurement.quantity > tolerance) {
        return qualityFailure(`Used quantity exceeds availability: ${item.inventory_item_id}`);
      }
      used.set(item.inventory_item_id, totalQuantity);
    }

    const ingredientFailure = qualityAssertMealIngredients(meal, selectedCandidate, context, mealIndex);
    if (ingredientFailure) return ingredientFailure;
  }

  for (const [inventoryItemId, minimumQuantity] of minimumResult.value) {
    if (!context.priorityById.has(inventoryItemId)) {
      return qualityFailure(`Minimum quantity references unknown inventory item: ${inventoryItemId}`);
    }
    if ((used.get(inventoryItemId) ?? 0) < minimumQuantity) {
      return qualityFailure(`Minimum quantity was not met for inventory item: ${inventoryItemId}`);
    }
  }
  for (const id of expected.required_priority_ids ?? []) {
    if (!(used.get(id) > 0)) {
      return qualityFailure(`Highest-priority food was not used: ${id}`);
    }
  }
  const foods = [...context.priorityById.values()];
  const usedFoods = foods.filter((food) => used.get(food.inventory_item_id) > 0);
  if (usedFoods.length < expected.min_used_items) {
    return qualityFailure(`Use at least ${expected.min_used_items} priority foods`);
  }
  return { pass: true, score: 1, reason: 'Synthetic inventory expectations satisfied', metrics: {
    priority_item_coverage: foods.length ? usedFoods.length / foods.length : 0,
    mean_available_quantity_used: foods.length
      ? foods.reduce((sum, food) => {
        const available = qualityNormalizeMeasurement(food.available_quantity, food.unit);
        return sum + (used.get(food.inventory_item_id) ?? 0) / available.quantity;
      }, 0) / foods.length
      : 0,
  } };
}
