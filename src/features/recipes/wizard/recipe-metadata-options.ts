/**
 * Anzeige-Labels fuer Rezept-Metadaten — einzige Quelle fuer Wizard-Auswahl,
 * Rezeptliste sowie Rezept- und Vorlagendetail (#158). Vorher pflegten diese
 * Ansichten eigene Kopien, die auseinanderlaufen konnten (z. B. "hard" mal als
 * "Schwer", mal als "Anspruchsvoll").
 */

export const DIFFICULTY_LABELS = {
  easy: 'Einfach',
  medium: 'Mittel',
  hard: 'Schwer',
} as const;

export const DISH_TYPE_LABELS = {
  breakfast: 'Frühstück',
  lunch: 'Mittag',
  dinner: 'Abend',
  snack: 'Snack',
  dessert: 'Dessert',
  appetizer: 'Vorspeise',
  brunch: 'Brunch',
} as const;

export const DIETARY_TAG_LABELS = {
  vegetarian: 'Vegetarisch',
  vegan: 'Vegan',
  high_fat: 'Fettreich',
  low_fat: 'Fettarm',
  lactose_free: 'Laktosefrei',
  sugar_free: 'Zuckerfrei',
  gluten_free: 'Glutenfrei',
} as const;

export type Difficulty = keyof typeof DIFFICULTY_LABELS;
export type DishType = keyof typeof DISH_TYPE_LABELS;
export type DietaryTag = keyof typeof DIETARY_TAG_LABELS;

export const DIFFICULTY_VALUES = Object.keys(DIFFICULTY_LABELS) as [Difficulty, ...Difficulty[]];
export const DISH_TYPE_VALUES = Object.keys(DISH_TYPE_LABELS) as [DishType, ...DishType[]];
export const DIETARY_TAG_VALUES = Object.keys(DIETARY_TAG_LABELS) as [DietaryTag, ...DietaryTag[]];

export const DIFFICULTIES = DIFFICULTY_VALUES.map((value) => ({
  value,
  label: DIFFICULTY_LABELS[value],
}));
export const DISH_TYPES = DISH_TYPE_VALUES.map((value) => ({
  value,
  label: DISH_TYPE_LABELS[value],
}));
export const DIETARY_TAGS = DIETARY_TAG_VALUES.map((value) => ({
  value,
  label: DIETARY_TAG_LABELS[value],
}));
