import {
  canApplyRecipeSuggestion,
  confirmRecipeSuggestion,
  createRecipeSuggestionReview,
} from './recipe-suggestion-review';

const response = {
  schema_version: 1 as const,
  meals: [
    {
      title: 'Tomatenpfanne',
      source: 'catalog' as const,
      recipe_id: 'catalog-tomato-pan',
      servings: 2,
      used_items: [{ inventory_item_id: 'inventory-tomatoes', quantity: 2, unit: 'piece' }],
      additional_ingredients: [],
      steps: ['Tomaten garen.'],
      notes: [],
    },
    {
      title: 'Spinat-Reis',
      source: 'model_generated' as const,
      recipe_id: null,
      servings: 2,
      used_items: [{ inventory_item_id: 'inventory-spinach', quantity: 200, unit: 'g' }],
      additional_ingredients: ['Salz'],
      steps: ['Spinat und Reis garen.'],
      notes: ['Vorschlag ohne Katalogrezept.'],
    },
  ],
};

describe('recipe suggestion review', () => {
  it('maps provenance for display and starts unconfirmed', () => {
    const review = createRecipeSuggestionReview(response);

    expect(review.status).toBe('pending_confirmation');
    expect(review.meals.map((meal) => meal.sourceLabel)).toEqual(['Aus Katalog', 'Neu formuliert']);
    expect(review.meals[1]).toMatchObject({ recipeId: null, additionalIngredients: ['Salz'] });
    expect(canApplyRecipeSuggestion(review)).toBe(false);
  });

  it('requires explicit confirmation before an applying caller may mutate', () => {
    const confirmed = confirmRecipeSuggestion(createRecipeSuggestionReview(response));

    expect(confirmed.status).toBe('confirmed');
    expect(canApplyRecipeSuggestion(confirmed)).toBe(true);
  });
});
