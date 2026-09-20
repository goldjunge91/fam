import type { BetaPreviewItem } from '../types';

export const CLARIFICATION_UNCERTAINTY_THRESHOLD = 0.3;
export const MIN_SUGGESTED_UNCLEAR_ITEMS = 3;

export type ClarificationSummary = {
  itemCount: number;
  unclearItemCount: number;
  suggestedUnclearItemCount: number;
  uncertaintyRatio: number;
  shouldBundle: boolean;
};

export function getClarificationSummary(items: readonly BetaPreviewItem[]): ClarificationSummary {
  const unclearItems = items.filter((item) => item.routing.needsClarification);
  const suggestedUnclearItemCount = unclearItems.filter(
    (item) => item.routing.suggestions.length > 0,
  ).length;
  const uncertaintyRatio = items.length === 0 ? 0 : unclearItems.length / items.length;

  return {
    itemCount: items.length,
    unclearItemCount: unclearItems.length,
    suggestedUnclearItemCount,
    uncertaintyRatio,
    shouldBundle:
      items.length > 2 &&
      uncertaintyRatio >= CLARIFICATION_UNCERTAINTY_THRESHOLD &&
      suggestedUnclearItemCount >= MIN_SUGGESTED_UNCLEAR_ITEMS,
  };
}

export function shouldBundleClarification(items: readonly BetaPreviewItem[]): boolean {
  return getClarificationSummary(items).shouldBundle;
}
