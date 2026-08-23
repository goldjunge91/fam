import type { OpenFoodFactsProduct } from '@/lib/open-food-facts';

export interface IngredientItem {
  id: string;
  product: OpenFoodFactsProduct | null;
  productQuery: string;
  /** Rohe Nutzereingabe, siehe recipe_component_items.quantity. */
  quantity: string;
  unit: string;
  /** true, wenn quantity/unit ohne bekanntes Produkt-Stueckgewicht nicht in Gramm umrechenbar war. */
  notConvertible: boolean;
  /** Bestehende DB-ID fuer Update statt Insert. */
  existingItemId: string | null;
  /** Bereits aufgeloeste Produkt-ID; eine neue Auswahl hat Vorrang. */
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
  /** Lokale Zutaten-IDs, die beim Speichern in DB-IDs uebersetzt werden. */
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
