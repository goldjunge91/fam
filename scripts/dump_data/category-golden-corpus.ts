/** Handgepruefte Soll-Ergebnisse einschliesslich bekannter Substring-Kollisionen. */

import type { ShoppingCategoryId } from '@/features/shopping-list/classification/shopping-category-id';

export type GoldenCorpusEntry = {
  name: string;
  categoryTags?: string[];
  expected: ShoppingCategoryId | null;
  note?: string;
};

export const CATEGORY_GOLDEN_CORPUS: readonly GoldenCorpusEntry[] = [
  {
    name: '2 Schnitzel vom Schwein Spar Fein Küche',
    expected: 'deli_meat',
    note: '"wein" ist Teilstring von "Schwein" — darf nicht als Getränke matchen',
  },
  { name: 'Schwein', expected: 'deli_meat', note: 'Ganzwort' },
  { name: 'Schweinefilet', expected: 'deli_meat', note: 'Wortanfang' },
  { name: 'Wein', expected: 'beverages', note: 'Ganzwort, echtes Getränk' },
  {
    name: 'Apfelsaft',
    expected: 'beverages',
    note: 'Grundwort "saft" schlägt Modifier "apfel" (sonst produce)',
  },
  { name: 'Weinessig', expected: 'pantry_dry', note: '"Wein"-Präfix, aber kein Getränk' },
  {
    name: 'Weinstein-Backpulver',
    expected: 'pantry_dry',
    note: '"Wein"-Präfix im ersten Token, trotzdem Grundnahrungsmittel',
  },
  { name: 'Vollmilch', expected: 'dairy' },
  { name: 'Vollkornbrot', expected: 'bakery', note: 'Grundwort "brot"' },
  { name: 'Hähnchenbrust', expected: 'deli_meat', note: 'Wortanfang, Umlaut' },
  { name: 'Tiefkühlpizza', expected: 'frozen', note: 'expliziter Tiefkühl-Marker' },

  { name: 'Apfel', expected: 'produce' },
  { name: 'Tomate', expected: 'produce' },
  { name: 'Brötchen', expected: 'bakery' },
  { name: 'Toastbrot', expected: 'bakery' },
  { name: 'Hackfleisch', expected: 'deli_meat' },
  { name: 'Salami', expected: 'deli_meat' },
  { name: 'Ketchup', expected: 'pantry_canned' },
  { name: 'Senf', expected: 'pantry_canned' },
  { name: 'Nudeln', expected: 'pantry_dry' },
  { name: 'Reis', expected: 'pantry_dry' },
  { name: 'Müsli', expected: 'breakfast' },
  { name: 'Marmelade', expected: 'breakfast' },
  { name: 'Schokolade', expected: 'snacks' },
  { name: 'Chips', expected: 'snacks' },
  { name: 'Mineralwasser', expected: 'beverages' },
  { name: 'Orangensaft', expected: 'beverages' },
  { name: 'Joghurt', expected: 'dairy' },
  { name: 'Butter', expected: 'dairy' },
  { name: 'Eiscreme', expected: 'frozen' },
  { name: 'Tiefkühlgemüse', expected: 'frozen' },
  { name: 'Duschgel', expected: 'drugstore' },
  { name: 'Zahnpasta', expected: 'drugstore' },
  { name: 'Kaugummi', expected: 'checkout' },
  { name: 'Batterie', expected: 'checkout' },

  {
    name: '2 Schnitzel vom Schwein Spar Fein Küche',
    categoryTags: ['en:porks'],
    expected: 'deli_meat',
    note: 'OFF-Tag gewinnt vor Namens-Fallback',
  },
  {
    name: 'Fruchtsaft mit Gemüseanteil',
    categoryTags: ['en:vegetables', 'en:fruit-juices'],
    expected: 'beverages',
    note: 'spezifischerer Tag (fruit-juices) gewinnt vor allgemeinem (vegetables)',
  },
] as const;
