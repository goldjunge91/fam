import type { ShoppingCategoryId } from '../classification/shopping-category-id';
import type { CategorySource } from '../classification/types';

/**
 * Formular-interner Kategoriezustand (#223 Paket 8, Abschnitt 10
 * "Hinzufügen"/"Bearbeiten") — bündelt Kategorie, Herkunft und
 * Klassifikator-Version, die gemeinsam auf einen `shopping_list_items`-
 * Eintrag geschrieben werden. Anders als `CategoryClassification`
 * (`classification/types.ts`) darf `source` hier `'user'` sein: das ist die
 * einzige Herkunft, die niemals aus `resolveCategoryForItem()` kommt,
 * sondern ausschließlich aus einer manuellen Auswahl im Formular selbst.
 */
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
