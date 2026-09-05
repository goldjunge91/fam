import {
  buildRecipeSuggestionConsumptionPlan,
  canApplyRecipeSuggestionCookReview,
  confirmRecipeSuggestionCookReview,
  createRecipeSuggestionCookReview,
  updateRecipeSuggestionCookReviewEntry,
} from './recipe-suggestion-cook-review';
import { createRecipeSuggestionReview } from './recipe-suggestion-review';

const suggestionReview = createRecipeSuggestionReview({
  schema_version: 1,
  meals: [
    {
      title: 'Kartoffel-Spinat-Pfanne',
      source: 'catalog',
      recipe_id: 'catalog-potato-spinach',
      servings: 2,
      used_items: [
        { inventory_item_id: 'inventory-potatoes', quantity: 1, unit: 'kg' },
        { inventory_item_id: 'inventory-spinach', quantity: 200, unit: 'g' },
      ],
      additional_ingredients: [],
      steps: ['Garen.'],
      notes: [],
    },
  ],
});

describe('recipe suggestion cook review', () => {
  it('selects one meal and starts pending without changing inventory', () => {
    const review = createRecipeSuggestionCookReview(suggestionReview, 0);

    expect(review).toMatchObject({
      status: 'pending_confirmation',
      meal: { title: 'Kartoffel-Spinat-Pfanne' },
      entries: [
        { inventoryItemId: 'inventory-potatoes', included: true },
        { inventoryItemId: 'inventory-spinach', included: true },
      ],
    });
    expect(createRecipeSuggestionCookReview(suggestionReview, 1)).toBeNull();
  });

  it('invalidates confirmation after an edit or deselection', () => {
    const review = createRecipeSuggestionCookReview(suggestionReview, 0);
    if (review === null) throw new Error('expected review');

    const confirmed = confirmRecipeSuggestionCookReview(review);
    expect(canApplyRecipeSuggestionCookReview(confirmed)).toBe(true);

    const edited = updateRecipeSuggestionCookReviewEntry(confirmed, 'inventory-spinach', {
      quantity: 100,
      included: false,
    });
    expect(edited.status).toBe('pending_confirmation');
    expect(edited.entries[1]).toMatchObject({ quantity: 100, included: false });
    expect(canApplyRecipeSuggestionCookReview(edited)).toBe(false);
  });

  it('converts reviewed quantities into the authoritative inventory unit', () => {
    const review = createRecipeSuggestionCookReview(suggestionReview, 0);
    if (review === null) throw new Error('expected review');

    const result = buildRecipeSuggestionConsumptionPlan(
      confirmRecipeSuggestionCookReview(review),
      [
        { id: 'inventory-potatoes', householdId: 'household-1', quantity: 2, unit: 'kg' },
        { id: 'inventory-spinach', householdId: 'household-1', quantity: 500, unit: 'g' },
      ],
    );

    expect(result).toEqual({
      ok: true,
      value: [
        {
          id: 'inventory-potatoes',
          household_id: 'household-1',
          delta: -1,
          operation: 'consume',
        },
        {
          id: 'inventory-spinach',
          household_id: 'household-1',
          delta: -200,
          operation: 'consume',
        },
      ],
    });
  });

  it('fails closed for missing and incompatible inventory', () => {
    const review = createRecipeSuggestionCookReview(suggestionReview, 0);
    if (review === null) throw new Error('expected review');
    const confirmed = confirmRecipeSuggestionCookReview(review);

    const result = buildRecipeSuggestionConsumptionPlan(confirmed, [
      { id: 'inventory-potatoes', householdId: 'household-1', quantity: 1, unit: 'piece' },
    ]);

    expect(result).toMatchObject({
      ok: false,
      issues: [
        { code: 'incompatible_unit', inventoryItemId: 'inventory-potatoes' },
        { code: 'inventory_item_missing', inventoryItemId: 'inventory-spinach' },
      ],
    });
  });

  it('rejects a confirmed review that exceeds the current quantity', () => {
    const review = createRecipeSuggestionCookReview(suggestionReview, 0);
    if (review === null) throw new Error('expected review');

    const result = buildRecipeSuggestionConsumptionPlan(
      confirmRecipeSuggestionCookReview(review),
      [
        { id: 'inventory-potatoes', householdId: 'household-1', quantity: 0.5, unit: 'kg' },
        { id: 'inventory-spinach', householdId: 'household-1', quantity: 500, unit: 'g' },
      ],
    );

    expect(result).toMatchObject({
      ok: false,
      issues: [{ code: 'quantity_exceeds_available', inventoryItemId: 'inventory-potatoes' }],
    });
  });

  it('does not create a plan before the final confirmation', () => {
    const review = createRecipeSuggestionCookReview(suggestionReview, 0);
    if (review === null) throw new Error('expected review');

    expect(
      buildRecipeSuggestionConsumptionPlan(review, [
        { id: 'inventory-potatoes', householdId: 'household-1', quantity: 2, unit: 'kg' },
      ]),
    ).toEqual({ ok: false, issues: [{ code: 'not_confirmed' }] });
  });
});
