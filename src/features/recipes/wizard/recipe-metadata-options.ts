import type { TFunction } from 'i18next';

export const DIFFICULTY_VALUES = ['easy', 'medium', 'hard'] as const;
export type Difficulty = (typeof DIFFICULTY_VALUES)[number];

export const DISH_TYPE_VALUES = [
  'breakfast',
  'lunch',
  'dinner',
  'snack',
  'dessert',
  'appetizer',
  'brunch',
] as const;
export type DishType = (typeof DISH_TYPE_VALUES)[number];

export const DIETARY_TAG_VALUES = [
  'vegetarian',
  'vegan',
  'high_fat',
  'low_fat',
  'lactose_free',
  'sugar_free',
  'gluten_free',
] as const;
export type DietaryTag = (typeof DIETARY_TAG_VALUES)[number];

export type RecipeMetadataOption<T extends string> = {
  value: T;
  label: string;
};

export function getDifficultyLabel(t: TFunction, value: Difficulty): string {
  return t(`recipes.metadata.difficulty.${value}`);
}

export function getDishTypeLabel(t: TFunction, value: DishType): string {
  return t(`recipes.metadata.dishType.${value}`);
}

export function getDietaryTagLabel(t: TFunction, value: DietaryTag): string {
  return t(`recipes.metadata.dietaryTag.${value}`);
}

export function getDifficultyOptions(t: TFunction): readonly RecipeMetadataOption<Difficulty>[] {
  return DIFFICULTY_VALUES.map((value) => ({ value, label: getDifficultyLabel(t, value) }));
}

export function getDishTypeOptions(t: TFunction): readonly RecipeMetadataOption<DishType>[] {
  return DISH_TYPE_VALUES.map((value) => ({ value, label: getDishTypeLabel(t, value) }));
}

export function getDietaryTagOptions(t: TFunction): readonly RecipeMetadataOption<DietaryTag>[] {
  return DIETARY_TAG_VALUES.map((value) => ({ value, label: getDietaryTagLabel(t, value) }));
}

export function getRecipeNumber(value: number, locale: string, maximumFractionDigits = 6): string {
  return new Intl.NumberFormat(locale, { maximumFractionDigits }).format(value);
}
