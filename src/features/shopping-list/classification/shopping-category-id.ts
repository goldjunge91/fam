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
  | 'deli_meat'
  | 'pantry_canned'
  | 'pantry_dry'
  | 'breakfast'
  | 'snacks'
  | 'beverages'
  | 'dairy'
  | 'frozen'
  | 'drugstore'
  | 'checkout';
