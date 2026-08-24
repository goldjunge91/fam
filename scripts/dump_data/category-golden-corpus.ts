/**
 * Golden-Korpus für die Kategorie-Klassifikation (#223 Paket 1, Abschnitt 15
 * in `docs/issue#223_V2.md`). Jeder Eintrag hat ein per Hand geprüftes
 * Soll-Ergebnis — `evaluate-categories.ts` vergleicht es gegen die
 * tatsächliche Ausgabe von `classifyCategory()` und meldet jede Abweichung
 * als Regression.
 *
 * Die ersten Einträge sind die bekannten Kollisionsfälle aus
 * `shopping-category-classifier.test.ts` (dieselben Namen, dieselben
 * erwarteten Kategorien) — sie sind der Grund, warum #223 überhaupt existiert
 * (Substring-Fehlmatches wie "Schwein" → "Getränke" wegen "Wein"), deshalb
 * hier bewusst dupliziert statt nur indirekt über Unit-Tests abgedeckt.
 * Danach je 2–3 zusätzliche, alltägliche Artikel pro Kategorie.
 */

import type { StoredPlacementZoneId } from '@/features/shopping-list/classification/placement-taxonomy';

export type GoldenCorpusEntry = {
  name: string;
  categoryTags?: string[];
  expected: StoredPlacementZoneId | null;
  /** Warum genau dieser Fall drin ist — v.a. bei Kollisionsfällen. */
  note?: string;
};

export const CATEGORY_GOLDEN_CORPUS: readonly GoldenCorpusEntry[] = [
  // --- Bekannte Kollisionsfälle (Kern von #223) ---
  {
    name: '2 Schnitzel vom Schwein Spar Fein Küche',
    expected: 'meat_poultry',
    note: '"wein" ist Teilstring von "Schwein" — darf nicht als Getränke matchen',
  },
  { name: 'Schwein', expected: 'meat_poultry', note: 'Ganzwort' },
  { name: 'Schweinefilet', expected: 'meat_poultry', note: 'Wortanfang' },
  { name: 'Wein', expected: 'beverages', note: 'Ganzwort, echtes Getränk' },
  {
    name: 'Apfelsaft',
    expected: 'beverages',
    note: 'Grundwort "saft" schlägt Modifier "apfel" (sonst produce)',
  },
  { name: 'Weinessig', expected: 'cooking_baking', note: '"Wein"-Präfix, aber kein Getränk' },
  {
    name: 'Weinstein-Backpulver',
    expected: 'cooking_baking',
    note: '"Wein"-Präfix im ersten Token, trotzdem Koch-/Backzutat',
  },
  { name: 'Vollmilch', expected: 'dairy_eggs' },
  { name: 'Vollkornbrot', expected: 'bakery', note: 'Grundwort "brot"' },
  { name: 'Hähnchenbrust', expected: 'meat_poultry', note: 'Wortanfang, Umlaut' },
  { name: 'Tiefkühlpizza', expected: 'frozen', note: 'expliziter Tiefkühl-Marker' },
  {
    name: 'Edeka Brombeeren Tiefgefroren',
    categoryTags: [
      'en:plant-based-foods-and-beverages',
      'en:plant-based-foods',
      'en:fruits-and-vegetables-based-foods',
      'en:fruits-based-foods',
      'en:fruits',
      'en:berries',
      'en:blackberries',
    ],
    expected: 'frozen',
    note: 'Tiefgefroren-Marker im Namen schlägt generische Frucht-OFF-Tags',
  },
  {
    name: 'dmBio Apfelmark',
    categoryTags: [
      'en:plant-based-foods-and-beverages',
      'en:plant-based-foods',
      'en:fruits-and-vegetables-based-foods',
      'en:desserts',
      'en:fruits-based-foods',
      'en:compotes',
      'en:apple-compotes',
      'en:applesauces',
    ],
    expected: 'canned_sauces',
    note: 'Kompott-/Mus-Tags und -Grundwort gehören zu Konserven, nicht Obst & Gemüse',
  },
  {
    name: 'Gemischter Salat (eingelegt)',
    expected: 'canned_sauces',
    note: 'eingelegt schlägt Grundwort salat',
  },

  // --- Je Kategorie ein paar zusätzliche Alltagsartikel ---
  { name: 'Apfel', expected: 'produce' },
  { name: 'Tomate', expected: 'produce' },
  { name: 'Brötchen', expected: 'bakery' },
  { name: 'Toastbrot', expected: 'bakery' },
  { name: 'Hackfleisch', expected: 'meat_poultry' },
  { name: 'Salami', expected: 'deli_cold_cuts' },
  { name: 'Ketchup', expected: 'canned_sauces' },
  { name: 'Senf', expected: 'canned_sauces' },
  { name: 'Nudeln', expected: 'pantry_staples' },
  { name: 'Reis', expected: 'pantry_staples' },
  { name: 'Müsli', expected: 'breakfast' },
  { name: 'Marmelade', expected: 'breakfast' },
  { name: 'Schokolade', expected: 'snacks' },
  { name: 'Chips', expected: 'snacks' },
  { name: 'Mineralwasser', expected: 'beverages' },
  { name: 'Orangensaft', expected: 'beverages' },
  { name: 'Joghurt', expected: 'dairy_eggs' },
  { name: 'Butter', expected: 'dairy_eggs' },
  { name: 'Eiscreme', expected: 'frozen' },
  { name: 'Tiefkühlgemüse', expected: 'frozen' },
  { name: 'Duschgel', expected: 'drugstore' },
  { name: 'Zahnpasta', expected: 'drugstore' },
  { name: 'Kaugummi', expected: 'checkout' },
  { name: 'Batterie', expected: 'checkout' },

  // --- OFF-Tag-gestützte Fälle ---
  {
    name: '2 Schnitzel vom Schwein Spar Fein Küche',
    categoryTags: ['en:porks'],
    expected: 'meat_poultry',
    note: 'OFF-Tag gewinnt vor Namens-Fallback',
  },
  {
    name: 'Fruchtsaft mit Gemüseanteil',
    categoryTags: ['en:vegetables', 'en:fruit-juices'],
    expected: 'beverages',
    note: 'spezifischerer Tag (fruit-juices) gewinnt vor allgemeinem (vegetables)',
  },
] as const;
