export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const Layout = {
  floatingActionAreaHeight: Spacing.four + Spacing.six, // 88
  floatingActionClearance: Spacing.six,
} as const;

/** Feste Höhen für wiederverwendbare Controls aus dem fam Design-System. */
export const ControlSize = {
  compactHeight: 34,
} as const;

/**
 * Eckenradien, konsolidiert aus einem app-weiten Audit von 34 frei
 * gewählten `borderRadius`-Werten (#122, docs/design-system/radius-audit.md).
 * Eng benachbarte Werte (≤ 2px, am Bildschirm nicht unterscheidbar) wurden
 * auf den jeweils dominanten Nachbarn zusammengeführt — Rest ist Zufall,
 * kein Raster.
 */
export const Radius = {
  hairline: 2, // Badges, kleine Indikatoren
  xs: 4, // sehr kompakte Elemente
  sm: 8, // kleine Chips/Icons
  control: 12, // Chips, Felder, kleine Buttons
  controlLarge: 14, // Segmented Control, Essensplaner-spezifische Controls
  card: 16, // Karten, Listen-Container — dominantester Wert app-weit
  sheet: 20, // Modals/Bottom-Sheets
  large: 28, // grosse Karten, z. B. `Card`-Komponente
  pill: 999, // voll gerundet, unabhaengig von der Elementhoehe
} as const;

export const MaxContentWidth = 800;
