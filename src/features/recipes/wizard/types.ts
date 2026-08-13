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
}

export interface IngredientComponentGroup {
  id: string;
  title: string;
  items: IngredientItem[];
}

export interface WizardStepItem {
  id: string;
  /** Gesetzt, nachdem der Schritt beim finalen Speichern (Seite 3) angelegt wurde. */
  serverId: string | null;
  text: string;
  localImageUri: string | null;
  existingImagePath: string | null;
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
  };
}

export function newWizardStep(): WizardStepItem {
  return {
    id: `step-${Date.now()}-${Math.random()}`,
    serverId: null,
    text: '',
    localImageUri: null,
    existingImagePath: null,
    ingredientIds: [],
  };
}
