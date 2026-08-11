import type { OpenFoodFactsProduct } from '@/lib/open-food-facts';

/**
 * Uebertraegt ein frisch angelegtes Produkt (#80) von `add-product-screen`
 * zurueck zur aufrufenden Stelle (z.B. `add-item-screen`), ohne eine globale
 * Navigations-Param-Rueckgabe zu brauchen — Expo Router kennt keine.
 * Aufrufende Screens lesen den Wert per `useFocusEffect` beim Zurueckkommen
 * und konsumieren ihn dabei (einmalig, kein Replay bei erneutem Fokus).
 */
let pendingSelection: OpenFoodFactsProduct | null = null;

export function setPendingProductSelection(product: OpenFoodFactsProduct): void {
  pendingSelection = product;
}

export function consumePendingProductSelection(): OpenFoodFactsProduct | null {
  const product = pendingSelection;
  pendingSelection = null;
  return product;
}
