import type { ShoppingCategoryId } from '../classification/shopping-category-id';
import type { CategorySource } from '../classification/types';

export type CategoryFormState = {
  categoryId: ShoppingCategoryId | null;
  source: CategorySource | null;
  classifierVersion: string | null;
};

export const EMPTY_CATEGORY_STATE: CategoryFormState = {
  categoryId: null,
  source: null,
  classifierVersion: null,
};

/** Formularzustand `automatic`/`manual` aus Abschnitt 10 — leitet sich rein aus `source` ab. */
export function isManualCategory(source: CategorySource | null): boolean {
  return source === 'user';
}
