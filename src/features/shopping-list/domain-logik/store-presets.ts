import { shoppingListColors } from '@/components/theme/index';

export type StorePreset = {
  name: string;
  color: string;
};

/**
 * Domain-Owner: Store-Presets.
 *
 * Presetfarben und gespeicherte `store.color`-Werte gehören zur Markt- und
 * Haushaltsdomäne. Sie werden als Streifen, Punkte und Auswahlmarkierungen
 * dargestellt, aber nicht als globale Theme-Flächen oder Textfarben verwendet.
 */
// Gedaempfte, erdige Toene statt roher Marken-Buntfarben — die liegen
// ausserhalb der warmen Mauve-/Creme-Palette und bleiben als Streifen
// erkennbar, ohne den Screen bunter zu machen als der Rest der App.
export const STORE_PRESETS: readonly StorePreset[] = [
  { name: 'REWE', color: shoppingListColors.stores.rewe },
  { name: 'Aldi', color: shoppingListColors.stores.aldi },
  { name: 'Lidl', color: shoppingListColors.stores.lidl },
  { name: 'Edeka', color: shoppingListColors.stores.edeka },
  { name: 'Globus', color: shoppingListColors.stores.globus },
  { name: 'Marktkauf', color: shoppingListColors.stores.marktkauf },
  { name: 'Netto', color: shoppingListColors.stores.netto },
  { name: 'Kaufland', color: shoppingListColors.stores.kaufland },
  { name: 'dm', color: shoppingListColors.stores.dm },
];

export const STORE_COLOR_PALETTE = shoppingListColors.storePalette;
