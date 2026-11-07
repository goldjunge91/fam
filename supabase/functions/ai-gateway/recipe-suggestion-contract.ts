export const RECIPE_SUGGESTION_SCHEMA_VERSION = 1 as const;

export type RecipeSuggestionSource = 'catalog' | 'template' | 'model_generated';
export type CandidateRecipeSource = Exclude<RecipeSuggestionSource, 'model_generated'>;

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
  shopping_needs?: Array<{
    name: string;
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

export type MeasurementDimension = 'mass' | 'volume' | 'count' | 'package' | 'portion';
export type ComparableMeasurement = { dimension: MeasurementDimension; value: number };

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
const PLANNED_SHOPPING_ITEM_KEYS = [
  'shopping_item_id',
  'name',
  'quantity',
  'unit',
] as const;
const CANDIDATE_RECIPE_KEYS = ['id', 'source', 'title', 'ingredient_names'] as const;
const RESPONSE_KEYS = ['schema_version', 'meals'] as const;
const MEAL_KEYS = [
  'title',
  'source',
  'recipe_id',
  'servings',
  'used_items',
  'shopping_needs',
  'additional_ingredients',
  'steps',
  'notes',
] as const;
const USED_ITEM_KEYS = ['inventory_item_id', 'quantity', 'unit'] as const;
const SHOPPING_NEED_KEYS = ['name', 'quantity', 'unit'] as const;

const MEASUREMENT_DEFINITIONS: ReadonlyMap<
  string,
  { dimension: MeasurementDimension; factor: number }
> = new Map([
  ['g', { dimension: 'mass', factor: 1 }],
  ['kg', { dimension: 'mass', factor: 1_000 }],
  ['ml', { dimension: 'volume', factor: 1 }],
  ['l', { dimension: 'volume', factor: 1_000 }],
  ['piece', { dimension: 'count', factor: 1 }],
  ['package', { dimension: 'package', factor: 1 }],
  ['portion', { dimension: 'portion', factor: 1 }],
]);

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
  optionalKeys: readonly string[] = [],
): UnknownRecord | null {
  if (!isRecord(value)) {
    issues.push(invalidShape(path, 'must be an object'));
    return null;
  }

  const expected = new Set(expectedKeys);
  if (Object.keys(value).some((key) => !expected.has(key))) {
    issues.push(invalidShape(path, 'object contains unknown fields'));
  }
  const optional = new Set(optionalKeys);
  for (const key of expectedKeys) {
    if (!optional.has(key) && !Object.hasOwn(value, key)) {
      issues.push(invalidShape(`${path}.${key}`, 'field is required'));
    }
  }
  return value;
}

function readArray(
  value: unknown,
  path: string,
  issues: RecipeSuggestionIssue[],
  limits: { min?: number; max?: number } = {},
): unknown[] | null {
  if (!Array.isArray(value)) {
    issues.push(invalidShape(path, 'must be an array'));
    return null;
  }
  if (limits.min !== undefined && value.length < limits.min) {
    issues.push(invalidShape(path, `must contain at least ${limits.min} item(s)`));
  }
  if (limits.max !== undefined && value.length > limits.max) {
    issues.push(invalidShape(path, `must contain at most ${limits.max} item(s)`));
  }
  return value;
}

function requireString(
  value: unknown,
  path: string,
  issues: RecipeSuggestionIssue[],
  allowEmpty = false,
): value is string {
  if (typeof value !== 'string' || (!allowEmpty && value.trim().length === 0)) {
    issues.push(invalidShape(path, allowEmpty ? 'must be a string' : 'must be a non-empty string'));
    return false;
  }
  return true;
}

function requirePositiveNumber(
  value: unknown,
  path: string,
  issues: RecipeSuggestionIssue[],
): value is number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    issues.push(invalidShape(path, 'must be a finite positive number'));
    return false;
  }
  return true;
}

function requireFiniteNumber(
  value: unknown,
  path: string,
  issues: RecipeSuggestionIssue[],
): value is number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    issues.push(invalidShape(path, 'must be a finite number'));
    return false;
  }
  return true;
}

function requirePositiveInteger(
  value: unknown,
  path: string,
  issues: RecipeSuggestionIssue[],
): value is number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value <= 0) {
    issues.push(invalidShape(path, 'must be a positive integer'));
    return false;
  }
  return true;
}

function requireStringArray(
  value: unknown,
  path: string,
  issues: RecipeSuggestionIssue[],
  options: { nonEmptyItems?: boolean; min?: number; max?: number } = {},
): value is string[] {
  const items = readArray(value, path, issues, options);
  if (items === null) return false;

  let valid = true;
  items.forEach((item, index) => {
    valid = requireString(
      item,
      `${path}[${index}]`,
      issues,
      options.nonEmptyItems !== true,
    ) && valid;
  });
  return valid;
}

function requireIdentifier(
  value: unknown,
  path: string,
  issues: RecipeSuggestionIssue[],
): value is string {
  if (typeof value !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(value)) {
    issues.push(invalidShape(path, 'must be a valid identifier'));
    return false;
  }
  return true;
}

function validatePriorityFood(
  value: unknown,
  path: string,
  issues: RecipeSuggestionIssue[],
): void {
  const item = readObject(value, path, PRIORITY_FOOD_KEYS, issues);
  if (item === null) return;
  requireString(item.inventory_item_id, `${path}.inventory_item_id`, issues);
  requireString(item.name, `${path}.name`, issues);
  requirePositiveNumber(item.available_quantity, `${path}.available_quantity`, issues);
  requireString(item.unit, `${path}.unit`, issues);
  requireFiniteNumber(item.priority_score, `${path}.priority_score`, issues);
}

function validatePlannedShoppingItem(
  value: unknown,
  path: string,
  issues: RecipeSuggestionIssue[],
): void {
  const item = readObject(value, path, PLANNED_SHOPPING_ITEM_KEYS, issues);
  if (item === null) return;
  requireString(item.shopping_item_id, `${path}.shopping_item_id`, issues);
  requireString(item.name, `${path}.name`, issues);
  requirePositiveNumber(item.quantity, `${path}.quantity`, issues);
  requireString(item.unit, `${path}.unit`, issues);
}

function validateCandidateRecipe(
  value: unknown,
  path: string,
  issues: RecipeSuggestionIssue[],
): void {
  const candidate = readObject(value, path, CANDIDATE_RECIPE_KEYS, issues);
  if (candidate === null) return;
  requireIdentifier(candidate.id, `${path}.id`, issues);
  if (candidate.source !== 'catalog' && candidate.source !== 'template') {
    issues.push(invalidShape(`${path}.source`, 'must be catalog or template'));
  }
  requireString(candidate.title, `${path}.title`, issues);
  requireStringArray(candidate.ingredient_names, `${path}.ingredient_names`, issues, {
    nonEmptyItems: true,
    min: 1,
  });
}

function validateContextShape(input: unknown): RecipeSuggestionIssue[] {
  const issues: RecipeSuggestionIssue[] = [];
  const context = readObject(input, '$', CONTEXT_KEYS, issues);
  if (context === null) return issues;

  if (context.schema_version !== RECIPE_SUGGESTION_SCHEMA_VERSION) {
    issues.push(invalidShape('$.schema_version', 'must be schema version 1'));
  }

  const request = readObject(context.request, '$.request', REQUEST_KEYS, issues);
  if (request !== null) {
    if (request.type !== 'recipe_suggestion') {
      issues.push(invalidShape('$.request.type', 'must be recipe_suggestion'));
    }
    requirePositiveInteger(request.servings, '$.request.servings', issues);
  }

  const constraints = readObject(context.constraints, '$.constraints', CONSTRAINT_KEYS, issues);
  if (constraints !== null) {
    requireStringArray(constraints.allergies, '$.constraints.allergies', issues);
    requireStringArray(constraints.preferences, '$.constraints.preferences', issues);
    requireStringArray(constraints.allowed_staples, '$.constraints.allowed_staples', issues, {
      nonEmptyItems: true,
    });
    requireStringArray(
      constraints.forbidden_ingredients,
      '$.constraints.forbidden_ingredients',
      issues,
      { nonEmptyItems: true },
    );
  }

  readArray(context.priority_foods, '$.priority_foods', issues)?.forEach((item, index) => {
    validatePriorityFood(item, `$.priority_foods[${index}]`, issues);
  });
  readArray(context.planned_shopping_items, '$.planned_shopping_items', issues)?.forEach(
    (item, index) => {
      validatePlannedShoppingItem(item, `$.planned_shopping_items[${index}]`, issues);
    },
  );
  readArray(context.candidate_recipes, '$.candidate_recipes', issues, { max: 3 })?.forEach(
    (item, index) => {
      validateCandidateRecipe(item, `$.candidate_recipes[${index}]`, issues);
    },
  );

  if (
    context.shopping_question !== null &&
    !requireString(context.shopping_question, '$.shopping_question', issues)
  ) {
    // The helper records the issue.
  }
  if (typeof context.fallback_allowed !== 'boolean') {
    issues.push(invalidShape('$.fallback_allowed', 'must be a boolean'));
  }

  return issues;
}

function validateContextSemantics(context: RecipeSuggestionContext): RecipeSuggestionIssue[] {
  const issues: RecipeSuggestionIssue[] = [];
  const candidateIds = new Set<string>();
  const inventoryIds = new Set<string>();
  const shoppingItemIds = new Set<string>();
  const forbiddenIngredients = new Set(
    context.constraints.forbidden_ingredients.map(normalize),
  );

  context.priority_foods.forEach((food, index) => {
    if (inventoryIds.has(food.inventory_item_id)) {
      issues.push(
        issue(
          'invalid_reference',
          `$.priority_foods[${index}].inventory_item_id`,
          'inventory item ids must be unique',
        ),
      );
    }
    inventoryIds.add(food.inventory_item_id);
  });

  context.planned_shopping_items.forEach((item, index) => {
    if (shoppingItemIds.has(item.shopping_item_id)) {
      issues.push(
        issue(
          'invalid_reference',
          `$.planned_shopping_items[${index}].shopping_item_id`,
          'shopping item ids must be unique',
        ),
      );
    }
    shoppingItemIds.add(item.shopping_item_id);
  });

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

    candidate.ingredient_names.forEach((ingredient, ingredientIndex) => {
      if (forbiddenIngredients.has(normalize(ingredient))) {
        issues.push(
          issue(
            'forbidden_ingredient',
            `$.candidate_recipes[${index}].ingredient_names[${ingredientIndex}]`,
            `ingredient is forbidden: ${ingredient}`,
          ),
        );
      }
    });
  });

  if (context.fallback_allowed !== (context.candidate_recipes.length === 0)) {
    issues.push(
      issue(
        'fallback_not_allowed',
        '$.fallback_allowed',
        'fallback is allowed exactly when no candidate recipe exists',
      ),
    );
  }
  if (context.shopping_question !== null && context.planned_shopping_items.length > 0) {
    issues.push(
      invalidShape(
        '$.shopping_question',
        'shopping question must be null when shopping items are planned',
      ),
    );
  }

  return issues;
}

function validateUsedItem(
  value: unknown,
  path: string,
  issues: RecipeSuggestionIssue[],
): void {
  const item = readObject(value, path, USED_ITEM_KEYS, issues);
  if (item === null) return;
  requireString(item.inventory_item_id, `${path}.inventory_item_id`, issues);
  requirePositiveNumber(item.quantity, `${path}.quantity`, issues);
  requireString(item.unit, `${path}.unit`, issues);
}

function validateShoppingNeed(
  value: unknown,
  path: string,
  issues: RecipeSuggestionIssue[],
): void {
  const item = readObject(value, path, SHOPPING_NEED_KEYS, issues);
  if (item === null) return;
  requireString(item.name, `${path}.name`, issues);
  requirePositiveNumber(item.quantity, `${path}.quantity`, issues);
  requireString(item.unit, `${path}.unit`, issues);
}

function validateMealShape(
  value: unknown,
  path: string,
  issues: RecipeSuggestionIssue[],
): void {
  const meal = readObject(value, path, MEAL_KEYS, issues, ['shopping_needs']);
  if (meal === null) return;

  requireString(meal.title, `${path}.title`, issues);
  if (
    meal.source !== 'catalog' &&
    meal.source !== 'template' &&
    meal.source !== 'model_generated'
  ) {
    issues.push(
      invalidShape(`${path}.source`, 'must be catalog, template, or model_generated'),
    );
  }
  if (meal.recipe_id !== null) {
    requireString(meal.recipe_id, `${path}.recipe_id`, issues);
  }
  requirePositiveInteger(meal.servings, `${path}.servings`, issues);
  readArray(meal.used_items, `${path}.used_items`, issues)?.forEach((item, index) => {
    validateUsedItem(item, `${path}.used_items[${index}]`, issues);
  });
  if (meal.shopping_needs !== undefined) {
    readArray(meal.shopping_needs, `${path}.shopping_needs`, issues)?.forEach((item, index) => {
      validateShoppingNeed(item, `${path}.shopping_needs[${index}]`, issues);
    });
  }
  requireStringArray(
    meal.additional_ingredients,
    `${path}.additional_ingredients`,
    issues,
    { nonEmptyItems: true, max: 2 },
  );
  requireStringArray(meal.steps, `${path}.steps`, issues, {
    nonEmptyItems: true,
    min: 1,
  });
  requireStringArray(meal.notes, `${path}.notes`, issues);
}

function validateResponseShape(input: unknown): RecipeSuggestionIssue[] {
  const issues: RecipeSuggestionIssue[] = [];
  const response = readObject(input, '$', RESPONSE_KEYS, issues);
  if (response === null) return issues;

  if (response.schema_version !== RECIPE_SUGGESTION_SCHEMA_VERSION) {
    issues.push(invalidShape('$.schema_version', 'must be schema version 1'));
  }
  readArray(response.meals, '$.meals', issues, { min: 1, max: 3 })?.forEach(
    (meal, index) => {
      validateMealShape(meal, `$.meals[${index}]`, issues);
    },
  );
  return issues;
}

function normalize(value: string): string {
  return value.trim().toLocaleLowerCase('de-DE');
}

export function comparableMeasurement(
  quantity: number,
  unit: string,
): ComparableMeasurement | null {
  const definition = MEASUREMENT_DEFINITIONS.get(normalize(unit));
  if (definition === undefined) return null;

  const value = quantity * definition.factor;
  return Number.isFinite(value) ? { dimension: definition.dimension, value } : null;
}

function validateMealSemantics(
  context: RecipeSuggestionContext,
  meal: RecipeSuggestionMeal,
  mealIndex: number,
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
          'recipe id must be null for model-generated meals',
        ),
      );
    }
    if (!context.fallback_allowed) {
      issues.push(
        issue(
          'fallback_not_allowed',
          `${path}.source`,
          'model-generated meals are not allowed while candidates exist',
        ),
      );
    }
  } else if (candidate === undefined) {
    issues.push(
      issue(
        'invalid_reference',
        `${path}.recipe_id`,
        'recipe id does not reference a context candidate',
      ),
    );
  } else if (candidate.source !== meal.source) {
    issues.push(
      issue(
        'source_mismatch',
        `${path}.source`,
        'source does not match the referenced candidate',
      ),
    );
  }

  const seenInventoryIds = new Set<string>();
  for (const [itemIndex, item] of meal.used_items.entries()) {
    const itemPath = `${path}.used_items[${itemIndex}]`;
    if (seenInventoryIds.has(item.inventory_item_id)) {
      issues.push(
        issue(
          'invalid_reference',
          `${itemPath}.inventory_item_id`,
          'an inventory item may occur only once per meal',
        ),
      );
      continue;
    }
    seenInventoryIds.add(item.inventory_item_id);

    const inventoryItem = inventoryById.get(item.inventory_item_id);
    if (inventoryItem === undefined) {
      issues.push(
        issue(
          'invalid_reference',
          `${itemPath}.inventory_item_id`,
          'inventory item is not present in priority foods',
        ),
      );
      continue;
    }

    if (
      candidate !== undefined &&
      !candidate.ingredient_names.some(
        (ingredient) => normalize(ingredient) === normalize(inventoryItem.name),
      )
    ) {
      issues.push(
        issue(
          'invalid_reference',
          `${itemPath}.inventory_item_id`,
          'inventory item is not part of the referenced recipe',
        ),
      );
    }

    const used = comparableMeasurement(item.quantity, item.unit);
    const available = comparableMeasurement(
      inventoryItem.available_quantity,
      inventoryItem.unit,
    );
    if (used === null || available === null || used.dimension !== available.dimension) {
      issues.push(
        issue(
          'invalid_quantity',
          `${itemPath}.unit`,
          'unit is not compatible with the inventory item',
        ),
      );
      continue;
    }

    const tolerance = Number.EPSILON * Math.max(used.value, available.value, 1) * 8;
    if (used.value - available.value > tolerance) {
      issues.push(
        issue(
          'invalid_quantity',
          `${itemPath}.quantity`,
          'quantity exceeds the available inventory amount',
        ),
      );
    }
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
          `ingredient is not approved: ${ingredient}`,
        ),
      );
    }
  });
  meal.shopping_needs?.forEach((need, needIndex) => {
    if (forbiddenIngredients.has(normalize(need.name))) {
      issues.push(
        issue(
          'forbidden_ingredient',
          `${path}.shopping_needs[${needIndex}].name`,
          `ingredient is forbidden: ${need.name}`,
        ),
      );
    }
  });

  return issues;
}

function validationFailure<T>(
  issues: RecipeSuggestionIssue[],
): RecipeSuggestionValidationResult<T> {
  return { ok: false, issues };
}

export function validateRecipeSuggestionContext(
  input: unknown,
): RecipeSuggestionValidationResult<RecipeSuggestionContext> {
  try {
    const shapeIssues = validateContextShape(input);
    if (shapeIssues.length > 0) return validationFailure(shapeIssues);

    const context = input as RecipeSuggestionContext;
    const semanticIssues = validateContextSemantics(context);
    return semanticIssues.length === 0
      ? { ok: true, value: context }
      : validationFailure(semanticIssues);
  } catch {
    return validationFailure([invalidShape('$', 'input could not be validated')]);
  }
}

export function validateRecipeSuggestionResponse(
  contextInput: unknown,
  responseInput: unknown,
): RecipeSuggestionValidationResult<RecipeSuggestionResponse> {
  const contextResult = validateRecipeSuggestionContext(contextInput);
  if (!contextResult.ok) return validationFailure(contextResult.issues);

  try {
    const shapeIssues = validateResponseShape(responseInput);
    if (shapeIssues.length > 0) return validationFailure(shapeIssues);

    const response = responseInput as RecipeSuggestionResponse;
    const semanticIssues = response.meals.flatMap((meal, index) =>
      validateMealSemantics(contextResult.value, meal, index)
    );
    return semanticIssues.length === 0
      ? { ok: true, value: response }
      : validationFailure(semanticIssues);
  } catch {
    return validationFailure([invalidShape('$', 'input could not be validated')]);
  }
}
