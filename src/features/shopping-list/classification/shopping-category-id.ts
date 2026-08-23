/**
 * Stabile Kategorie-IDs der Einkaufslisten-Taxonomie (Issue #223).
 *
 * Diese IDs sind die einzige gespeicherte Form der Kategorie — Labels
 * (`SHOPPING_CATEGORIES` in `../domain-logik/shopping-categories.ts`) werden
 * ausschließlich zur Anzeige aufgelöst, niemals persistiert.
 */
export type ShoppingCategoryId =
  | 'produce'
  | 'bakery'
  | 'convenience'
  | 'breakfast'
  | 'hot_beverages'
  | 'pantry_staples'
  | 'cooking_baking'
  | 'canned_sauces'
  | 'snacks'
  | 'beverages'
  | 'drugstore'
  | 'baby_kids'
  | 'household'
  | 'pet_supplies'
  | 'meat_poultry'
  | 'fish_seafood'
  | 'deli_cold_cuts'
  | 'plant_based'
  | 'dairy_eggs'
  | 'frozen'
  | 'checkout'
  | 'deli_meat'
  | 'pantry_canned'
  | 'pantry_dry'
  | 'dairy';
