import type { RecipeSuggestionMeal, RecipeSuggestionResponse } from './recipe-suggestions';

export type RecipeSuggestionReviewStatus = 'pending_confirmation' | 'confirmed';

export type RecipeSuggestionDisplayMeal = {
  title: string;
  source: RecipeSuggestionMeal['source'];
  sourceLabel: 'Aus Katalog' | 'Aus Vorlage' | 'Neu formuliert';
  recipeId: string | null;
  servings: number;
  usedItems: RecipeSuggestionMeal['used_items'];
  additionalIngredients: string[];
  steps: string[];
  notes: string[];
};

export type RecipeSuggestionReview = {
  status: RecipeSuggestionReviewStatus;
  meals: RecipeSuggestionDisplayMeal[];
};

function sourceLabel(
  source: RecipeSuggestionMeal['source'],
): RecipeSuggestionDisplayMeal['sourceLabel'] {
  switch (source) {
    case 'catalog':
      return 'Aus Katalog';
    case 'template':
      return 'Aus Vorlage';
    case 'model_generated':
      return 'Neu formuliert';
  }
}

export function createRecipeSuggestionReview(
  response: RecipeSuggestionResponse,
): RecipeSuggestionReview {
  return {
    status: 'pending_confirmation',
    meals: response.meals.map((meal) => ({
      title: meal.title,
      source: meal.source,
      sourceLabel: sourceLabel(meal.source),
      recipeId: meal.recipe_id,
      servings: meal.servings,
      usedItems: meal.used_items,
      additionalIngredients: meal.additional_ingredients,
      steps: meal.steps,
      notes: meal.notes,
    })),
  };
}

export function confirmRecipeSuggestion(review: RecipeSuggestionReview): RecipeSuggestionReview {
  return { ...review, status: 'confirmed' };
}

export function canApplyRecipeSuggestion(review: RecipeSuggestionReview): boolean {
  return review.status === 'confirmed';
}
