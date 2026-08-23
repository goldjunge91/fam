import { CLASSIFIER_VERSION } from '../classification/classifier-version';
import { classifyCategory } from '../classification/shopping-category-classifier';
import type { ShoppingCategoryId } from '../classification/shopping-category-id';
import type { CategoryClassification, CategoryClassifierInput } from '../classification/types';

/**
 * Bereits geladene Praeferenz-Treffer, wie sie `api.ts` lokal nachschlaegt.
 * `categoryId: null` ist eine bewusste, gelernte "Sonstiges"-Entscheidung und
 * unterscheidet sich von "keine Praeferenz gefunden" (kein Objekt / `undefined`
 * bzw. `null` als ganzer Wert von `productPreference`/`namePreference`).
 */
export type CategoryPreferenceMatch = {
  categoryId: ShoppingCategoryId | null;
};

export type ResolveCategoryInput = CategoryClassifierInput & {
  /** Praeferenz fuer die aktuelle `product_id`, sofern eine existiert. */
  productPreference?: CategoryPreferenceMatch | null;
  /** Praeferenz fuer den normalisierten Freitextnamen, sofern eine existiert. */
  namePreference?: CategoryPreferenceMatch | null;
};

/**
 * Schritte 1–3 der Auflösungsreihenfolge aus `docs/issue#223_V2.md` Abschnitt
 * 3 (manuelle Formular-Auswahl liegt bewusst außerhalb — die trifft der
 * Aufrufer selbst, siehe `types.ts`s `CategorySource`-Kommentar): Produkt-
 * vor Namenspräferenz, erst danach die automatische Klassifikation aus
 * `classification/` (Schritte 4–6). Rein — keine Datenbank, kein Netzwerk;
 * `api.ts` laedt `productPreference`/`namePreference` vorher lokal.
 */
export function resolveCategory(input: ResolveCategoryInput): CategoryClassification {
  const preferenceMatch = input.productPreference ?? input.namePreference;
  if (preferenceMatch) {
    return {
      categoryId: preferenceMatch.categoryId,
      source: 'household_preference',
      classifierVersion: CLASSIFIER_VERSION,
    };
  }

  return classifyCategory(input);
}
