import type { CookingSuggestion, PerishableInventoryContext } from './contracts';

export type CookingSuggestionForValidation = CookingSuggestion;

export type CookingSuggestionValidation = {
  valid: boolean;
  errors: string[];
};

/** Ensures a model can only claim inventory lots that the gateway supplied. */
export function validateCookingSuggestionInventory(
  suggestion: CookingSuggestionForValidation,
  context: PerishableInventoryContext,
): CookingSuggestionValidation {
  const availableLotIds = new Set(context.lots.map((lot) => lot.lotId));
  const seenLotIds = new Set<string>();
  const errors: string[] = [];

  for (const lotId of suggestion.usedLots) {
    if (!availableLotIds.has(lotId)) {
      errors.push(`usedLots enthält eine nicht gelesene Inventar-Lot-ID: ${lotId}`);
      continue;
    }
    if (seenLotIds.has(lotId)) {
      errors.push(`usedLots enthält eine doppelte Inventar-Lot-ID: ${lotId}`);
      continue;
    }
    seenLotIds.add(lotId);
  }

  return { valid: errors.length === 0, errors };
}

/** Validates recipe references and the hard top-three output bound. */
export function validateCookingSuggestionReferences(
  suggestions: readonly CookingSuggestion[],
  context: PerishableInventoryContext,
  recipeIds: ReadonlySet<string>,
  maxSuggestions = 3,
): CookingSuggestionValidation {
  const errors = suggestions.flatMap((suggestion) => {
    const referenceErrors = recipeIds.has(suggestion.recipeId)
      ? []
      : [`recipeId ist nicht in der freigegebenen Rezeptbasis: ${suggestion.recipeId}`];
    const inventoryErrors = validateCookingSuggestionInventory(suggestion, context).errors;
    return [...referenceErrors, ...inventoryErrors];
  });

  if (suggestions.length > maxSuggestions) {
    errors.push(`Die Ausgabe darf höchstens ${maxSuggestions} Kochvorschläge enthalten.`);
  }

  return { valid: errors.length === 0, errors };
}
