export const RECIPE_SUGGESTION_SCHEMA_VERSION = 1 as const;

export type RecipeSuggestionSource = 'catalog' | 'template' | 'model_generated';
export type CandidateRecipeSource = 'catalog' | 'template';

export type RecipeSuggestionContext = {
  schema_version: 1;
  request: {
    type: 'recipe_suggestion';
    servings: number;
  };
  constraints: {
    allergies: string[];
    preferences: string[];
    allowed_staples: string[];
    forbidden_ingredients: string[];
  };
  priority_foods: Array<{
    inventory_item_id: string;
    name: string;
    available_quantity: number;
    unit: string;
    priority_score: number;
  }>;
  planned_shopping_items: Array<{
    shopping_item_id: string;
    name: string;
    quantity: number;
    unit: string;
  }>;
  candidate_recipes: Array<{
    id: string;
    source: CandidateRecipeSource;
    title: string;
    ingredient_names: string[];
  }>;
  shopping_question: string | null;
  fallback_allowed: boolean;
};

export type RecipeSuggestionMeal = {
  title: string;
  source: RecipeSuggestionSource;
  recipe_id: string | null;
  servings: number;
  used_items: Array<{
    inventory_item_id: string;
    quantity: number;
    unit: string;
  }>;
  additional_ingredients: string[];
  steps: string[];
  notes: string[];
};

export type RecipeSuggestionResponse = {
  schema_version: 1;
  meals: RecipeSuggestionMeal[];
};

export type RecipeSuggestionIssueCode =
  | 'invalid_shape'
  | 'invalid_reference'
  | 'source_mismatch'
  | 'fallback_not_allowed'
  | 'invalid_quantity'
  | 'forbidden_ingredient'
  | 'unapproved_ingredient';

export type RecipeSuggestionIssue = {
  code: RecipeSuggestionIssueCode;
  path: string;
  message: string;
};

export type RecipeSuggestionValidationResult<T> =
  | { ok: true; value: T }
  | { ok: false; issues: RecipeSuggestionIssue[] };

type UnknownRecord = Record<string, unknown>;

const CONTEXT_KEYS = [
  'schema_version',
  'request',
  'constraints',
  'priority_foods',
  'planned_shopping_items',
  'candidate_recipes',
  'shopping_question',
  'fallback_allowed',
] as const;
const REQUEST_KEYS = ['type', 'servings'] as const;
const CONSTRAINT_KEYS = [
  'allergies',
  'preferences',
  'allowed_staples',
  'forbidden_ingredients',
] as const;
const PRIORITY_FOOD_KEYS = [
  'inventory_item_id',
  'name',
  'available_quantity',
  'unit',
  'priority_score',
] as const;
const PLANNED_SHOPPING_ITEM_KEYS = ['shopping_item_id', 'name', 'quantity', 'unit'] as const;
const CANDIDATE_RECIPE_KEYS = ['id', 'source', 'title', 'ingredient_names'] as const;
const RESPONSE_KEYS = ['schema_version', 'meals'] as const;
const MEAL_KEYS = [
  'title',
  'source',
  'recipe_id',
  'servings',
  'used_items',
  'additional_ingredients',
  'steps',
  'notes',
] as const;
const USED_ITEM_KEYS = ['inventory_item_id', 'quantity', 'unit'] as const;

function issue(
  code: RecipeSuggestionIssueCode,
  path: string,
  message: string,
): RecipeSuggestionIssue {
  return { code, path, message };
}

function invalidShape(path: string, message: string): RecipeSuggestionIssue {
  return issue('invalid_shape', path, message);
}

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readObject(
  value: unknown,
  path: string,
  expectedKeys: readonly string[],
  issues: RecipeSuggestionIssue[],
): UnknownRecord | null {
  if (!isRecord(value)) {
    issues.push(invalidShape(path, 'must be an object'));
    return null;
  }

  const expected = new Set(expectedKeys);
  const hasUnknownKey = Reflect.ownKeys(value).some(
    (key) => typeof key !== 'string' || !expected.has(key),
  );
  if (hasUnknownKey) {
    issues.push(invalidShape(path, 'object contains unknown fields'));
  }

  for (const key of expectedKeys) {
    if (!Object.prototype.hasOwnProperty.call(value, key)) {
      issues.push(invalidShape(`${path}.${key}`, 'field is required'));
    }
  }

  return value;
}

function parseNonEmptyString(
  value: unknown,
  path: string,
  issues: RecipeSuggestionIssue[],
): string | null {
  if (typeof value !== 'string' || value.trim().length === 0) {
    issues.push(invalidShape(path, 'must be a non-empty string'));
    return null;
  }
  return value;
}

function parseString(value: unknown, path: string, issues: RecipeSuggestionIssue[]): string | null {
  if (typeof value !== 'string') {
    issues.push(invalidShape(path, 'must be a string'));
    return null;
  }
  return value;
}

function parseNullableString(
  value: unknown,
  path: string,
  issues: RecipeSuggestionIssue[],
): string | null {
  if (value === null) return null;
  return parseString(value, path, issues);
}

function parseNullableNonEmptyString(
  value: unknown,
  path: string,
  issues: RecipeSuggestionIssue[],
): string | null {
  if (value === null) return null;
  if (typeof value !== 'string' || value.length === 0) {
    issues.push(invalidShape(path, 'must be a non-empty string or null'));
    return null;
  }
  return value;
}

function parsePositiveNumber(
  value: unknown,
  path: string,
  issues: RecipeSuggestionIssue[],
): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    issues.push(invalidShape(path, 'must be a finite positive number'));
    return null;
  }
  return value;
}

function parsePositiveInteger(
  value: unknown,
  path: string,
  issues: RecipeSuggestionIssue[],
): number | null {
  if (typeof value !== 'number' || !Number.isInteger(value) || value <= 0) {
    issues.push(invalidShape(path, 'must be a positive integer'));
    return null;
  }
  return value;
}

function parseSchemaVersion(
  value: unknown,
  path: string,
  issues: RecipeSuggestionIssue[],
): 1 | null {
  if (value !== RECIPE_SUGGESTION_SCHEMA_VERSION) {
    issues.push(invalidShape(path, 'must be schema version 1'));
    return null;
  }
  return RECIPE_SUGGESTION_SCHEMA_VERSION;
}

function parseStringArray(
  value: unknown,
  path: string,
  issues: RecipeSuggestionIssue[],
  nonEmptyItems: boolean,
  minimumLength = 0,
): string[] | null {
  if (!Array.isArray(value)) {
    issues.push(invalidShape(path, 'must be an array'));
    return null;
  }

  if (value.length < minimumLength) {
    issues.push(invalidShape(path, `must contain at least ${minimumLength} item(s)`));
  }

  const parsed: string[] = [];
  value.forEach((item, index) => {
    const parsedItem = nonEmptyItems
      ? parseNonEmptyString(item, `${path}[${index}]`, issues)
      : parseString(item, `${path}[${index}]`, issues);
    if (parsedItem !== null) parsed.push(parsedItem);
  });
  return parsed;
}

function parseCandidateSource(
  value: unknown,
  path: string,
  issues: RecipeSuggestionIssue[],
): CandidateRecipeSource | null {
  if (value !== 'catalog' && value !== 'template') {
    issues.push(invalidShape(path, 'must be catalog or template'));
    return null;
  }
  return value;
}

function parseMealSource(
  value: unknown,
  path: string,
  issues: RecipeSuggestionIssue[],
): RecipeSuggestionSource | null {
  if (value !== 'catalog' && value !== 'template' && value !== 'model_generated') {
    issues.push(invalidShape(path, 'must be catalog, template, or model_generated'));
    return null;
  }
  return value;
}

function parseIdentifier(
  value: unknown,
  path: string,
  issues: RecipeSuggestionIssue[],
): string | null {
  if (typeof value !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(value)) {
    issues.push(invalidShape(path, 'must be a valid identifier'));
    return null;
  }
  return value;
}

function parsePriorityFood(
  value: unknown,
  path: string,
  issues: RecipeSuggestionIssue[],
): RecipeSuggestionContext['priority_foods'][number] | null {
  const object = readObject(value, path, PRIORITY_FOOD_KEYS, issues);
  if (object === null) return null;

  const inventoryItemId = parseNonEmptyString(
    object.inventory_item_id,
    `${path}.inventory_item_id`,
    issues,
  );
  const name = parseNonEmptyString(object.name, `${path}.name`, issues);
  const availableQuantity = parsePositiveNumber(
    object.available_quantity,
    `${path}.available_quantity`,
    issues,
  );
  const unit = parseNonEmptyString(object.unit, `${path}.unit`, issues);
  const priorityScore =
    typeof object.priority_score === 'number' && Number.isFinite(object.priority_score)
      ? object.priority_score
      : null;
  if (priorityScore === null) {
    issues.push(invalidShape(`${path}.priority_score`, 'must be a finite number'));
  }

  if (
    inventoryItemId === null ||
    name === null ||
    availableQuantity === null ||
    unit === null ||
    priorityScore === null
  ) {
    return null;
  }
  return {
    inventory_item_id: inventoryItemId,
    name,
    available_quantity: availableQuantity,
    unit,
    priority_score: priorityScore,
  };
}

function parsePlannedShoppingItem(
  value: unknown,
  path: string,
  issues: RecipeSuggestionIssue[],
): RecipeSuggestionContext['planned_shopping_items'][number] | null {
  const object = readObject(value, path, PLANNED_SHOPPING_ITEM_KEYS, issues);
  if (object === null) return null;

  const shoppingItemId = parseNonEmptyString(
    object.shopping_item_id,
    `${path}.shopping_item_id`,
    issues,
  );
  const name = parseNonEmptyString(object.name, `${path}.name`, issues);
  const quantity = parsePositiveNumber(object.quantity, `${path}.quantity`, issues);
  const unit = parseNonEmptyString(object.unit, `${path}.unit`, issues);

  if (shoppingItemId === null || name === null || quantity === null || unit === null) {
    return null;
  }
  return { shopping_item_id: shoppingItemId, name, quantity, unit };
}

function parseCandidateRecipe(
  value: unknown,
  path: string,
  issues: RecipeSuggestionIssue[],
): RecipeSuggestionContext['candidate_recipes'][number] | null {
  const object = readObject(value, path, CANDIDATE_RECIPE_KEYS, issues);
  if (object === null) return null;

  const id = parseIdentifier(object.id, `${path}.id`, issues);
  const source = parseCandidateSource(object.source, `${path}.source`, issues);
  const title = parseNonEmptyString(object.title, `${path}.title`, issues);
  const ingredientNames = parseStringArray(
    object.ingredient_names,
    `${path}.ingredient_names`,
    issues,
    true,
    1,
  );

  if (id === null || source === null || title === null || ingredientNames === null) return null;
  return { id, source, title, ingredient_names: ingredientNames };
}

function parseContext(input: unknown): RecipeSuggestionValidationResult<RecipeSuggestionContext> {
  const issues: RecipeSuggestionIssue[] = [];
  const object = readObject(input, '$', CONTEXT_KEYS, issues);
  if (object === null) return { ok: false, issues };

  const schemaVersion = parseSchemaVersion(object.schema_version, '$.schema_version', issues);

  const requestObject = readObject(object.request, '$.request', REQUEST_KEYS, issues);
  const requestType = requestObject
    ? requestObject.type === 'recipe_suggestion'
      ? 'recipe_suggestion'
      : null
    : null;
  if (requestObject && requestType === null) {
    issues.push(invalidShape('$.request.type', 'must be recipe_suggestion'));
  }
  const requestServings = requestObject
    ? parsePositiveInteger(requestObject.servings, '$.request.servings', issues)
    : null;

  const constraintsObject = readObject(object.constraints, '$.constraints', CONSTRAINT_KEYS, issues);
  const allergies = constraintsObject
    ? parseStringArray(constraintsObject.allergies, '$.constraints.allergies', issues, false)
    : null;
  const preferences = constraintsObject
    ? parseStringArray(constraintsObject.preferences, '$.constraints.preferences', issues, false)
    : null;
  const allowedStaples = constraintsObject
    ? parseStringArray(
        constraintsObject.allowed_staples,
        '$.constraints.allowed_staples',
        issues,
        true,
      )
    : null;
  const forbiddenIngredients = constraintsObject
    ? parseStringArray(
        constraintsObject.forbidden_ingredients,
        '$.constraints.forbidden_ingredients',
        issues,
        true,
      )
    : null;

  const priorityFoods: RecipeSuggestionContext['priority_foods'] = [];
  if (!Array.isArray(object.priority_foods)) {
    issues.push(invalidShape('$.priority_foods', 'must be an array'));
  } else {
    object.priority_foods.forEach((item, index) => {
      const parsed = parsePriorityFood(item, `$.priority_foods[${index}]`, issues);
      if (parsed !== null) priorityFoods.push(parsed);
    });
  }

  const plannedShoppingItems: RecipeSuggestionContext['planned_shopping_items'] = [];
  if (!Array.isArray(object.planned_shopping_items)) {
    issues.push(invalidShape('$.planned_shopping_items', 'must be an array'));
  } else {
    object.planned_shopping_items.forEach((item, index) => {
      const parsed = parsePlannedShoppingItem(
        item,
        `$.planned_shopping_items[${index}]`,
        issues,
      );
      if (parsed !== null) plannedShoppingItems.push(parsed);
    });
  }

  const candidateRecipes: RecipeSuggestionContext['candidate_recipes'] = [];
  if (!Array.isArray(object.candidate_recipes)) {
    issues.push(invalidShape('$.candidate_recipes', 'must be an array'));
  } else {
    if (object.candidate_recipes.length > 3) {
      issues.push(invalidShape('$.candidate_recipes', 'must contain at most 3 item(s)'));
    }
    object.candidate_recipes.forEach((item, index) => {
      const parsed = parseCandidateRecipe(item, `$.candidate_recipes[${index}]`, issues);
      if (parsed !== null) candidateRecipes.push(parsed);
    });
  }

  const shoppingQuestion = parseNullableString(
    object.shopping_question,
    '$.shopping_question',
    issues,
  );
  const fallbackAllowed =
    typeof object.fallback_allowed === 'boolean' ? object.fallback_allowed : null;
  if (fallbackAllowed === null) {
    issues.push(invalidShape('$.fallback_allowed', 'must be a boolean'));
  }

  if (
    schemaVersion === null ||
    requestType === null ||
    requestServings === null ||
    allergies === null ||
    preferences === null ||
    allowedStaples === null ||
    forbiddenIngredients === null ||
    shoppingQuestion === null && object.shopping_question !== null ||
    fallbackAllowed === null
  ) {
    return { ok: false, issues };
  }

  const context: RecipeSuggestionContext = {
    schema_version: schemaVersion,
    request: { type: requestType, servings: requestServings },
    constraints: {
      allergies,
      preferences,
      allowed_staples: allowedStaples,
      forbidden_ingredients: forbiddenIngredients,
    },
    priority_foods: priorityFoods,
    planned_shopping_items: plannedShoppingItems,
    candidate_recipes: candidateRecipes,
    shopping_question: shoppingQuestion,
    fallback_allowed: fallbackAllowed,
  };

  issues.push(...contextSemanticIssues(context));
  return issues.length === 0 ? { ok: true, value: context } : { ok: false, issues };
}

function contextSemanticIssues(context: RecipeSuggestionContext): RecipeSuggestionIssue[] {
  const issues: RecipeSuggestionIssue[] = [];
  const candidateIds = new Set<string>();

  context.candidate_recipes.forEach((candidate, index) => {
    if (candidateIds.has(candidate.id)) {
      issues.push(
        issue(
          'invalid_reference',
          `$.candidate_recipes[${index}].id`,
          'candidate recipe ids must be unique',
        ),
      );
    }
    candidateIds.add(candidate.id);
  });

  if (context.fallback_allowed !== (context.candidate_recipes.length === 0)) {
    issues.push(
      issue(
        'fallback_not_allowed',
        '$.fallback_allowed',
        'fallback_allowed must be true exactly when no candidate recipe exists',
      ),
    );
  }

  if (context.shopping_question !== null && context.planned_shopping_items.length > 0) {
    issues.push(
      invalidShape(
        '$.shopping_question',
        'shopping_question must be null when shopping items are planned',
      ),
    );
  }

  return issues;
}

function parseUsedItem(
  value: unknown,
  path: string,
  issues: RecipeSuggestionIssue[],
): RecipeSuggestionMeal['used_items'][number] | null {
  const object = readObject(value, path, USED_ITEM_KEYS, issues);
  if (object === null) return null;

  const inventoryItemId = parseNonEmptyString(
    object.inventory_item_id,
    `${path}.inventory_item_id`,
    issues,
  );
  const quantity = parsePositiveNumber(object.quantity, `${path}.quantity`, issues);
  const unit = parseNonEmptyString(object.unit, `${path}.unit`, issues);

  if (inventoryItemId === null || quantity === null || unit === null) return null;
  return { inventory_item_id: inventoryItemId, quantity, unit };
}

function parseMeal(
  value: unknown,
  path: string,
  issues: RecipeSuggestionIssue[],
): RecipeSuggestionMeal | null {
  const object = readObject(value, path, MEAL_KEYS, issues);
  if (object === null) return null;

  const title = parseNonEmptyString(object.title, `${path}.title`, issues);
  const source = parseMealSource(object.source, `${path}.source`, issues);
  const recipeId = parseNullableNonEmptyString(object.recipe_id, `${path}.recipe_id`, issues);
  const servings = parsePositiveInteger(object.servings, `${path}.servings`, issues);

  const usedItems: RecipeSuggestionMeal['used_items'] = [];
  if (!Array.isArray(object.used_items)) {
    issues.push(invalidShape(`${path}.used_items`, 'must be an array'));
  } else {
    object.used_items.forEach((item, index) => {
      const parsed = parseUsedItem(item, `${path}.used_items[${index}]`, issues);
      if (parsed !== null) usedItems.push(parsed);
    });
  }

  const additionalIngredients = parseStringArray(
    object.additional_ingredients,
    `${path}.additional_ingredients`,
    issues,
    true,
  );
  const steps = parseStringArray(object.steps, `${path}.steps`, issues, true, 1);
  const notes = parseStringArray(object.notes, `${path}.notes`, issues, false);

  if (
    title === null ||
    source === null ||
    recipeId === null && object.recipe_id !== null ||
    servings === null ||
    additionalIngredients === null ||
    steps === null ||
    notes === null
  ) {
    return null;
  }

  return {
    title,
    source,
    recipe_id: recipeId,
    servings,
    used_items: usedItems,
    additional_ingredients: additionalIngredients,
    steps,
    notes,
  };
}

function parseResponse(input: unknown): RecipeSuggestionValidationResult<RecipeSuggestionResponse> {
  const issues: RecipeSuggestionIssue[] = [];
  const object = readObject(input, '$', RESPONSE_KEYS, issues);
  if (object === null) return { ok: false, issues };

  const schemaVersion = parseSchemaVersion(object.schema_version, '$.schema_version', issues);
  const meals: RecipeSuggestionMeal[] = [];
  if (!Array.isArray(object.meals)) {
    issues.push(invalidShape('$.meals', 'must be an array'));
  } else {
    if (object.meals.length < 1) {
      issues.push(invalidShape('$.meals', 'must contain at least 1 item(s)'));
    }
    if (object.meals.length > 3) {
      issues.push(invalidShape('$.meals', 'must contain at most 3 item(s)'));
    }
    object.meals.forEach((meal, index) => {
      const parsed = parseMeal(meal, `$.meals[${index}]`, issues);
      if (parsed !== null) meals.push(parsed);
    });
  }

  if (schemaVersion === null || !Array.isArray(object.meals)) {
    return { ok: false, issues };
  }
  return issues.length === 0
    ? { ok: true, value: { schema_version: schemaVersion, meals } }
    : { ok: false, issues };
}

function normalize(value: string): string {
  return value.trim().toLocaleLowerCase('de-DE');
}

function validateMealSemantics(
  context: RecipeSuggestionContext,
  meal: RecipeSuggestionMeal,
  mealIndex: number,
  usedQuantities: Map<string, number>,
): RecipeSuggestionIssue[] {
  const issues: RecipeSuggestionIssue[] = [];
  const path = `$.meals[${mealIndex}]`;
  const inventoryById = new Map(
    context.priority_foods.map((food) => [food.inventory_item_id, food]),
  );
  const candidate = context.candidate_recipes.find((item) => item.id === meal.recipe_id);

  if (meal.source === 'model_generated') {
    if (meal.recipe_id !== null) {
      issues.push(
        issue(
          'source_mismatch',
          `${path}.recipe_id`,
          'recipe_id must be null for model_generated meals',
        ),
      );
    }
    if (!context.fallback_allowed) {
      issues.push(
        issue(
          'fallback_not_allowed',
          `${path}.source`,
          'model_generated meals are not allowed while candidate recipes exist',
        ),
      );
    }
  } else if (!candidate) {
    issues.push(
      issue(
        'invalid_reference',
        `${path}.recipe_id`,
        'recipe_id does not reference a candidate recipe in the context',
      ),
    );
  } else if (candidate.source !== meal.source) {
    issues.push(
      issue(
        'source_mismatch',
        `${path}.source`,
        'source does not match the referenced candidate recipe',
      ),
    );
  }

  const allowedAdditionalIngredients = new Set(
    [
      ...context.constraints.allowed_staples,
      ...context.planned_shopping_items.map((item) => item.name),
    ].map(normalize),
  );
  const forbiddenIngredients = new Set(
    context.constraints.forbidden_ingredients.map(normalize),
  );

  meal.used_items.forEach((item, itemIndex) => {
    const itemPath = `${path}.used_items[${itemIndex}]`;
    const inventoryItem = inventoryById.get(item.inventory_item_id);

    if (!inventoryItem) {
      issues.push(
        issue(
          'invalid_reference',
          `${itemPath}.inventory_item_id`,
          'inventory item is not present in priority_foods',
        ),
      );
      return;
    }

    if (item.unit !== inventoryItem.unit) {
      issues.push(
        issue(
          'invalid_quantity',
          `${itemPath}.unit`,
          'unit does not match the inventory item',
        ),
      );
    }

    const totalQuantity = (usedQuantities.get(item.inventory_item_id) ?? 0) + item.quantity;
    usedQuantities.set(item.inventory_item_id, totalQuantity);
    if (totalQuantity > inventoryItem.available_quantity) {
      issues.push(
        issue(
          'invalid_quantity',
          `${itemPath}.quantity`,
          'total quantity exceeds the available inventory quantity',
        ),
      );
    }
  });

  meal.additional_ingredients.forEach((ingredient, ingredientIndex) => {
    const ingredientPath = `${path}.additional_ingredients[${ingredientIndex}]`;
    const normalizedIngredient = normalize(ingredient);

    if (forbiddenIngredients.has(normalizedIngredient)) {
      issues.push(
        issue(
          'forbidden_ingredient',
          ingredientPath,
          `ingredient is forbidden: ${ingredient}`,
        ),
      );
    } else if (!allowedAdditionalIngredients.has(normalizedIngredient)) {
      issues.push(
        issue(
          'unapproved_ingredient',
          ingredientPath,
          `ingredient is not in the allowlist: ${ingredient}`,
        ),
      );
    }
  });

  return issues;
}

function unableToValidate<T>(): RecipeSuggestionValidationResult<T> {
  return {
    ok: false,
    issues: [invalidShape('$', 'input could not be validated')],
  };
}

export function validateRecipeSuggestionContext(
  input: unknown,
): RecipeSuggestionValidationResult<RecipeSuggestionContext> {
  try {
    return parseContext(input);
  } catch {
    return unableToValidate<RecipeSuggestionContext>();
  }
}

export function validateRecipeSuggestionResponse(
  context: unknown,
  input: unknown,
): RecipeSuggestionValidationResult<RecipeSuggestionResponse> {
  const contextResult = validateRecipeSuggestionContext(context);
  if (!contextResult.ok) return { ok: false, issues: contextResult.issues };

  try {
    const responseResult = parseResponse(input);
    if (!responseResult.ok) return responseResult;

    const issues: RecipeSuggestionIssue[] = [];
    const usedQuantities = new Map<string, number>();
    responseResult.value.meals.forEach((meal, index) => {
      issues.push(...validateMealSemantics(contextResult.value, meal, index, usedQuantities));
    });

    return issues.length === 0 ? responseResult : { ok: false, issues };
  } catch {
    return unableToValidate<RecipeSuggestionResponse>();
  }
}

export function validateRecipeSuggestionContract(
  context: unknown,
  input: unknown,
): RecipeSuggestionValidationResult<RecipeSuggestionResponse> {
  return validateRecipeSuggestionResponse(context, input);
}
