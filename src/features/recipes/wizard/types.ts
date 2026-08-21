import type { OpenFoodFactsProduct } from '@/lib/open-food-facts';

/**
 * Geteilte Formular-Typen des Rezept-Wizards (Seite 1-3). Der State selbst
 * lebt in `recipe-create-screen.tsx`, die drei Seiten sind reine
 * Props-gesteuerte Unterkomponenten.
 */

export interface IngredientItem {
  id: string;
  product: OpenFoodFactsProduct | null;
  productQuery: string;
  /** Rohe Nutzereingabe, siehe recipe_component_items.quantity. */
  quantity: string;
  unit: string;
  /** true, wenn quantity/unit ohne bekanntes Produkt-Stueckgewicht nicht in Gramm umrechenbar war. */
  notConvertible: boolean;
  /**
   * `recipe_component_items.id`, wenn diese Zeile beim Bearbeiten aus einem
   * bestehenden Rezept geladen wurde — null bei einer neu hinzugefuegten
   * Zutat. Steuert beim Speichern, ob update (Menge/Einheit geaendert) oder
   * insert (neu) laeuft, siehe recipe-create-screen.tsx.
   */
  existingItemId: string | null;
  /**
   * `products.id` der bereits aufgeloesten Zutat, wenn aus einem bestehenden
   * Rezept geladen — spart beim Speichern den OFF-Suche/Anlegen-Umweg
   * (persistOffProductIfNeeded), solange der Nutzer keine neue Suche
   * gestartet hat (siehe `product`, das dann Vorrang hat).
   */
  existingProductId: string | null;
}

export interface IngredientComponentGroup {
  id: string;
  title: string;
  items: IngredientItem[];
  /** `recipe_components.id`, wenn beim Bearbeiten aus einem bestehenden Rezept geladen. */
  existingComponentId: string | null;
}

export interface WizardStepItem {
  id: string;
  /** Gesetzt, nachdem der Schritt beim finalen Speichern (Seite 3) angelegt wurde. */
  serverId: string | null;
  text: string;
  localImageUri: string | null;
  existingImagePath: string | null;
  /** Optionaler, explizit gesetzter Kochmodus-Timer in Minuten. */
  timerMinutes: number | null;
  /**
   * IngredientItem.id-Werte (lokale Client-IDs, nicht recipe_component_items.id)
   * der in diesem Schritt referenzierten Zutaten — solange nicht final
   * gespeichert wurde, gibt es noch keine DB-Zeile dafuer. Wird beim
   * Speichern in echte item-IDs uebersetzt, siehe recipe-create-screen.tsx.
   */
  ingredientIds: string[];
}

export function newIngredient(): IngredientItem {
  return {
    id: `ing-${Date.now()}-${Math.random()}`,
    product: null,
    productQuery: '',
    quantity: '',
    unit: 'g',
    notConvertible: false,
    existingItemId: null,
    existingProductId: null,
  };
}

export function newWizardStep(): WizardStepItem {
  return {
    id: `step-${Date.now()}-${Math.random()}`,
    serverId: null,
    text: '',
    localImageUri: null,
    existingImagePath: null,
    timerMinutes: null,
    ingredientIds: [],
  };
}
