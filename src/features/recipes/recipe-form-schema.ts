import { z } from 'zod';

export const recipeFormSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, 'Bitte gib einen Titel ein.')
    .max(120, 'Der Titel darf höchstens 120 Zeichen lang sein.'),
  description: z.string().max(2_000, 'Die Beschreibung darf höchstens 2.000 Zeichen lang sein.'),
  cookTimeMinutes: z
    .string()
    .regex(/^\d*$/, 'Die Kochzeit muss eine ganze Zahl sein.')
    .refine((value) => value === '' || Number(value) <= 10_000, 'Die Kochzeit ist zu groß.'),
  defaultServings: z
    .number()
    .int('Die Portionenzahl muss eine ganze Zahl sein.')
    .min(1, 'Mindestens eine Portion ist erforderlich.')
    .max(100, 'Höchstens 100 Portionen sind möglich.'),
  difficulty: z.enum(['easy', 'medium', 'hard']).nullable(),
  dishTypes: z.array(
    z.enum(['breakfast', 'lunch', 'dinner', 'snack', 'dessert', 'appetizer', 'brunch']),
  ),
  dietaryTags: z.array(
    z.enum([
      'vegetarian',
      'vegan',
      'high_fat',
      'low_fat',
      'lactose_free',
      'sugar_free',
      'gluten_free',
    ]),
  ),
  hashtagsInput: z.string().max(500, 'Hashtags dürfen zusammen höchstens 500 Zeichen lang sein.'),
});

export type RecipeFormValues = z.infer<typeof recipeFormSchema>;

export const RECIPE_FORM_DEFAULTS: RecipeFormValues = {
  title: '',
  description: '',
  cookTimeMinutes: '',
  defaultServings: 4,
  difficulty: null,
  dishTypes: [],
  dietaryTags: [],
  hashtagsInput: '',
};
