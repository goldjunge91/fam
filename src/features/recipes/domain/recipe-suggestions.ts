import { z } from 'zod';

export const RECIPE_SUGGESTION_SCHEMA_VERSION = 1 as const;

const nonEmptyStringSchema = z.string().refine((value) => value.trim().length > 0, {
  message: 'must not be blank',
});

const identifierSchema = z
  .string()
  .min(1)
  .regex(/^[A-Za-z0-9][A-Za-z0-9._:-]*$/)
  .refine((value) => value.trim().length > 0, { message: 'must not be blank' });

const positiveNumberSchema = z.number().positive();
const positiveIntegerSchema = z.number().int().positive();

type MeasurementDimension = 'mass' | 'volume' | 'count' | 'package' | 'portion';
type ComparableMeasurement = { dimension: MeasurementDimension; value: number };

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

function comparableMeasurement(quantity: number, unit: string): ComparableMeasurement | null {
  const definition = MEASUREMENT_DEFINITIONS.get(unit.trim().toLocaleLowerCase('de-DE'));
  if (!definition) return null;

  const value = quantity * definition.factor;
  return Number.isFinite(value) ? { dimension: definition.dimension, value } : null;
}

const priorityFoodSchema = z.strictObject({
  inventory_item_id: nonEmptyStringSchema,
  name: nonEmptyStringSchema,
  available_quantity: positiveNumberSchema,
  unit: nonEmptyStringSchema,
  priority_score: z.number(),
});

const plannedShoppingItemSchema = z.strictObject({
  shopping_item_id: nonEmptyStringSchema,
  name: nonEmptyStringSchema,
  quantity: positiveNumberSchema,
  unit: nonEmptyStringSchema,
});

const candidateRecipeSchema = z.strictObject({
  id: identifierSchema,
  source: z.enum(['catalog', 'template']),
  title: nonEmptyStringSchema,
  ingredient_names: z.array(nonEmptyStringSchema).min(1),
});

export const recipeSuggestionContextSchema = z.strictObject({
  schema_version: z.literal(RECIPE_SUGGESTION_SCHEMA_VERSION),
  request: z.strictObject({
    type: z.literal('recipe_suggestion'),
    servings: positiveIntegerSchema,
  }),
  constraints: z.strictObject({
    allergies: z.array(z.string()),
    preferences: z.array(z.string()),
    allowed_staples: z.array(nonEmptyStringSchema),
    forbidden_ingredients: z.array(nonEmptyStringSchema),
  }),
  priority_foods: z.array(priorityFoodSchema),
  planned_shopping_items: z.array(plannedShoppingItemSchema),
  candidate_recipes: z.array(candidateRecipeSchema).max(3),
  shopping_question: z.union([z.string(), z.null()]),
  fallback_allowed: z.boolean(),
});

const usedItemSchema = z.strictObject({
  inventory_item_id: nonEmptyStringSchema,
  quantity: positiveNumberSchema,
  unit: nonEmptyStringSchema,
});

const recipeSuggestionMealSchema = z.strictObject({
  title: nonEmptyStringSchema,
  source: z.enum(['catalog', 'template', 'model_generated']),
  recipe_id: z.union([z.string().min(1), z.null()]),
  servings: positiveIntegerSchema,
  used_items: z.array(usedItemSchema),
  additional_ingredients: z.array(nonEmptyStringSchema).max(2),
  steps: z.array(nonEmptyStringSchema).min(1),
  notes: z.array(z.string()),
});

export const recipeSuggestionResponseSchema = z.strictObject({
  schema_version: z.literal(RECIPE_SUGGESTION_SCHEMA_VERSION),
  meals: z.array(recipeSuggestionMealSchema).min(1).max(3),
});

export type RecipeSuggestionContext = z.infer<typeof recipeSuggestionContextSchema>;
export type RecipeSuggestionResponse = z.infer<typeof recipeSuggestionResponseSchema>;
export type RecipeSuggestionMeal = RecipeSuggestionResponse['meals'][number];

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

function formatPath(path: PropertyKey[]): string {
  if (path.length === 0) return '$';

  return path.reduce<string>((result, segment) => {
    if (typeof segment === 'number') return `${result}[${segment}]`;
    return `${result}.${String(segment)}`;
  }, '$');
}

function shapeIssues(error: z.ZodError): RecipeSuggestionIssue[] {
  return error.issues.map((issue) => ({
    code: 'invalid_shape',
    path: formatPath(issue.path),
    message: issue.message,
  }));
}

function normalize(value: string): string {
  return value.trim().toLocaleLowerCase('de-DE');
}

function contextSemanticIssues(context: RecipeSuggestionContext): RecipeSuggestionIssue[] {
  const issues: RecipeSuggestionIssue[] = [];
  const candidateIds = new Set<string>();

  context.candidate_recipes.forEach((candidate, index) => {
    if (candidateIds.has(candidate.id)) {
      issues.push({
        code: 'invalid_reference',
        path: `$.candidate_recipes[${index}].id`,
        message: 'candidate recipe ids must be unique',
      });
    }
    candidateIds.add(candidate.id);
  });

  if (context.fallback_allowed !== (context.candidate_recipes.length === 0)) {
    issues.push({
      code: 'fallback_not_allowed',
      path: '$.fallback_allowed',
      message: 'fallback_allowed must be true exactly when no candidate recipe exists',
    });
  }

  if (context.shopping_question !== null && context.planned_shopping_items.length > 0) {
    issues.push({
      code: 'invalid_shape',
      path: '$.shopping_question',
      message: 'shopping_question must be null when shopping items are planned',
    });
  }

  return issues;
}

export function validateRecipeSuggestionContext(
  input: unknown,
): RecipeSuggestionValidationResult<RecipeSuggestionContext> {
  const parsed = recipeSuggestionContextSchema.safeParse(input);
  if (!parsed.success) return { ok: false, issues: shapeIssues(parsed.error) };

  const issues = contextSemanticIssues(parsed.data);
  return issues.length === 0 ? { ok: true, value: parsed.data } : { ok: false, issues };
}

function validateMeal(
  context: RecipeSuggestionContext,
  meal: RecipeSuggestionMeal,
  mealIndex: number,
  usedQuantities: Map<string, ComparableMeasurement>,
): RecipeSuggestionIssue[] {
  const issues: RecipeSuggestionIssue[] = [];
  const path = `$.meals[${mealIndex}]`;
  const inventoryById = new Map(
    context.priority_foods.map((food) => [food.inventory_item_id, food]),
  );
  const candidate = context.candidate_recipes.find((item) => item.id === meal.recipe_id);

  if (meal.source === 'model_generated') {
    if (meal.recipe_id !== null) {
      issues.push({
        code: 'source_mismatch',
        path: `${path}.recipe_id`,
        message: 'recipe_id must be null for model_generated meals',
      });
    }
    if (!context.fallback_allowed) {
      issues.push({
        code: 'fallback_not_allowed',
        path: `${path}.source`,
        message: 'model_generated meals are not allowed while candidate recipes exist',
      });
    }
  } else {
    if (!candidate) {
      issues.push({
        code: 'invalid_reference',
        path: `${path}.recipe_id`,
        message: 'recipe_id does not reference a candidate recipe in the context',
      });
    } else if (candidate.source !== meal.source) {
      issues.push({
        code: 'source_mismatch',
        path: `${path}.source`,
        message: 'source does not match the referenced candidate recipe',
      });
    }
  }

  const allowedAdditionalIngredients = new Set(
    [
      ...context.constraints.allowed_staples,
      ...context.planned_shopping_items.map((item) => item.name),
    ].map(normalize),
  );
  const forbiddenIngredients = new Set(context.constraints.forbidden_ingredients.map(normalize));

  meal.used_items.forEach((item, itemIndex) => {
    const itemPath = `${path}.used_items[${itemIndex}]`;
    const inventoryItem = inventoryById.get(item.inventory_item_id);

    if (!inventoryItem) {
      issues.push({
        code: 'invalid_reference',
        path: `${itemPath}.inventory_item_id`,
        message: 'inventory item is not present in priority_foods',
      });
      return;
    }

    if (
      candidate &&
      !candidate.ingredient_names.some(
        (ingredientName) => normalize(ingredientName) === normalize(inventoryItem.name),
      )
    ) {
      issues.push({
        code: 'invalid_reference',
        path: `${itemPath}.inventory_item_id`,
        message: 'inventory item is not an ingredient of the referenced recipe',
      });
    }

    const used = comparableMeasurement(item.quantity, item.unit);
    const available = comparableMeasurement(inventoryItem.available_quantity, inventoryItem.unit);
    if (used === null || available === null || used.dimension !== available.dimension) {
      issues.push({
        code: 'invalid_quantity',
        path: `${itemPath}.unit`,
        message: 'unit is not compatible with the inventory item',
      });
      return;
    }

    const previous = usedQuantities.get(item.inventory_item_id);
    const totalQuantity =
      previous === undefined
        ? used
        : { dimension: used.dimension, value: previous.value + used.value };
    usedQuantities.set(item.inventory_item_id, totalQuantity);
    const tolerance = Number.EPSILON * Math.max(totalQuantity.value, available.value) * 4;
    if (totalQuantity.value - available.value > tolerance) {
      issues.push({
        code: 'invalid_quantity',
        path: `${itemPath}.quantity`,
        message: 'total quantity exceeds the available inventory quantity',
      });
    }
  });

  meal.additional_ingredients.forEach((ingredient, ingredientIndex) => {
    const ingredientPath = `${path}.additional_ingredients[${ingredientIndex}]`;
    const normalizedIngredient = normalize(ingredient);

    if (forbiddenIngredients.has(normalizedIngredient)) {
      issues.push({
        code: 'forbidden_ingredient',
        path: ingredientPath,
        message: `ingredient is forbidden: ${ingredient}`,
      });
    } else if (!allowedAdditionalIngredients.has(normalizedIngredient)) {
      issues.push({
        code: 'unapproved_ingredient',
        path: ingredientPath,
        message: `ingredient is not in the allowlist: ${ingredient}`,
      });
    }
  });

  return issues;
}

export function validateRecipeSuggestionResponse(
  context: RecipeSuggestionContext,
  input: unknown,
): RecipeSuggestionValidationResult<RecipeSuggestionResponse> {
  const parsed = recipeSuggestionResponseSchema.safeParse(input);
  if (!parsed.success) return { ok: false, issues: shapeIssues(parsed.error) };

  const issues: RecipeSuggestionIssue[] = [];
  const usedQuantities = new Map<string, ComparableMeasurement>();
  parsed.data.meals.forEach((meal, index) => {
    issues.push(...validateMeal(context, meal, index, usedQuantities));
  });

  return issues.length === 0 ? { ok: true, value: parsed.data } : { ok: false, issues };
}
