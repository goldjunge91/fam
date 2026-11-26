import type { TFunction } from 'i18next';
import { z } from 'zod';

import { UNIT_VALUES, type UnitValue } from '@/lib/units';

const UNIT_ALIASES: Record<string, UnitValue> = {
  piece: 'piece',
  stk: 'piece',
  'stk.': 'piece',
  stück: 'piece',
  stueck: 'piece',
  g: 'g',
  gramm: 'g',
  'gramm (g)': 'g',
  gram: 'g',
  kg: 'kg',
  kilogramm: 'kg',
  kilo: 'kg',
  'kilogram (kg)': 'kg',
  ml: 'ml',
  milliliter: 'ml',
  'milliliter (ml)': 'ml',
  l: 'l',
  liter: 'l',
  litre: 'l',
  'liter (l)': 'l',
  package: 'package',
  packung: 'package',
  pkg: 'package',
  'packung (package)': 'package',
  portion: 'portion',
  pck: 'portion',
};

const isShoppingUnit = (value: string): value is UnitValue =>
  UNIT_VALUES.includes(value as UnitValue);

export function normalizeCustomIngredientUnit(rawUnit: string): string {
  const normalized = rawUnit.trim().toLowerCase();
  return UNIT_ALIASES[normalized] ?? normalized;
}

export function customIngredientUnitLabel(unit: string, t: TFunction): string {
  return isShoppingUnit(unit) ? t(`common.units.${unit}`) : unit;
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
