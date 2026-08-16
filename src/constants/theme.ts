/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import '@/global.css';

import { Platform } from 'react-native';

// Figma-Design-System "fam" (Mobile Design Library, August 2026):
// https://www.figma.com/design/6RkH2npU7OF3B62Fa9SvoY/fam-–-App-Mockup
// Warme, gedeckte Mauve-/Creme-Palette statt des frueheren Blau/Weiss-Themes.
// Dark Mode ist im Figma-File nicht ausgefuehrt — die Werte hier fuehren
// dieselben Farbtoene auf einem dunklen Hintergrund weiter.
export const Colors = {
  light: {
    text: '#2D2830', // fam/color/text-primary
    background: '#F8F4EF', // fam/color/bg-app
    backgroundElement: '#FBF7F2', // fam/color/bg-surface (Karten, Listen)
    backgroundSelected: '#E9E1E7', // color/selection/segment-bg
    textSecondary: '#786F79', // fam/color/text-secondary
    border: '#E4DDE3',
    accent: '#705773', // fam/color/bg-accent
    // Ampel fuer Mindesthaltbarkeitsdaten (#71) und Zielerreichung.
    // Farbe ist nie der einzige Traeger der Information — daneben steht immer
    // ein Text oder ein Symbol, sonst ist die Anzeige fuer Farbfehlsichtige wertlos.
    success: '#78906F', // fam/color/status-success
    warning: '#C69059', // fam/color/status-warning
    danger: '#C65F50', // fam/color/status-danger (Figma: kritische MHD-Zeilen)
    // Schatten-Grundton, konsolidiert aus dem app-weiten Audit (#122,
    // docs/design-system/gradient-background-audit.md) statt der bisher pro
    // Stelle frei erfundenen Hex/RGBA-Literale. Opazitaet, Blur und Offset
    // bleiben weiterhin Sache des jeweiligen `shadowOpacity`/`boxShadow` —
    // hier steht nur der Farbton. Noch identisch fuer Light/Dark, da keine
    // der bisherigen Stellen zwischen den Modi unterschieden hat.
    shadowCard: '#594059', // helleres Mauve, fuer Karten auf dem Screen-Hintergrund
    shadowSheet: '#2A1F2C', // dunkles Mauve/Violett, fuer Sheets/Overlays/Dropdowns
  },
  dark: {
    text: '#F2ECE7',
    background: '#211D23',
    backgroundElement: '#2B262E',
    backgroundSelected: '#382F3B',
    textSecondary: '#B7ADB3',
    border: '#3E3640',
    accent: '#B79CBA',
    success: '#8FAE86',
    warning: '#D9A86C',
    danger: '#D9776A',
    shadowCard: '#594059',
    shadowSheet: '#2A1F2C',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

/**
 * Wandelt einen 6-stelligen Hex-Farbwert in einen `rgba()`-String mit
 * gegebener Opazitaet um. Natives `shadowColor` + `shadowOpacity` kommen
 * ohne das aus, aber `boxShadow`-Strings brauchen Farbe und Transparenz in
 * einem Wert — damit bleibt der Farbton am `Colors`-Token haengen, statt
 * pro Stelle erneut als eigenes RGB-Tripel abgetippt zu werden.
 */
export function withAlpha(hex: string, alpha: number): string {
  const value = hex.replace('#', '');
  const r = Number.parseInt(value.slice(0, 2), 16);
  const g = Number.parseInt(value.slice(2, 4), 16);
  const b = Number.parseInt(value.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
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
