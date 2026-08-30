import type { CatalogProduct } from '@/features/product-search/types';

/**
 * Rückgabewert über eine Navigations-Grenze hinweg, für die Expo Router keinen
 * nativen Mechanismus bietet: `add-product-screen` (Callee) setzt die Auswahl,
 * der aufrufende Screen (Caller, z. B. `add-item-screen`) konsumiert sie in
 * seinem `useFocusEffect`. Vertrag: genau ein Consumer konsumiert die Auswahl
 * genau einmal bei Fokus — danach ist der Wert gelöscht. Läge zwischen Callee
 * und Caller ein dritter Screen mit eigenem Focus-Handler auf denselben Wert,
 * würde dieser die Auswahl fälschlich konsumieren; aktuell unkritisch, da nur
 * ein Caller existiert. Ein künftiger zweiter Aufrufer (z. B. ein
 * shopping-list-Formular) entscheidet an dieser Stelle, ob er diesen Singleton
 * wiederverwendet oder einen eigenen, unabhängigen Singleton nach demselben
 * Muster anlegt.
 */
let pendingSelection: CatalogProduct | null = null;

export function setPendingProductSelection(product: CatalogProduct): void {
  pendingSelection = product;
}

export function consumePendingProductSelection(): CatalogProduct | null {
  const product = pendingSelection;
  pendingSelection = null;
  return product;
}
