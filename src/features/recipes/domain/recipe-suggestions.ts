import { z } from 'zod';

export const RECIPE_SUGGESTION_SCHEMA_VERSION = 1 as const;

const nonEmptyStringSchema = z.string().refine((value) => value.trim().length > 0, {
  message: 'must not be blank',
});

const usedItemSchema = z.strictObject({
  inventory_item_id: nonEmptyStringSchema,
  quantity: z.number().positive(),
  unit: nonEmptyStringSchema,
});

const recipeSuggestionMealSchema = z
  .strictObject({
    title: nonEmptyStringSchema,
    source: z.enum(['catalog', 'template', 'model_generated']),
    recipe_id: z.union([nonEmptyStringSchema, z.null()]),
    servings: z.number().int().positive(),
    used_items: z.array(usedItemSchema),
    shopping_needs: z
      .array(
        z.strictObject({
          name: nonEmptyStringSchema,
          quantity: z.number().positive(),
          unit: nonEmptyStringSchema,
        }),
      )
      .optional(),
    additional_ingredients: z.array(nonEmptyStringSchema).max(2),
    steps: z.array(nonEmptyStringSchema).min(1),
    notes: z.array(z.string()),
  })
  .superRefine((meal, context) => {
    const expectsRecipeId = meal.source !== 'model_generated';
    if (expectsRecipeId !== (meal.recipe_id !== null)) {
      context.addIssue({
        code: 'custom',
        path: ['recipe_id'],
        message: expectsRecipeId
          ? 'catalog and template meals require a recipe id'
          : 'model-generated meals cannot reference a recipe id',
      });
    }
  });

export const recipeSuggestionResponseSchema = z.strictObject({
  schema_version: z.literal(RECIPE_SUGGESTION_SCHEMA_VERSION),
  meals: z.array(recipeSuggestionMealSchema).min(1).max(3),
});

export type RecipeSuggestionResponse = z.infer<typeof recipeSuggestionResponseSchema>;
export type RecipeSuggestionMeal = RecipeSuggestionResponse['meals'][number];
