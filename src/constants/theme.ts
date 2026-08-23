import '@/global.css';

import { Platform } from 'react-native';

export const Colors = {
  light: {
    text: '#2D2830',
    background: '#F8F4EF',
    backgroundElement: '#FBF7F2',
    backgroundSelected: '#E9E1E7',
    textSecondary: '#786F79',
    border: '#E4DDE3',
    accent: '#705773',
    onAccent: '#FFFFFF',
    premiumGradientStart: '#715574',
    premiumGradientMid: '#A36E72',
    premiumGradientEnd: '#C59677',
    premiumOnSurface: '#FFFFFF',
    premiumActionBackground: '#F8F1ED',
    premiumActionText: '#604765',
    // Statusfarben nie als alleinigen Informationstraeger verwenden.
    success: '#78906F',
    warning: '#C69059',
    danger: '#C65F50',
    shadowCard: '#594059',
    shadowSheet: '#2A1F2C',
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

export function normalizeThemeMode(scheme: string | null | undefined): keyof typeof Colors {
  return scheme === 'dark' ? 'dark' : 'light';
}

export type GradientSpec = {
  readonly colors: readonly string[];
  readonly locations?: readonly number[];
};

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
    sans: 'system-ui',
    serif: 'ui-serif',
    rounded: 'ui-rounded',
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
