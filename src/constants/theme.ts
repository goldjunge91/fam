/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import '@/global.css';

import { Platform } from 'react-native';

export const Colors = {
  light: {
    text: '#000000',
    background: '#ffffff',
    backgroundElement: '#F0F0F3',
    backgroundSelected: '#E0E1E6',
    textSecondary: '#60646C',
    border: '#DDDDE3',
    accent: '#208AEF',
    // Ampel fuer Mindesthaltbarkeitsdaten (#71) und Zielerreichung.
    // Farbe ist nie der einzige Traeger der Information — daneben steht immer
    // ein Text oder ein Symbol, sonst ist die Anzeige fuer Farbfehlsichtige wertlos.
    success: '#1A7F4B',
    warning: '#B26A00',
    danger: '#C62828',
  },
  dark: {
    text: '#ffffff',
    background: '#000000',
    backgroundElement: '#212225',
    backgroundSelected: '#2E3135',
    textSecondary: '#B0B4BA',
    border: '#35383D',
    accent: '#4EA1F5',
    success: '#4ADE80',
    warning: '#FBBF24',
    danger: '#F87171',
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

/**
 * Zentrale Schriftstufen des fam Design-Systems.
 * Komponenten kombinieren diese Größen nur noch mit semantischen Gewichten.
 */
export const Typography = {
  micro: { fontSize: 9, lineHeight: 14 },
  captionCompact: { fontSize: 11, lineHeight: 14 },
  caption: { fontSize: 11, lineHeight: 15 },
  detail: { fontSize: 12, lineHeight: 16 },
  label: { fontSize: 13, lineHeight: 17 },
  bodySmall: { fontSize: 14, lineHeight: 20 },
  controlValue: { fontSize: 15, lineHeight: 20 },
  body: { fontSize: 16, lineHeight: 22 },
  bodyRelaxed: { fontSize: 16, lineHeight: 24 },
  controlValueLarge: { fontSize: 17, lineHeight: 22 },
  bodyLarge: { fontSize: 18, lineHeight: 24 },
  controlAction: { fontSize: 20, lineHeight: 22 },
  headingSmall: { fontSize: 20, lineHeight: 26 },
  controlActionLarge: { fontSize: 22, lineHeight: 24 },
  title: { fontSize: 32, lineHeight: 44 },
  display: { fontSize: 48, lineHeight: 52 },
  link: { fontSize: 14, lineHeight: 30 },
  code: { fontSize: 12 },
} as const;

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;

/**
 * Hoehe der nativen Tab-Leiste OHNE die untere Safe Area — die kommt ueber
 * `useSafeAreaInsets().bottom` dazu.
 *
 * Der frueher hier verwendete `BottomTabInset` von 50 pt war zu klein: im
 * Simulator (iPhone 17 Pro, iOS 26) beginnt die Leiste bei 90,5 % der
 * Bildschirmhoehe, belegt also rund 81 pt inklusive Home-Indicator. Der letzte
 * Karteninhalt lag dadurch unter der Leiste.
 */
export const TabBarHeight = Platform.select({ ios: 56, android: 64 }) ?? 56;
export const MaxContentWidth = 800;
