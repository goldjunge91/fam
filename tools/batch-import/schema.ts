import { z } from 'zod';

const item = z
  .object({
    key: z.string().min(1),
    ingredientName: z.string().min(1).optional(),
    productId: z.string().uuid().optional(),
    subComponentKey: z.string().min(1).optional(),
    grams: z.number().positive(),
    quantity: z.number().positive().optional(),
    unit: z.enum(['g', 'kg', 'ml', 'l', 'piece', 'package', 'portion']).default('g'),
    position: z.number().int().nonnegative().default(0),
    optional: z.boolean().default(false),
    source_note: z.string().nullable().optional(),
  })
  .refine(
    (value) =>
      Number(Boolean(value.ingredientName)) +
        Number(Boolean(value.productId)) +
        Number(Boolean(value.subComponentKey)) ===
      1,
    'Genau eine Zutat, productId oder Untergruppe angeben.',
  );
const substitution = z.object({
  forIngredientId: z.string().min(1),
  swap: z.string().min(1),
  savings: z.string().optional(),
});
const image = z
  .object({
    storagePath: z.string().min(1).nullable().optional(),
    sourceUrl: z.string().url().nullable().optional(),
    localPath: z.string().min(1).nullable().optional(),
    sourcePageUrl: z.string().url().nullable().optional(),
    sourceName: z.string().nullable().optional(),
    license: z.string().nullable().optional(),
    attributionRequired: z.boolean().default(false),
    attributionText: z.string().nullable().optional(),
    verifiedMatch: z.boolean().default(false),
    altText: z.string().nullable().optional(),
    position: z.number().int().nonnegative().default(0),
  })
  .refine(
    (value) => Boolean(value.storagePath ?? value.sourceUrl ?? value.localPath),
    'Ein Bild braucht storagePath, sourceUrl oder localPath.',
  );
const component = z.object({
  key: z.string().min(1),
  name: z.string().min(1).max(120),
  servingGrams: z.number().positive().nullable().optional(),
  position: z.number().int().nonnegative().default(0),
  items: z.array(item).default([]),
});
const step = z.object({
  position: z.number().int().nonnegative(),
  text: z.string().min(1).max(2000),
  timerMinutes: z.number().int().positive().nullable().optional(),
  ingredientKeys: z.array(z.string()).default([]),
  images: z.array(z.string()).default([]),
});
const batchRecipe = z.object({
  externalId: z.string().min(1),
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  title: z.string().min(1).max(200),
  instructions: z.string().nullable().optional(),
  prepTimeMinutes: z.number().int().positive().nullable().optional(),
  cookTimeMinutes: z.number().int().positive().nullable().optional(),
  storageInstructions: z.string().nullable().optional(),
  reheatingInstructions: z.string().nullable().optional(),
  cheapTips: z.array(z.string()).default([]),
  substitutions: z.array(substitution).default([]),
  crispinessLevel: z.string().nullable().optional(),
  airFryerTimeMinutes: z.number().int().positive().nullable().optional(),
  airFryerTemperatureF: z.number().int().positive().nullable().optional(),
  variantGroup: z.string().nullable().optional(),
  variantType: z.string().nullable().optional(),
  dormFriendly: z.boolean().nullable().optional(),
  mealPrepFriendly: z.boolean().nullable().optional(),
  whyCheap: z.string().nullable().optional(),
  healthierTips: z.array(z.string()).default([]),
  batchPrepTips: z.array(z.string()).default([]),
  optionalAddIns: z.array(z.string()).default([]),
  difficulty: z.enum(['easy', 'medium', 'hard']).nullable().optional(),
  dishTypes: z.array(z.string()).default([]),
  dietaryTags: z.array(z.string()).default([]),
  hashtags: z.array(z.string()).default([]),
  defaultServings: z.number().int().positive().default(1),
  status: z.enum(['draft', 'published', 'archived']).default('published'),
  sortOrder: z.number().int().default(0),
  sourceUrl: z.string().url().nullable().optional(),
  cover: z.string().optional(),
  components: z.array(component).default([]),
  steps: z.array(step).default([]),
  images: z.array(image).default([]),
});

export const batchSchema = z
  .object({
    format: z.string().optional(),
    schemaVersion: z.union([z.literal(1), z.literal(2)]),
    source: z
      .object({ repository: z.string().url(), dataset: z.string().min(1) })
      .optional(),
    recipes: z.array(batchRecipe),
    warnings: z.array(z.unknown()).optional(),
  })
  .superRefine((batch, ctx) => {
    for (const field of ['externalId', 'slug'] as const) {
      const seen = new Map<string, number>();
      batch.recipes.forEach((recipe, index) => {
        const value = recipe[field];
        const previous = seen.get(value);
        if (previous !== undefined) {
          ctx.addIssue({
            code: 'custom',
            path: ['recipes', index, field],
            message: `${field} doppelt (bereits in Rezept ${previous + 1})`,
          });
        } else {
          seen.set(value, index);
        }
      });
    }
  });

export type Batch = z.infer<typeof batchSchema>;
