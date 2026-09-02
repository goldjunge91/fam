import type { PerishableInventoryContext } from '@/features/ai-agent-skills/domain/contracts';
import {
  type CookingSuggestionForValidation,
  validateCookingSuggestionInventory,
  validateCookingSuggestionReferences,
} from '@/features/ai-agent-skills/domain/cooking-validation';

const CONTEXT: PerishableInventoryContext = {
  source: 'inventory',
  fetchedAt: '2026-09-01T10:00:00.000Z',
  lots: [
    {
      lotId: 'lot-spinach',
      productId: 'product-spinach',
      normalizedName: 'Spinat',
      quantity: 1,
      unit: 'package',
      bestBefore: '2026-09-03',
      useBy: null,
      storage: 'fridge',
    },
  ],
};

const suggestion = (usedLots: string[]): CookingSuggestionForValidation => ({
  kind: 'cooking_suggestion.v1',
  recipeId: 'recipe-1',
  title: 'Spinat-Pasta',
  usedLots,
  missingIngredients: [],
  estimatedMinutes: 20,
  servings: 2,
  rationale: 'Verbraucht den Spinat zuerst.',
  constraintChecks: { allergies: 'pass', dietaryPattern: 'pass', time: 'pass' },
});

describe('validateCookingSuggestionInventory', () => {
  it('accepts only lot references from the gateway context', () => {
    expect(validateCookingSuggestionInventory(suggestion(['lot-spinach']), CONTEXT)).toEqual({
      valid: true,
      errors: [],
    });
  });

  it('rejects a model-invented lot reference', () => {
    expect(validateCookingSuggestionInventory(suggestion(['lot-invented']), CONTEXT)).toEqual({
      valid: false,
      errors: ['usedLots enthält eine nicht gelesene Inventar-Lot-ID: lot-invented'],
    });
  });

  it('rejects duplicate lot references instead of double-counting inventory', () => {
    expect(
      validateCookingSuggestionInventory(suggestion(['lot-spinach', 'lot-spinach']), CONTEXT),
    ).toEqual({
      valid: false,
      errors: ['usedLots enthält eine doppelte Inventar-Lot-ID: lot-spinach'],
    });
  });

  it('rejects unknown recipe references and more than three suggestions', () => {
    const suggestions = Array.from({ length: 4 }, (_, index) => ({
      ...suggestion([]),
      recipeId: index === 0 ? 'recipe-missing' : `recipe-${index}`,
    }));

    const result = validateCookingSuggestionReferences(
      suggestions,
      CONTEXT,
      new Set(['recipe-1', 'recipe-2', 'recipe-3']),
    );

    expect(result.valid).toBe(false);
    expect(result.errors).toEqual([
      'recipeId ist nicht in der freigegebenen Rezeptbasis: recipe-missing',
      'Die Ausgabe darf höchstens 3 Kochvorschläge enthalten.',
    ]);
  });
});
