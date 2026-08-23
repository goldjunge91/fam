import type { OpenFoodFactsProduct } from '@/lib/open-food-facts';

/** Uebergibt eine Produktauswahl einmalig an die zurueckkehrende Route. */
let pendingSelection: OpenFoodFactsProduct | null = null;

export function setPendingProductSelection(product: OpenFoodFactsProduct): void {
  pendingSelection = product;
}

export function consumePendingProductSelection(): OpenFoodFactsProduct | null {
  const product = pendingSelection;
  pendingSelection = null;
  return product;
}
