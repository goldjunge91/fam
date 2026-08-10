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
export const STORE_PRESETS: readonly StorePreset[] = [
  { name: 'REWE', color: '#E2001A' },
  { name: 'Aldi', color: '#00549F' },
  { name: 'Lidl', color: '#FFD100' },
  { name: 'Edeka', color: '#1A7F4B' },
  { name: 'Netto', color: '#FFD200' },
  { name: 'Kaufland', color: '#E10915' },
  { name: 'dm', color: '#0069B4' },
];

/**
 * Frei waehlbare Farbpalette fuer einen Markt — unabhaengig von den
 * Namens-Presets oben. Ein Preset schlaegt nur den Namen vor, die Farbe
 * waehlt der Nutzer immer selbst aus dieser Palette.
 */
export const STORE_COLOR_PALETTE: readonly string[] = [
  '#E2001A',
  '#F97316',
  '#F5B800',
  '#65A30D',
  '#16A085',
  '#0EA5E9',
  '#2563EB',
  '#7C3AED',
  '#DB2777',
  '#6B7280',
];
