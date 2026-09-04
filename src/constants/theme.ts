// TODO: DELETE — maintainer removes this legacy theme module after migration review.
/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import '@/global.css';

import { Platform } from 'react-native';

// Warme, gedeckte Mauve-/Creme-Palette
export const Colors = {
  light: {
    text: '#2D2830', // fam/color/text-primary
    background: '#F8F4EF', // fam/color/bg-app
    backgroundElement: '#FBF7F2', // fam/color/bg-surface (Karten, Listen)
    backgroundSelected: '#E9E1E7', // color/selection/segment-bg
    textSecondary: '#786F79', // fam/color/text-secondary
    border: '#E4DDE3',
    accent: '#705773', // fam/color/bg-accent
    onAccent: '#FFFFFF',
    premiumGradientStart: '#715574',
    premiumGradientMid: '#A36E72',
    premiumGradientEnd: '#C59677',
    premiumOnSurface: '#FFFFFF',
    premiumActionBackground: '#F8F1ED',
    premiumActionText: '#604765',
    success: '#78906F', // fam/color/status-success
    warning: '#C69059', // fam/color/status-warning
    danger: '#C65F50', // fam/color/status-danger (Figma: kritische MHD-Zeilen)
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
    onAccent: '#211D23',
    premiumGradientStart: '#4F3D52',
    premiumGradientMid: '#765158',
    premiumGradientEnd: '#8B6755',
    premiumOnSurface: '#FFF9F6',
    premiumActionBackground: '#F0E6E1',
    premiumActionText: '#4B384F',
    success: '#8FAE86',
    warning: '#D9A86C',
    danger: '#D9776A',
    shadowCard: '#594059',
    shadowSheet: '#2A1F2C',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

/** Normalisiert native/web Zwischenwerte wie `unspecified` auf das helle Theme. */
export function normalizeThemeMode(scheme: string | null | undefined): keyof typeof Colors {
  return scheme === 'dark' ? 'dark' : 'light';
}

export type GradientSpec = {
  readonly colors: readonly string[];
  readonly locations?: readonly number[];
};

/** Semantische Verläufe des Design-Systems statt wiederholter Hex-Arrays. */
export const Gradients = {
  hub: {
    light: {
      colors: ['#FFCCB2', '#F9F2EB', '#E8DEF2'],
      locations: [0, 0.40385, 0.96154],
    },
    dark: {
      colors: ['#3B2B2B', '#211D23', '#2E2638'],
      locations: [0, 0.40385, 0.96154],
    },
  },
} as const satisfies Record<string, Record<'light' | 'dark', GradientSpec>>;

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
