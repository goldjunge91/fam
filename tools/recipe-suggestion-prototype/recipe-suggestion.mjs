const SCHEMA_VERSION = 1;
const SHOPPING_QUESTION = 'Willst du heute noch einkaufen?';

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

function recipePriorityScore(recipe, priorityScores) {
  return recipe.ingredientNames.reduce(
    (score, name) => score + (priorityScores.get(normalized(name)) ?? 0),
    0,
  );
}

function selectCandidateRecipes(recipes, priorityFoods, allowedNames) {
  const priorityScores = new Map(
    priorityFoods.map((food) => [normalized(food.name), food.priorityScore]),
  );

  return recipes
    .filter((recipe) => recipeCanBeMade(recipe, allowedNames))
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
  const usableInventory = input.inventory.filter((item) => isUsableInventoryItem(item, allergies));
  const unsafeInventoryNames = input.inventory
    .filter((item) => !isUsableInventoryItem(item, allergies))
    .map((item) => item.name);
  const shopping = getShoppingState(input.shoppingList, shoppingDecision);
  const allowedNames = new Set([
    ...usableInventory.map((item) => normalized(item.name)),
    ...shopping.plannedShoppingItems.map((item) => normalized(item.name)),
    ...input.allowedStaples.map(normalized),
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
      allowed_staples: [...input.allowedStaples],
      forbidden_ingredients: [
        ...new Set([...(input.forbiddenIngredients ?? []), ...unsafeInventoryNames]),
      ],
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

function validateMeal(context, meal, index) {
  const errors = [];
  const path = `meals[${index}]`;
  const inventoryById = new Map(
    context.priority_foods.map((food) => [food.inventory_item_id, food]),
  );
  const allowedAdditionalIngredients = new Set([
    ...context.constraints.allowed_staples.map(normalized),
    ...context.planned_shopping_items.map((item) => normalized(item.name)),
  ]);
  const forbiddenIngredients = new Set(context.constraints.forbidden_ingredients.map(normalized));
  const candidateIds = new Set(context.candidate_recipes.map((recipe) => recipe.id));

  if (typeof meal?.title !== 'string' || meal.title.trim().length === 0) {
    errors.push(`${path}.title is required`);
  }

  if (!['catalog', 'template', 'model_generated'].includes(meal?.source)) {
    errors.push(`${path}.source is invalid`);
  }

  if (meal?.source === 'model_generated') {
    if (meal.recipe_id !== null) errors.push(`${path}.recipe_id must be null for model_generated`);
    if (!context.fallback_allowed) errors.push(`${path} uses model_generated while catalog recipes are available`);
  } else if (!candidateIds.has(meal?.recipe_id)) {
    errors.push(`${path}.recipe_id is not in the context`);
  }

  if (!Number.isInteger(meal?.servings) || meal.servings < 1) {
    errors.push(`${path}.servings must be a positive integer`);
  }

  if (!Array.isArray(meal?.used_items)) {
    errors.push(`${path}.used_items must be an array`);
  } else {
    meal.used_items.forEach((item, itemIndex) => {
      const itemPath = `${path}.used_items[${itemIndex}]`;
      const inventoryItem = inventoryById.get(item?.inventory_item_id);
      if (!inventoryItem) {
        errors.push(`${itemPath}.inventory_item_id is not in the context`);
        return;
      }
      if (typeof item.quantity !== 'number' || item.quantity <= 0) {
        errors.push(`${itemPath}.quantity must be positive`);
      } else if (item.quantity > inventoryItem.available_quantity) {
        errors.push(`${itemPath}.quantity exceeds available quantity`);
      }
      if (item.unit !== inventoryItem.unit) {
        errors.push(`${itemPath}.unit does not match the context`);
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
  }

  if (!Array.isArray(meal?.notes)) {
    errors.push(`${path}.notes must be an array`);
  }

  return errors;
}

export function validateRecipeResponse(context, response) {
  const errors = [];

  if (response?.schema_version !== SCHEMA_VERSION) {
    errors.push(`schema_version must be ${SCHEMA_VERSION}`);
  }

  if (!Array.isArray(response?.meals)) {
    errors.push('meals must be an array');
  } else {
    if (response.meals.length < 1 || response.meals.length > 3) {
      errors.push('meals must contain between 1 and 3 entries');
    }
    response.meals.slice(0, 3).forEach((meal, index) => {
      errors.push(...validateMeal(context, meal, index));
    });
  }

  return errors.length === 0 ? { ok: true, value: response } : { ok: false, errors };
}
