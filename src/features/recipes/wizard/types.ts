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
  /** Gesetzt, nachdem die Zeile auf Seite 1 als recipe_component_items-Zeile persistiert wurde. */
  itemId: string | null;
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
  /** IngredientItem.itemId-Werte der in diesem Schritt referenzierten Zutaten. */
  ingredientIds: string[];
}

export function newIngredient(): IngredientItem {
  return {
    id: `ing-${Date.now()}-${Math.random()}`,
    product: null,
    productQuery: '',
    quantity: '',
    unit: 'g',
    itemId: null,
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
