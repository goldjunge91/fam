import { z } from 'zod';

import { UNIT_OPTIONS } from '@/lib/units';

const isShoppingUnit = (value: string) => UNIT_OPTIONS.some((option) => option.value === value);

export function normalizeCustomIngredientUnit(rawUnit: string): string {
  const normalized = rawUnit.trim().toLowerCase();
  return (
    UNIT_OPTIONS.find(
      (option) =>
        option.value.toLowerCase() === normalized || option.label.toLowerCase() === normalized,
    )?.value ?? normalized
  );
}

export function customIngredientUnitLabel(unit: string): string {
  return UNIT_OPTIONS.find((option) => option.value === unit)?.label ?? unit;
}

export const customIngredientSchema = z
  .object({
    name: z.string().trim().min(1).max(200),
    quantity: z.number().finite().positive(),
    unit: z.string().trim().min(1).refine(isShoppingUnit),
  })
  .strict();

export const customIngredientsSchema = z.array(customIngredientSchema).max(100);

export const customTitleSchema = z.string().trim().min(1).max(120);

export type CustomIngredient = z.infer<typeof customIngredientSchema>;

/** Parses either a SQLite JSON string or the JSON array returned by Supabase. */
export function parseCustomIngredients(value: unknown): CustomIngredient[] {
  if (typeof value === 'string') {
    return customIngredientsSchema.parse(JSON.parse(value) as unknown);
  }
  return customIngredientsSchema.parse(value ?? []);
}
