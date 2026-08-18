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

/** Feste Höhen und Größen für wiederverwendbare Controls aus dem fam Design-System. */
export const ControlSize = {
  compactHeight: 34,
} as const;

/** Standardisierte Button-Dimensionen für wiederkehrende UI-Aktionen (#164). */
export const ButtonSize = {
  /** Formular- und Bestätigungsbuttons (Primary, Secondary, Danger) */
  formHeight: 54,
  /** Haupt-Navigationsanker im Hub (Menü / Profil) */
  navHero: 58,
  /** Runder Zurück-Pfeilbutton */
  backArrow: 45,
  /** Kompakter Aktionsbutton im Header (Lupe, Filter, Kalender) */
  headerAction: 39,
  /** Kompakter Schließen-Button in Modals und Sheets */
  modalClose: 32,
  /** Große schwebende Hauptaktion am unteren Bildschirmrand (FAB) */
  fab: 75,
} as const;

/** Standardisierte Icon-Größen für SVG- und SF-Symbol-Grafiken. */
export const IconSize = {
  /** Sehr kompakte Icons (z. B. in Badges oder Modal-Schließen-Buttons) */
  xs: 14,
  /** Standard-Icon in Header-Aktionsbuttons (Lupe, Filter, Kalender) */
  header: 20,
  /** Standard-Icon in Navigation und Haupt-Menüpunkten */
  nav: 24,
  /** Hero-Icons (z. B. im Menü-Button) */
  hero: 26,
  /** Pfeil-Icon im Zurück-Button */
  backArrow: 45,
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
