export type StorePreset = {
  name: string;
  color: string;
};

/** Frei benennbare Maerkte; diese Presets sind nur eine Schnellauswahl. */
// Gedaempfte Markenfarben halten die Streifen in der warmen App-Palette.
export const STORE_PRESETS: readonly StorePreset[] = [
  { name: 'REWE', color: '#B5623F' },
  { name: 'Aldi', color: '#5C7396' },
  { name: 'Lidl', color: '#C6A24A' },
  { name: 'Edeka', color: '#748C5B' },
  { name: 'Netto', color: '#8B6B4A' },
  { name: 'Kaufland', color: '#A6483D' },
  { name: 'dm', color: '#8B6F72' },
];

/** Frei waehlbare Marktfarben, unabhaengig vom Namens-Preset. */
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
