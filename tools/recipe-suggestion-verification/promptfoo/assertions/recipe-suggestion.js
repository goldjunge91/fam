'use strict';

import { normalizeMeasurement } from '../../../recipe-suggestion-prototype/unit-normalization.mjs';

const SCHEMA_VERSION = 1;
const ALLOWED_SOURCES = new Set(['catalog', 'template', 'model_generated']);
const RECIPE_SOURCES = new Set(['catalog', 'template']);
const RESPONSE_KEYS = new Set(['schema_version', 'meals']);
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
const CANDIDATE_RECIPE_KEYS = new Set(['id', 'source', 'title', 'ingredient_names']);
const IDENTIFIER_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]*$/;

function failure(reason) {
  return { pass: false, score: 0, reason };
}

function success() {
  return {
    pass: true,
    score: 1,
    reason: 'Response satisfies the semantic recipe-suggestion contract',
  };
}

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function hasExactKeys(value, keys) {
  return (
    isObject(value) &&
    Object.keys(value).length === keys.size &&
    Object.keys(value).every((key) => keys.has(key))
  );
}

function normalize(value) {
  return typeof value === 'string'
    ? value.trim().toLocaleLowerCase('de-DE')
    : '';
}

function isFiniteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

function isPositiveNumber(value) {
  return isFiniteNumber(value) && value > 0;
}

function isPositiveInteger(value) {
  return Number.isInteger(value) && value > 0;
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function parseCompactContext(context) {
  const compactContext = context?.vars?.compact_context;

  if (typeof compactContext !== 'string') {
    return failure('compact_context must be a JSON string');
  }

  try {
    const value = JSON.parse(compactContext);
    if (!isObject(value)) {
      return failure('compact_context must contain a JSON object');
    }
    return { value };
  } catch {
    return failure('compact_context is not valid JSON');
  }
}

function getResponse(output) {
  if (typeof output !== 'string') {
    return failure('model output must be a JSON string');
  }

  try {
    const value = JSON.parse(output);
    if (!isObject(value)) {
      return failure('model output must be a JSON object');
    }
    return { value };
  } catch {
    return failure('model output is not parseable JSON');
  }
}

function validateContextShape(compactContext) {
  if (!hasExactKeys(compactContext, CONTEXT_KEYS)) {
    return failure('compact_context contains fields outside the canonical schema');
  }
  if (compactContext.schema_version !== SCHEMA_VERSION) {
    return failure('compact_context schema_version must be 1');
  }
  if (
    !hasExactKeys(compactContext.request, REQUEST_KEYS) ||
    compactContext.request.type !== 'recipe_suggestion' ||
    !isPositiveInteger(compactContext.request.servings)
  ) {
    return failure('compact_context request does not match the canonical schema');
  }
  if (!hasExactKeys(compactContext.constraints, CONSTRAINT_KEYS)) {
    return failure('compact_context constraints do not match the canonical schema');
  }
  for (const field of ['allergies', 'preferences']) {
    if (
      !Array.isArray(compactContext.constraints[field]) ||
      !compactContext.constraints[field].every((value) => typeof value === 'string')
    ) {
      return failure(`compact_context constraints.${field} must be an array of strings`);
    }
  }
  for (const field of ['allowed_staples', 'forbidden_ingredients']) {
    if (
      !Array.isArray(compactContext.constraints[field]) ||
      !compactContext.constraints[field].every(isNonEmptyString)
    ) {
      return failure(`compact_context constraints.${field} must contain non-empty strings`);
    }
  }
  if (typeof compactContext.fallback_allowed !== 'boolean') {
    return failure('compact_context fallback_allowed must be boolean');
  }
  if (
    compactContext.shopping_question !== null &&
    typeof compactContext.shopping_question !== 'string'
  ) {
    return failure('compact_context shopping_question must be a string or null');
  }
  if (!Array.isArray(compactContext.priority_foods)) {
    return failure('compact_context priority_foods must be an array');
  }
  if (!Array.isArray(compactContext.planned_shopping_items)) {
    return failure('compact_context planned_shopping_items must be an array');
  }
  if (!Array.isArray(compactContext.candidate_recipes)) {
    return failure('compact_context candidate_recipes must be an array');
  }
  if (compactContext.candidate_recipes.length > 3) {
    return failure('compact_context candidate_recipes must contain at most 3 entries');
  }
  if (
    compactContext.fallback_allowed !== (compactContext.candidate_recipes.length === 0)
  ) {
    return failure('compact_context fallback_allowed does not match candidate_recipes');
  }
  if (
    compactContext.shopping_question !== null &&
    compactContext.planned_shopping_items.length > 0
  ) {
    return failure('compact_context shopping_question must be null when shopping is planned');
  }

  return success();
}

function getPriorityFoods(compactContext) {
  const foods = new Map();

  for (const food of compactContext.priority_foods) {
    if (
      !hasExactKeys(food, PRIORITY_FOOD_KEYS) ||
      !isNonEmptyString(food.inventory_item_id) ||
      !isNonEmptyString(food.name) ||
      !isNonEmptyString(food.unit) ||
      !isPositiveNumber(food.available_quantity) ||
      !isFiniteNumber(food.priority_score) ||
      !normalizeMeasurement(food.available_quantity, food.unit)
    ) {
      return failure('priority_foods entries must match the canonical schema');
    }
    foods.set(food.inventory_item_id, food);
  }

  return { value: foods };
}

function getCandidateRecipes(compactContext) {
  const candidates = new Map();

  for (const recipe of compactContext.candidate_recipes) {
    if (
      !hasExactKeys(recipe, CANDIDATE_RECIPE_KEYS) ||
      !isNonEmptyString(recipe.id) ||
      !IDENTIFIER_PATTERN.test(recipe.id) ||
      !RECIPE_SOURCES.has(recipe.source) ||
      !isNonEmptyString(recipe.title) ||
      !Array.isArray(recipe.ingredient_names) ||
      recipe.ingredient_names.length < 1 ||
      !recipe.ingredient_names.every(isNonEmptyString) ||
      candidates.has(recipe.id)
    ) {
      return failure('candidate_recipes entries must match the canonical schema');
    }
    candidates.set(recipe.id, recipe);
  }

  return { value: candidates };
}

function assertResponse(output, context) {
  const responseResult = getResponse(output);
  if (responseResult.pass === false) {
    return responseResult;
  }

  const contextResult = parseCompactContext(context);
  if (contextResult.pass === false) {
    return contextResult;
  }

  const compactContext = contextResult.value;
  const contextShapeResult = validateContextShape(compactContext);
  if (contextShapeResult.pass === false) {
    return contextShapeResult;
  }

  const priorityFoodsResult = getPriorityFoods(compactContext);
  if (priorityFoodsResult.pass === false) {
    return priorityFoodsResult;
  }

  const candidateRecipesResult = getCandidateRecipes(compactContext);
  if (candidateRecipesResult.pass === false) {
    return candidateRecipesResult;
  }

  const response = responseResult.value;
  const priorityFoods = priorityFoodsResult.value;
  const candidateRecipes = candidateRecipesResult.value;
  if (!hasExactKeys(response, RESPONSE_KEYS)) {
    return failure('response contains fields outside the canonical schema');
  }
  if (response.schema_version !== SCHEMA_VERSION) {
    return failure('schema_version must be 1');
  }
  if (!Array.isArray(response.meals) || response.meals.length < 1 || response.meals.length > 3) {
    return failure('response must contain 1 to 3 meals');
  }
  if (compactContext.candidate_recipes.length > 0 && response.meals.length !== 1) {
    return failure('catalog or template suggestions must contain exactly one meal');
  }

  const allowedAdditionalIngredients = new Set([
    ...compactContext.constraints.allowed_staples.map(normalize),
    ...compactContext.planned_shopping_items.map((item) => normalize(item?.name)),
  ]);
  const forbiddenIngredients = new Set(
    compactContext.constraints.forbidden_ingredients.map(normalize),
  );
  const usedQuantities = new Map();

  for (const [mealIndex, meal] of response.meals.entries()) {
    const mealPath = `meals[${mealIndex}]`;
    if (!hasExactKeys(meal, MEAL_KEYS)) {
      return failure(`${mealPath} contains fields outside the canonical schema`);
    }
    if (typeof meal.title !== 'string' || !meal.title.trim()) {
      return failure(`${mealPath}.title must be a non-empty string`);
    }
    if (!ALLOWED_SOURCES.has(meal.source)) {
      return failure(`${mealPath}.source is invalid`);
    }
    if (!Number.isInteger(meal.servings) || meal.servings < 1) {
      return failure(`${mealPath}.servings must be a positive integer`);
    }

    if (meal.source === 'model_generated') {
      if (meal.recipe_id !== null) {
        return failure(`${mealPath}.recipe_id must be null for model_generated`);
      }
      if (!compactContext.fallback_allowed) {
        return failure(`${mealPath} uses model_generated while fallback_allowed is false`);
      }
    } else {
      const candidate = candidateRecipes.get(meal.recipe_id);
      if (!candidate) {
        return failure(`${mealPath}.recipe_id is not in candidate_recipes`);
      }
      if (candidate.source !== meal.source) {
        return failure(`${mealPath}.source does not match candidate_recipes`);
      }
    }

    if (!Array.isArray(meal.used_items)) {
      return failure(`${mealPath}.used_items must be an array`);
    }
    const mealUsedIds = new Set();
    for (const [itemIndex, usedItem] of meal.used_items.entries()) {
      const itemPath = `${mealPath}.used_items[${itemIndex}]`;
      if (!hasExactKeys(usedItem, USED_ITEM_KEYS)) {
        return failure(`${itemPath} contains fields outside the canonical schema`);
      }
      if (mealUsedIds.has(usedItem.inventory_item_id)) {
        return failure(`${itemPath}.inventory_item_id is duplicated within the meal; combine quantities`);
      }
      mealUsedIds.add(usedItem.inventory_item_id);
      const priorityFood = priorityFoods.get(usedItem.inventory_item_id);
      if (!priorityFood) {
        return failure(`${itemPath}.inventory_item_id is not in priority_foods`);
      }
      if (!isPositiveNumber(usedItem.quantity)) {
        return failure(`${itemPath}.quantity exceeds priority_foods or is not positive`);
      }
      const usedMeasurement = normalizeMeasurement(usedItem.quantity, usedItem.unit);
      const availableMeasurement = normalizeMeasurement(
        priorityFood.available_quantity,
        priorityFood.unit,
      );
      if (!usedMeasurement || !availableMeasurement
        || usedMeasurement.dimension !== availableMeasurement.dimension) {
        return failure(`${itemPath}.unit is incompatible with priority_foods`);
      }
      const totalQuantity =
        (usedQuantities.get(usedItem.inventory_item_id) ?? 0) + usedMeasurement.quantity;
      const tolerance = Number.EPSILON * Math.max(totalQuantity, availableMeasurement.quantity) * 4;
      if (totalQuantity - availableMeasurement.quantity > tolerance) {
        return failure(`${itemPath}.quantity exceeds total priority_foods availability`);
      }
      usedQuantities.set(usedItem.inventory_item_id, totalQuantity);
    }

    if (!Array.isArray(meal.additional_ingredients)) {
      return failure(`${mealPath}.additional_ingredients must be an array`);
    }
    for (const additionalIngredient of meal.additional_ingredients) {
      const normalizedName = normalize(additionalIngredient);
      if (!normalizedName) {
        return failure(`${mealPath}.additional_ingredients must contain non-empty strings`);
      }
      if (forbiddenIngredients.has(normalizedName)) {
        return failure(`${mealPath}.additional_ingredients contains a forbidden ingredient`);
      }
      if (!allowedAdditionalIngredients.has(normalizedName)) {
        return failure(`${mealPath}.additional_ingredients is not allowlisted`);
      }
    }

    if (
      !Array.isArray(meal.steps) ||
      meal.steps.length === 0 ||
      meal.steps.some((step) => typeof step !== 'string' || !step.trim())
    ) {
      return failure(`${mealPath}.steps must contain non-empty strings`);
    }
    if (!Array.isArray(meal.notes) || meal.notes.some((note) => typeof note !== 'string')) {
      return failure(`${mealPath}.notes must be an array of strings`);
    }
  }

  return success();
}

export default assertResponse;
