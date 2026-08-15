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
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

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

export const MaxContentWidth = 800;
