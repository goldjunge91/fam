import type { DietaryTag, Difficulty, DishType } from '@/features/recipes/use-recipes';

/** Gemeinsame Labels fuer Wizard, Liste, Rezept- und Vorlagendetail. */

export const DIFFICULTIES: { value: Difficulty; label: string }[] = [
  { value: 'easy', label: 'Einfach' },
  { value: 'medium', label: 'Mittel' },
  { value: 'hard', label: 'Schwer' },
];

export const DISH_TYPES: { value: DishType; label: string }[] = [
  { value: 'breakfast', label: 'Frühstück' },
  { value: 'lunch', label: 'Mittag' },
  { value: 'dinner', label: 'Abend' },
  { value: 'snack', label: 'Snack' },
  { value: 'dessert', label: 'Dessert' },
  { value: 'appetizer', label: 'Vorspeise' },
  { value: 'brunch', label: 'Brunch' },
];

export const DIETARY_TAGS: { value: DietaryTag; label: string }[] = [
  { value: 'vegetarian', label: 'Vegetarisch' },
  { value: 'vegan', label: 'Vegan' },
  { value: 'high_fat', label: 'Fettreich' },
  { value: 'low_fat', label: 'Fettarm' },
  { value: 'lactose_free', label: 'Laktosefrei' },
  { value: 'sugar_free', label: 'Zuckerfrei' },
  { value: 'gluten_free', label: 'Glutenfrei' },
];

export const DIFFICULTY_LABELS: Record<Difficulty, string> = Object.fromEntries(
  DIFFICULTIES.map((item) => [item.value, item.label]),
) as Record<Difficulty, string>;

export const DISH_TYPE_LABELS: Record<DishType, string> = Object.fromEntries(
  DISH_TYPES.map((item) => [item.value, item.label]),
) as Record<DishType, string>;

export const DIETARY_TAG_LABELS: Record<DietaryTag, string> = Object.fromEntries(
  DIETARY_TAGS.map((item) => [item.value, item.label]),
) as Record<DietaryTag, string>;
