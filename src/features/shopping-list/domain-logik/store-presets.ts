export type StorePreset = {
  name: string;
  color: string;
};

const STORE_COLORS = {
  rewe: '#B5623F',
  aldi: '#5C7396',
  lidl: '#C6A24A',
  edeka: '#748C5B',
  globus: '#4F8580',
  marketRed: '#A6483D',
  netto: '#8B6B4A',
  dm: '#8B6F72',
  paletteAmber: '#C08A4E',
  paletteNeutral: '#7A7680',
} as const;

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
  { name: 'REWE', color: STORE_COLORS.rewe },
  { name: 'Aldi', color: STORE_COLORS.aldi },
  { name: 'Lidl', color: STORE_COLORS.lidl },
  { name: 'Edeka', color: STORE_COLORS.edeka },
  { name: 'Globus', color: STORE_COLORS.globus },
  { name: 'Marktkauf', color: STORE_COLORS.marketRed },
  { name: 'Netto', color: STORE_COLORS.netto },
  { name: 'Kaufland', color: STORE_COLORS.marketRed },
  { name: 'dm', color: STORE_COLORS.dm },
];

export const STORE_COLOR_PALETTE = [
  STORE_COLORS.rewe,
  STORE_COLORS.paletteAmber,
  STORE_COLORS.lidl,
  STORE_COLORS.edeka,
  STORE_COLORS.globus,
  STORE_COLORS.aldi,
  STORE_COLORS.dm,
  STORE_COLORS.marketRed,
  STORE_COLORS.netto,
  STORE_COLORS.paletteNeutral,
] as const;
