export type StorePreset = {
  name: string;
  color: string;
};

/**
 * Reine UI-Convenience fuer die "+ Neuer Markt"-Schnellauswahl. Kein
 * Schema-Bezug — Maerkte sind frei benennbar, das hier ist nur eine
 * Starthilfe fuer den deutschen Markt. Spaetere Laender-Presets sind nur
 * ein Array-Austausch.
 */
// Gedaempfte, erdige Toene statt roher Marken-Buntfarben (#E2001A,
// #00549F, #FFD100, ...) — die lagen weit ausserhalb der warmen Mauve-/
// Creme-Palette und wirkten wie ein Fremdkoerper neben Accent/Success/
// Warning/Danger aus theme.ts. Bleiben als Streifen erkennbar, ohne den
// Screen bunter zu machen als der Rest der App.
export const STORE_PRESETS: readonly StorePreset[] = [
  { name: 'REWE', color: '#B5623F' },
  { name: 'Aldi', color: '#5C7396' },
  { name: 'Lidl', color: '#C6A24A' },
  { name: 'Edeka', color: '#748C5B' },
  { name: 'Globus', color: '#4F8580' },
  { name: 'Marktkauf', color: '#A6483D' },
  { name: 'Netto', color: '#8B6B4A' },
  { name: 'Kaufland', color: '#A6483D' },
  { name: 'dm', color: '#8B6F72' },
];

/**
 * Frei waehlbare Farbpalette fuer einen Markt — unabhaengig von den
 * Namens-Presets oben. Ein Preset schlaegt nur den Namen vor, die Farbe
 * waehlt der Nutzer immer selbst aus dieser Palette.
 */
export const STORE_COLOR_PALETTE: readonly string[] = [
  '#B5623F',
  '#C08A4E',
  '#C6A24A',
  '#748C5B',
  '#4F8580',
  '#5C7396',
  '#8B6F72',
  '#A6483D',
  '#8B6B4A',
  '#7A7680',
];
