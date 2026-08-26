import type { OpenFoodFactsProduct } from '@/lib/open-food-facts';

let pendingSelection: OpenFoodFactsProduct | null = null;

export function setPendingProductSelection(product: OpenFoodFactsProduct): void {
  pendingSelection = product;
}

export function consumePendingProductSelection(): OpenFoodFactsProduct | null {
  const product = pendingSelection;
  pendingSelection = null;
  return product;
}
