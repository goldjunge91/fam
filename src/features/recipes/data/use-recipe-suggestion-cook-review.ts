import { useMutation, useQueryClient } from '@tanstack/react-query';

import { trackAnalyticsEvent } from '@/lib/analytics';
import { applyInventoryConsumptionPlan } from '@/features/inventory/apply-inventory-consumption';
import {
  buildRecipeSuggestionConsumptionPlan,
  type RecipeSuggestionCookReview,
  type RecipeSuggestionConsumptionPlanResult,
  type RecipeSuggestionInventorySnapshot,
} from '../domain/recipe-suggestion-cook-review';

export type ApplyRecipeSuggestionCookReviewInput = {
  householdId: string;
  review: RecipeSuggestionCookReview;
  inventory: readonly RecipeSuggestionInventorySnapshot[];
};

export class RecipeSuggestionCookReviewError extends Error {
  constructor(readonly result: Extract<RecipeSuggestionConsumptionPlanResult, { ok: false }>) {
    super('recipe_suggestion_cook_review_invalid');
    this.name = 'RecipeSuggestionCookReviewError';
  }
}

/** Executes only a confirmed review; recipe display and review creation stay read-only. */
export function useApplyRecipeSuggestionCookReviewMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: ApplyRecipeSuggestionCookReviewInput) => {
      const plan = buildRecipeSuggestionConsumptionPlan(input.review, input.inventory);
      if (!plan.ok) throw new RecipeSuggestionCookReviewError(plan);

      const applied = await applyInventoryConsumptionPlan(plan.value);
      return { applied, reviewedItemCount: input.review.entries.length };
    },
    onSuccess: (result, variables) => {
      trackAnalyticsEvent('meal_suggestion.cook_review.completed', {
        reviewed_item_count: result.reviewedItemCount,
        consumed_item_count: result.applied.length,
        consumed_quantity_known: result.applied.every(
          (item) => item.outcomeTelemetry.quantity_known,
        ),
      });
      queryClient.invalidateQueries({ queryKey: ['fridge_items', variables.householdId] });
      queryClient.invalidateQueries({
        queryKey: ['fridge_items_grouped', variables.householdId],
      });
      queryClient.invalidateQueries({ queryKey: ['sync-status'] });
    },
  });
}
