const RESPONSE_KEYS = new Set([
  'schema_version',
  'meals',
]);
const MEAL_KEYS = new Set([
  'title',
  'source',
  'recipe_id',
  'servings',
  'used_items',
  'additional_ingredients',
  'steps',
  'notes',
]);
const USED_ITEM_KEYS = new Set(['inventory_item_id', 'quantity', 'unit']);
const CONTEXT_KEYS = new Set([
  'schema_version',
  'request',
  'constraints',
  'priority_foods',
  'planned_shopping_items',
  'candidate_recipes',
  'shopping_question',
  'fallback_allowed',
]);
const REQUEST_KEYS = new Set(['type', 'servings']);
const CONSTRAINT_KEYS = new Set([
  'allergies',
  'preferences',
  'allowed_staples',
  'forbidden_ingredients',
]);
const PRIORITY_FOOD_KEYS = new Set([
  'inventory_item_id',
  'name',
  'available_quantity',
  'unit',
  'priority_score',
]);
const PLANNED_SHOPPING_ITEM_KEYS = new Set([
  'shopping_item_id',
  'name',
  'quantity',
  'unit',
]);
const CANDIDATE_RECIPE_KEYS = new Set([
  'id',
  'source',
  'title',
  'ingredient_names',
]);
const RECIPE_SOURCES = new Set(['catalog', 'template']);
const SOURCES = new Set(['catalog', 'template', 'model_generated']);
const UNIT_DEFINITIONS = new Map([
  ['g', { dimension: 'mass', factor: 1 }], ['kg', { dimension: 'mass', factor: 1000 }],
  ['ml', { dimension: 'volume', factor: 1 }], ['l', { dimension: 'volume', factor: 1000 }],
  ['pcs', { dimension: 'count', factor: 1 }], ['piece', { dimension: 'count', factor: 1 }],
  ['pack', { dimension: 'package', factor: 1 }], ['package', { dimension: 'package', factor: 1 }],
  ['dose', { dimension: 'dose', factor: 1 }], ['portion', { dimension: 'portion', factor: 1 }],
]);

function normalize(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function hasExactKeys(value, keys) {
  return isObject(value) && Object.keys(value).length === keys.size && Object.keys(value).every((key) => keys.has(key));
}

function isFiniteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function normalizeMeasurement(quantity, unit) {
  if (!isFiniteNumber(quantity) || quantity <= 0 || !isNonEmptyString(unit)) return null;
  const definition = UNIT_DEFINITIONS.get(normalize(unit));
  if (!definition) return null;
  const normalizedQuantity = quantity * definition.factor;
  return Number.isFinite(normalizedQuantity)
    ? { quantity: normalizedQuantity, dimension: definition.dimension }
    : null;
}

function readJson(value) {
  if (typeof value !== 'string') return value;

  try {
    return JSON.parse(value.trim());
  } catch {
    // Tabular Data keeps ChainForge's escaped braces in response.var.
    // Decode only the input context; model output is still parsed strictly.
    try {
      return JSON.parse(value.trim().replace(/\\([{}])/g, '$1'));
    } catch {
      return null;
    }
  }
}

function parseResponse(response) {
  if (!isObject(response) || typeof response.text !== 'string') return null;

  try {
    return JSON.parse(response.text.trim());
  } catch {
    return null;
  }
}

function readStringList(value, requireNonEmpty = false) {
  if (!Array.isArray(value) || !value.every((item) => typeof item === 'string')) return null;
  if (requireNonEmpty && !value.every(isNonEmptyString)) return null;
  return value;
}

function readCompactContext(response) {
  if (!isObject(response) || !isObject(response.var)) return null;

  const context = readJson(response.var.compact_context);
  if (!hasExactKeys(context, CONTEXT_KEYS) || context.schema_version !== 1) return null;
  if (
    !hasExactKeys(context.request, REQUEST_KEYS) ||
    context.request.type !== 'recipe_suggestion' ||
    !Number.isInteger(context.request.servings) ||
    context.request.servings < 1
  ) return null;
  if (context.shopping_question !== null && !isNonEmptyString(context.shopping_question)) return null;
  if (typeof context.fallback_allowed !== 'boolean') return null;

  if (!hasExactKeys(context.constraints, CONSTRAINT_KEYS)) return null;
  const allergies = readStringList(context.constraints.allergies);
  const preferences = readStringList(context.constraints.preferences);
  const allowedStaples = readStringList(context.constraints.allowed_staples, true);
  const forbiddenIngredients = readStringList(context.constraints.forbidden_ingredients, true);
  if (!allergies || !preferences || !allowedStaples || !forbiddenIngredients) return null;

  if (!Array.isArray(context.priority_foods)) return null;
  const priorityFoods = [];
  for (const food of context.priority_foods) {
    if (
      !hasExactKeys(food, PRIORITY_FOOD_KEYS) ||
      !isNonEmptyString(food.inventory_item_id) ||
      !isNonEmptyString(food.name) ||
      !isNonEmptyString(food.unit) ||
      !isFiniteNumber(food.available_quantity) ||
      food.available_quantity <= 0 ||
      !isFiniteNumber(food.priority_score) ||
      !normalizeMeasurement(food.available_quantity, food.unit)
    ) {
      return null;
    }
    priorityFoods.push(food);
  }

  if (!Array.isArray(context.planned_shopping_items)) return null;
  const plannedShoppingNames = [];
  for (const item of context.planned_shopping_items) {
    if (
      !hasExactKeys(item, PLANNED_SHOPPING_ITEM_KEYS) ||
      !isNonEmptyString(item.shopping_item_id) ||
      !isNonEmptyString(item.name) ||
      !isFiniteNumber(item.quantity) ||
      item.quantity <= 0 ||
      !isNonEmptyString(item.unit)
    ) {
      return null;
    }
    plannedShoppingNames.push(normalize(item.name));
  }

  if (!Array.isArray(context.candidate_recipes)) return null;
  if (context.candidate_recipes.length > 3) return null;
  const candidateRecipes = [];
  const candidateIds = new Set();
  for (const recipe of context.candidate_recipes) {
    if (
      !hasExactKeys(recipe, CANDIDATE_RECIPE_KEYS) ||
      !isNonEmptyString(recipe.id) ||
      !/^[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(recipe.id) ||
      !RECIPE_SOURCES.has(recipe.source) ||
      !isNonEmptyString(recipe.title) ||
      !readStringList(recipe.ingredient_names, true) ||
      candidateIds.has(recipe.id)
    ) {
      return null;
    }
    candidateIds.add(recipe.id);
    candidateRecipes.push(recipe);
  }

  if (
    context.fallback_allowed !== (candidateRecipes.length === 0) ||
    (context.shopping_question !== null && context.planned_shopping_items.length > 0)
  ) return null;

  return {
    allowedStaples: new Set(allowedStaples.map(normalize)),
    forbiddenIngredients: new Set(forbiddenIngredients.map(normalize)),
    plannedShoppingNames: new Set(plannedShoppingNames),
    priorityFoods,
    candidateRecipes,
    fallbackAllowed: context.fallback_allowed,
  };
}

function hasValidUsedItem(usedItem, priorityFoods) {
  if (
    !hasExactKeys(usedItem, USED_ITEM_KEYS) ||
    !isNonEmptyString(usedItem.inventory_item_id) ||
    !isFiniteNumber(usedItem.quantity) ||
    usedItem.quantity <= 0 ||
    !isNonEmptyString(usedItem.unit)
  ) {
    return false;
  }

  const priorityFood = priorityFoods.find(
    (food) => food.inventory_item_id === usedItem.inventory_item_id,
  );
  const usedMeasurement = normalizeMeasurement(usedItem.quantity, usedItem.unit);
  const availableMeasurement = priorityFood
    && normalizeMeasurement(priorityFood.available_quantity, priorityFood.unit);
  return Boolean(
    priorityFood && usedMeasurement && availableMeasurement
      && usedMeasurement.dimension === availableMeasurement.dimension,
  );
}

function hasAllowedAdditionalIngredients(meal, context) {
  if (!Array.isArray(meal.additional_ingredients)) return false;

  return meal.additional_ingredients.every((ingredient) => {
    if (!isNonEmptyString(ingredient)) return false;
    const normalizedIngredient = normalize(ingredient);
    const allowed =
      context.allowedStaples.has(normalizedIngredient) ||
      context.plannedShoppingNames.has(normalizedIngredient);
    return allowed && !context.forbiddenIngredients.has(normalizedIngredient);
  });
}

function hasKnownRecipe(meal, context) {
  if (meal.source === 'model_generated') {
    return context.fallbackAllowed && meal.recipe_id === null;
  }

  if (!isNonEmptyString(meal.recipe_id)) return false;
  return context.candidateRecipes.some(
    (recipe) => recipe.id === meal.recipe_id && recipe.source === meal.source,
  );
}

function evaluate(response) {
  const output = parseResponse(response);
  const context = readCompactContext(response);
  if (!hasExactKeys(output, RESPONSE_KEYS) || !context) return false;
  if (output.schema_version !== 1 || !Array.isArray(output.meals) || output.meals.length < 1 || output.meals.length > 3) return false;
  if (context.candidateRecipes.length > 0 && output.meals.length !== 1) return false;

  const usedQuantities = new Map();
  for (const meal of output.meals) {
    if (!hasExactKeys(meal, MEAL_KEYS)) return false;
    if (!isNonEmptyString(meal.title) || !SOURCES.has(meal.source)) return false;
    if (!Number.isInteger(meal.servings) || meal.servings < 1) return false;
    if (!Array.isArray(meal.used_items) || !hasAllowedAdditionalIngredients(meal, context)) return false;
    if (!Array.isArray(meal.steps) || meal.steps.length < 1 || !meal.steps.every(isNonEmptyString)) return false;
    if (!Array.isArray(meal.notes) || !meal.notes.every((note) => typeof note === 'string')) return false;
    if (!hasKnownRecipe(meal, context)) return false;
    const mealUsedIds = new Set();
    for (const usedItem of meal.used_items) {
      if (!hasValidUsedItem(usedItem, context.priorityFoods)) return false;
      if (mealUsedIds.has(usedItem.inventory_item_id)) return false;
      mealUsedIds.add(usedItem.inventory_item_id);
      const priorityFood = context.priorityFoods.find(
        (food) => food.inventory_item_id === usedItem.inventory_item_id,
      );
      const usedMeasurement = normalizeMeasurement(usedItem.quantity, usedItem.unit);
      const availableMeasurement = priorityFood
        && normalizeMeasurement(priorityFood.available_quantity, priorityFood.unit);
      const totalQuantity =
        (usedQuantities.get(usedItem.inventory_item_id) ?? 0) + usedMeasurement.quantity;
      const tolerance = Number.EPSILON * Math.max(totalQuantity, availableMeasurement.quantity) * 4;
      if (!priorityFood || !usedMeasurement || !availableMeasurement
        || usedMeasurement.dimension !== availableMeasurement.dimension
        || totalQuantity - availableMeasurement.quantity > tolerance) return false;
      usedQuantities.set(usedItem.inventory_item_id, totalQuantity);
    }
  }

  return true;
}

if (typeof module !== 'undefined') module.exports = { evaluate };
