import { fromJSONSchema } from 'zod';
import responseJsonSchema from './schemas/recipe-suggestion-response.schema.json' with { type: 'json' };
import { priorityScore } from './priority-score.mjs';
import { assessRecipeFeasibility } from './recipe-feasibility.mjs';
import { normalizeMeasurement } from './unit-normalization.mjs';

const SCHEMA_VERSION = 1;
const SHOPPING_QUESTION = 'Willst du heute noch einkaufen?';
const responseSchema = fromJSONSchema(responseJsonSchema);

// Suggestions are data, never inventory commands. Reject extra fields at every object boundary.
function hasExactFields(value, fields) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    && Object.keys(value).length === fields.length
    && fields.every((field) => Object.hasOwn(value, field));
}

function normalized(value) {
  return value.trim().toLocaleLowerCase('de-DE');
}

function hasMatchingAllergen(item, allergies) {
  const allergySet = new Set(allergies.map(normalized));
  return item.allergens.some((allergen) => allergySet.has(normalized(allergen)));
}

function isUsableInventoryItem(item, allergies) {
  return item.quantity > 0 && item.expired !== true && !hasMatchingAllergen(item, allergies);
}

function getShoppingState(shoppingList, shoppingDecision) {
  if (shoppingList.length === 0) {
    return { shoppingQuestion: null, plannedShoppingItems: [] };
  }

  if (shoppingDecision === undefined) {
    return { shoppingQuestion: SHOPPING_QUESTION, plannedShoppingItems: [] };
  }

  if (shoppingDecision === 'no') {
    return { shoppingQuestion: null, plannedShoppingItems: [] };
  }

  if (shoppingDecision === 'yes') {
    return {
      shoppingQuestion: null,
      plannedShoppingItems: shoppingList.map((item) => ({
        shopping_item_id: item.id,
        name: item.name,
        quantity: item.quantity,
        unit: item.unit,
      })),
    };
  }

  throw new Error(`Unsupported shopping decision: ${shoppingDecision}`);
}

function recipeCanBeMade(recipe, allowedNames) {
  return recipe.ingredientNames.every((name) => allowedNames.has(normalized(name)));
}

function recipeHasQuantityRequirements(recipe) {
  return Object.hasOwn(recipe, 'servings') || Object.hasOwn(recipe, 'ingredients');
}

function recipeHasEnoughQuantity(recipe, availability) {
  if (!recipeHasQuantityRequirements(recipe)) return !availability.quantityAware;
  return assessRecipeFeasibility(recipe, availability).feasible;
}

function recipePriorityScore(recipe, priorityScores) {
  return recipe.ingredientNames.reduce(
    (score, name) => score + (priorityScores.get(normalized(name)) ?? 0),
    0,
  );
}

function selectCandidateRecipes(recipes, priorityFoods, allowedNames, availability) {
  const priorityScores = new Map();
  for (const food of priorityFoods) {
    const name = normalized(food.name);
    priorityScores.set(name, Math.max(priorityScores.get(name) ?? 0, food.priorityScore));
  }

  return recipes
    .filter((recipe) => recipeCanBeMade(recipe, allowedNames))
    .filter((recipe) => recipeHasEnoughQuantity(recipe, availability))
    .map((recipe, index) => ({
      recipe,
      score: recipePriorityScore(recipe, priorityScores),
      index,
    }))
    .filter(({ score }) => score > 0)
    .sort((left, right) => right.score - left.score || left.index - right.index)
    .slice(0, 3)
    .map(({ recipe }) => ({
      id: recipe.id,
      source: recipe.source,
      title: recipe.title,
      ingredient_names: [...recipe.ingredientNames],
    }));
}

export function buildRecipeContext(input, shoppingDecision) {
  const allergies = [...input.allergies];
  const computedScores = input.inventory.map((item) => ({
    item,
    priorityScore: Object.hasOwn(item, 'bestBefore')
      || Object.hasOwn(item, 'openedAt')
      || Object.hasOwn(item, 'consumeWithinDays')
      ? priorityScore(item, input.referenceDate)
      : item.priorityScore,
  }));
  const explicitForbidden = new Set((input.forbiddenIngredients ?? []).map(normalized));
  const usableInventory = computedScores
    .filter(({ item }) => isUsableInventoryItem(item, allergies)
      && !explicitForbidden.has(normalized(item.name)))
    .map(({ item, priorityScore: score }) => ({ ...item, priorityScore: score }));
  const usableNames = new Set(usableInventory.map((item) => normalized(item.name)));
  const unsafeInventoryNames = computedScores
    .filter(({ item }) => !isUsableInventoryItem(item, allergies) && !usableNames.has(normalized(item.name)))
    .map(({ item }) => item.name);
  const forbiddenIngredients = [...new Set([
    ...(input.forbiddenIngredients ?? []), ...unsafeInventoryNames,
  ])];
  const forbiddenNames = new Set(forbiddenIngredients.map(normalized));
  const allowedStaples = input.allowedStaples.filter((name) => !forbiddenNames.has(normalized(name)));
  const shopping = getShoppingState(input.shoppingList, shoppingDecision);
  shopping.plannedShoppingItems = shopping.plannedShoppingItems
    .filter((item) => !forbiddenNames.has(normalized(item.name)));
  const allowedNames = new Set([
    ...usableInventory.map((item) => normalized(item.name)),
    ...shopping.plannedShoppingItems.map((item) => normalized(item.name)),
    ...allowedStaples.map(normalized),
  ]);
  const priorityFoods = usableInventory
    .toSorted((left, right) => right.priorityScore - left.priorityScore)
    .map((item) => ({
      inventoryItemId: item.id,
      name: item.name,
      availableQuantity: item.quantity,
      unit: item.unit,
      priorityScore: item.priorityScore,
    }));
  const candidateRecipes = selectCandidateRecipes(
    input.candidateRecipes,
    priorityFoods,
    allowedNames,
    {
      servings: input.servings,
      inventory: usableInventory,
      plannedShoppingItems: shopping.plannedShoppingItems,
      allowedStaples,
      quantityAware: computedScores.some(({ item }) =>
        Object.hasOwn(item, 'bestBefore') || Object.hasOwn(item, 'openedAt')
        || Object.hasOwn(item, 'consumeWithinDays'))
        || input.candidateRecipes.some(recipeHasQuantityRequirements),
    },
  );

  return {
    schema_version: SCHEMA_VERSION,
    request: {
      type: 'recipe_suggestion',
      servings: input.servings,
    },
    constraints: {
      allergies,
      preferences: [...input.preferences],
      allowed_staples: allowedStaples,
      forbidden_ingredients: forbiddenIngredients,
    },
    priority_foods: priorityFoods.map((food) => ({
      inventory_item_id: food.inventoryItemId,
      name: food.name,
      available_quantity: food.availableQuantity,
      unit: food.unit,
      priority_score: food.priorityScore,
    })),
    planned_shopping_items: shopping.plannedShoppingItems,
    candidate_recipes: candidateRecipes,
    shopping_question: shopping.shoppingQuestion,
    fallback_allowed: candidateRecipes.length === 0,
  };
}

function validateMeal(context, meal, index, usedQuantities) {
  const errors = [];
  const path = `meals[${index}]`;
  if (!hasExactFields(meal, [
    'title', 'source', 'recipe_id', 'servings', 'used_items',
    'additional_ingredients', 'steps', 'notes',
  ])) {
    return [`${path} must contain only the canonical recipe fields`];
  }
  const inventoryById = new Map(
    context.priority_foods.map((food) => [food.inventory_item_id, food]),
  );
  const allowedAdditionalIngredients = new Set([
    ...context.constraints.allowed_staples.map(normalized),
    ...context.planned_shopping_items.map((item) => normalized(item.name)),
  ]);
  const forbiddenIngredients = new Set(context.constraints.forbidden_ingredients.map(normalized));
  const candidatesById = new Map(context.candidate_recipes.map((recipe) => [recipe.id, recipe]));

  if (typeof meal?.title !== 'string' || meal.title.trim().length === 0) {
    errors.push(`${path}.title is required`);
  }

  if (!['catalog', 'template', 'model_generated'].includes(meal?.source)) {
    errors.push(`${path}.source is invalid`);
  }

  if (meal?.source === 'model_generated') {
    if (meal.recipe_id !== null) errors.push(`${path}.recipe_id must be null for model_generated`);
    if (!context.fallback_allowed) errors.push(`${path} uses model_generated while catalog recipes are available`);
  } else if (!candidatesById.has(meal?.recipe_id)) {
    errors.push(`${path}.recipe_id is not in the context`);
  } else if (candidatesById.get(meal.recipe_id).source !== meal.source) {
    errors.push(`${path}.source does not match the selected candidate`);
  }

  if (!Number.isInteger(meal?.servings) || meal.servings < 1) {
    errors.push(`${path}.servings must be a positive integer`);
  } else if (meal.servings !== context.request.servings) {
    errors.push(`${path}.servings does not match the household`);
  }

  if (!Array.isArray(meal?.used_items)) {
    errors.push(`${path}.used_items must be an array`);
  } else {
    if (meal.used_items.length === 0) errors.push(`${path}.used_items must contain inventory`);
    meal.used_items.forEach((item, itemIndex) => {
      const itemPath = `${path}.used_items[${itemIndex}]`;
      if (!hasExactFields(item, ['inventory_item_id', 'quantity', 'unit'])) {
        errors.push(`${itemPath} must contain only the canonical usage fields`);
        return;
      }
      const inventoryItem = inventoryById.get(item?.inventory_item_id);
      if (!inventoryItem) {
        errors.push(`${itemPath}.inventory_item_id is not in the context`);
        return;
      }
      if (forbiddenIngredients.has(normalized(inventoryItem.name))) {
        errors.push(`${itemPath} uses a forbidden ingredient: ${inventoryItem.name}`);
      }
      const usedMeasurement = normalizeMeasurement(item?.quantity, item?.unit);
      const availableMeasurement = normalizeMeasurement(
        inventoryItem?.available_quantity,
        inventoryItem?.unit,
      );
      if (!usedMeasurement || !availableMeasurement
        || usedMeasurement.dimension !== availableMeasurement.dimension) {
        errors.push(`${itemPath}.unit is incompatible with the context`);
      } else {
        const total = (usedQuantities.get(item.inventory_item_id) ?? 0) + usedMeasurement.quantity;
        usedQuantities.set(item.inventory_item_id, total);
        // Tolerate only floating-point addition noise, not a business-level overdraw.
        const tolerance = Number.EPSILON * Math.max(total, availableMeasurement.quantity) * 4;
        if (!Number.isFinite(total) || total - availableMeasurement.quantity > tolerance) {
          errors.push(`${itemPath}.quantity exceeds available quantity across all meals`);
        }
      }
    });
  }

  if (!Array.isArray(meal?.additional_ingredients)) {
    errors.push(`${path}.additional_ingredients must be an array`);
  } else {
    meal.additional_ingredients.forEach((ingredient) => {
      if (typeof ingredient !== 'string') {
        errors.push(`${path}.additional_ingredients contains a non-string ingredient`);
      } else if (forbiddenIngredients.has(normalized(ingredient))) {
        errors.push(`${path}.additional_ingredients contains a forbidden ingredient: ${ingredient}`);
      } else if (!allowedAdditionalIngredients.has(normalized(ingredient))) {
        errors.push(`${path}.additional_ingredients contains an ingredient not in the allowlist: ${ingredient}`);
      }
    });
  }

  if (!Array.isArray(meal?.steps) || meal.steps.length === 0) {
    errors.push(`${path}.steps must contain at least one step`);
  } else if (meal.steps.some((step) => typeof step !== 'string' || step.trim().length === 0)) {
    errors.push(`${path}.steps must contain non-blank strings`);
  }

  if (!Array.isArray(meal?.notes)) {
    errors.push(`${path}.notes must be an array`);
  } else if (meal.notes.some((note) => typeof note !== 'string' || note.trim().length === 0)) {
    errors.push(`${path}.notes must contain non-blank strings`);
  }

  return errors;
}

export function validateRecipeResponse(context, response) {
  const errors = [];

  if (!hasExactFields(response, ['schema_version', 'meals'])) {
    return { ok: false, errors: ['response must contain only schema_version and meals'] };
  }

  // Compose the actual JSON Schema with context-dependent rules. Never coerce or repair the response.
  const shape = responseSchema.safeParse(response);
  if (!shape.success) {
    errors.push(...shape.error.issues.map((issue) => `schema ${issue.path.join('.')}: ${issue.message}`));
  }

  if (response?.schema_version !== SCHEMA_VERSION) {
    errors.push(`schema_version must be ${SCHEMA_VERSION}`);
  }

  if (!Array.isArray(response?.meals)) {
    errors.push('meals must be an array');
  } else {
    if (response.meals.length < 1 || response.meals.length > 3) {
      errors.push('meals must contain between 1 and 3 entries');
    }
    const usedQuantities = new Map();
    response.meals.slice(0, 3).forEach((meal, index) => {
      errors.push(...validateMeal(context, meal, index, usedQuantities));
    });
  }

  return errors.length === 0 ? { ok: true, value: response } : { ok: false, errors };
}
