import { CLASSIFIER_VERSION } from '../classification/classifier-version';
import { classifyCategory } from '../classification/shopping-category-classifier';
import type { ShoppingCategoryId } from '../classification/shopping-category-id';
import type { CategoryClassification, CategoryClassifierInput } from '../classification/types';

/** `categoryId: null` ist eine gelernte Sonstiges-Wahl, kein fehlender Treffer. */
export type CategoryPreferenceMatch = {
  categoryId: ShoppingCategoryId | null;
};

export type ResolveCategoryInput = CategoryClassifierInput & {
  productPreference?: CategoryPreferenceMatch | null;
  namePreference?: CategoryPreferenceMatch | null;
};

/** Produktpraeferenz vor Namenspraeferenz, danach automatische Klassifikation. */
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
