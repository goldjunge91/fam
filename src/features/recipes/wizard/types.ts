import type { CatalogProduct } from '@/features/product-search/types';

export interface IngredientItem {
  id: string;
  product: CatalogProduct | null;
  productQuery: string;
  /** Rohe Nutzereingabe, siehe recipe_component_items.quantity. */
  quantity: string;
  unit: string;
  /** `true`, wenn die Menge nicht in Gramm umgerechnet werden konnte. */
  notConvertible: boolean;

  existingItemId: string | null;

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
