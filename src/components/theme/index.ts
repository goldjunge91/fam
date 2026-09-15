/**
 * Our mobile Fam theme, native edition.
 *
 * feel like one brand, but expressed as React Native style primitives (raw hex,
 * numeric spacing/radius, shadow objects) instead of Tailwind classes.
 */
import { Dimensions, Platform } from 'react-native';

/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */
// TODO: do we need this ?
// import '@/global.css';

// Canonical Fam values retained from the previous theme source:
/**
 *   text: '#2D2830', // fam/color/text-primary
    background: '#F8F4EF', // fam/color/bg-app
    backgroundElement: '#FBF7F2', // fam/color/bg-surface (Karten, Listen)
    backgroundSoft: '#E9E1E7', // fam/color/bg-soft
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
 */
export const SPEED_DIAL_COLOR_KEYS = [
  'speedDialPantry',
  'speedDialShopping',
  'speedDialRecipes',
  'speedDialCalories',
] as const;

export type SpeedDialColorKey = (typeof SPEED_DIAL_COLOR_KEYS)[number];

/** Theme-owned surfaces for the four primary actions in the SpeedDial. */
const famColorsLight = {
  text: '#2D2830', // fam/color/text-primary
  background: '#F8F4EF', // fam/color/bg-app
  backgroundElement: '#FBF7F2', // fam/color/bg-surface
  backgroundSoft: '#E9E1E7', // fam/color/bg-soft
  textSecondary: '#786F79', // fam/color/text-secondary
  border: '#E4DDE3',
  accent: '#8B5E63', // fam/color/bg-accent
  onAccent: '#FFFFFF',
  premiumGradientStart: '#715574',
  premiumGradientMid: '#A36E72',
  premiumGradientEnd: '#C59677',
  premiumOnSurface: '#FFFFFF',
  premiumActionBackground: '#F8F1ED',
  premiumActionText: '#604765',
  success: '#78906F', // fam/color/status-success
  warning: '#C69059', // fam/color/status-warning
  danger: '#C65F50', // fam/color/status-danger
  buttonPrimaryDepth: '#5E4861',
  buttonDangerDepth: '#A94C40',
  buttonAccentDepth: '#A87343',
  speedDialPantry: '#F0E2DF',
  speedDialShopping: '#EBE5F1',
  speedDialRecipes: '#E4EDE3',
  speedDialCalories: '#F3E9D7',
  shadowCard: '#594059',
  shadowSheet: '#2A1F2C',
  scrim: 'rgba(42,31,44,0.45)',
} as const;

const famColorsDark = {
  text: '#F2ECE7',
  background: '#211D23',
  backgroundElement: '#2B262E',
  backgroundSoft: '#382F3B',
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
  buttonPrimaryDepth: '#5E4861',
  buttonDangerDepth: '#A94C40',
  buttonAccentDepth: '#A87343',
  speedDialPantry: '#F0E2DF',
  speedDialShopping: '#EBE5F1',
  speedDialRecipes: '#E4EDE3',
  speedDialCalories: '#F3E9D7',
  shadowCard: '#594059',
  shadowSheet: '#2A1F2C',
  scrim: 'rgba(0,0,0,0.55)',
} as const;

/** Canonical Fam names used by the active palette and feature code. */
export const Colors = {
  light: famColorsLight,
  dark: famColorsDark,
} as const;

export type Palette = { -readonly [K in keyof typeof famColorsLight]: string };

export const colorsLight: Palette = famColorsLight;
export const colorsDark: Palette = famColorsDark;

/** Back-compat default export (light). Converted screens use useTheme(). */
export const colors = colorsLight;

/** Maps a domain key to canonical Fam accent roles. */
export function makeAccent(c: Palette) {
  const shared = { tint: c.backgroundSoft, shadow: c.shadowCard, on: c.onAccent };

  return {
    'ai-chef': { ...shared, main: c.premiumGradientStart, shadow: c.shadowSheet },
    pantry: { ...shared, main: c.accent },
    nourish: { ...shared, main: c.warning, on: c.text },
    grocery: { ...shared, main: c.success, on: c.text },
    cheap: { ...shared, main: c.premiumGradientEnd, on: c.text },
    saved: { ...shared, main: c.premiumActionText, on: c.premiumOnSurface },
    explore: { ...shared, main: c.premiumGradientMid, on: c.premiumOnSurface },
    protein: { ...shared, main: c.premiumGradientStart, shadow: c.shadowSheet },
    carbs: { ...shared, main: c.accent },
    fat: { ...shared, main: c.premiumGradientEnd, on: c.text },
    fiber: { ...shared, main: c.accent },
    water: { ...shared, main: c.success, on: c.text },
  } as const;
}

export const accent = makeAccent(colorsLight);

export type AccentKey = keyof ReturnType<typeof makeAccent>;

// ─── Responsive scale ────────────────────────────────────────────────────────
// The layout was tuned at ~393pt (iPhone 17). Scale spacing + type to the device
// width so it fits smaller phones (iPhone SE / 11 Pro ~375) without ballooning on
// big phones. iPads use a capped "large-phone" scale, and the Screen wrapper
// additionally centers content in a max-width column so it doesn't stretch wide.
export const SCREEN_W = Dimensions.get('window').width;
export const IS_TABLET = SCREEN_W >= 600;
/** Cap the column width on tablets/large screens so the phone layout stays readable. */
export const CONTENT_MAX_WIDTH = 600;
const _scale = Math.max(0.9, Math.min(1.06, Math.min(SCREEN_W, 430) / 393));
export const rs = (n: number) => Math.round(n * _scale);

export const radius = {
  xs: 8,
  sm: 12,
  md: 16,
  lg: 20,
  xl: 26,
  xxl: 32,
  famLarge: 28,
  pill: 999,
} as const;

/** Shared contour widths for regular and emphasized controls. */
export const borderWidth = {
  base: 1.5,
  strong: 2,
} as const;

export const space = {
  xs: rs(4),
  sm: rs(8),
  md: rs(12),
  lg: rs(16),
  xl: rs(20),
  xxl: rs(28),
  xxxl: rs(40),
} as const;

/** Gemeinsame Maße für eigenständige Aktionsflächen. */
export const controlSizes = {
  headerAction: rs(48),
} as const;

export const font = {
  // System rounded gives an SF-Rounded look on iOS — friendly + food-app warm.
  // Falls back to system on Android.
  display: 'System',
  body: 'System',
  sizes: {
    xs: rs(12),
    sm: rs(13),
    base: rs(16),
    md: rs(17),
    lg: rs(20),
    xl: rs(24),
    xxl: rs(32),
    xxxl: rs(48),
  },
  lineHeights: {
    display: rs(52),
    title: rs(44),
    heading: rs(26),
    subheading: rs(24),
    body: rs(22),
    label: rs(17),
    caption: rs(15),
  },
  weight: {
    regular: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
    heavy: '800',
  },
} as const;

/** iOS-style soft shadow tiers. */
export const shadow = {
  sm: {
    shadowColor: '#594059',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  md: {
    shadowColor: '#594059',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 14,
    elevation: 4,
  },
  lg: {
    shadowColor: '#594059',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.14,
    shadowRadius: 24,
    elevation: 8,
  },
} as const;

/** Sichtbare Tiefe und vollständiger Druckweg gefüllter 3D-Buttons. */
export const BUTTON_DEPTH = 4;

// TODO: prüfen ob wir das noch brauchen
export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

// TODO: prüfen ob wir das noch brauchen
/** Normalisiert native/web Zwischenwerte wie `unspecified` auf das helle Theme. */
export function normalizeThemeMode(scheme: string | null | undefined): keyof typeof Colors {
  return scheme === 'dark' ? 'dark' : 'light';
}

// TODO: prüfen ob wir das noch brauchen
export type GradientSpec = {
  readonly colors: readonly string[];
  readonly locations?: readonly number[];
};

/** Semantische Verläufe des Design-Systems statt wiederholter Hex-Arrays. */
// TODO: prüfen ob wir das noch brauchen
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

// TODO: prüfen ob wir das noch brauchen
export function withAlpha(hex: string, alpha: number): string {
  const value = hex.replace('#', '');
  const r = Number.parseInt(value.slice(0, 2), 16);
  const g = Number.parseInt(value.slice(2, 4), 16);
  const b = Number.parseInt(value.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// TODO: prüfen ob wir das noch brauchen
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

export const theme = {
  colors,
  accent,
  radius,
  borderWidth,
  space,
  controlSizes,
  font,
  shadow,
  BUTTON_DEPTH,
};
export default theme;

// ─── Unistyles v3 Configuration ──────────────────────────────────────────────
// StyleSheet.configure must be called before any StyleSheet.create.
// Loaded as a Jest setupFile so the mock receives the config in tests too.
import { StyleSheet } from 'react-native-unistyles';

const unistylesThemes = {
  light: { ...colorsLight, space, controlSizes, font, radius, borderWidth, shadow },
  dark: { ...colorsDark, space, controlSizes, font, radius, borderWidth, shadow },
};

type AppThemes = typeof unistylesThemes;

declare module 'react-native-unistyles' {
  export interface UnistylesThemes extends AppThemes {}
}

StyleSheet.configure({
  themes: unistylesThemes,
  settings: {
    // The system preference is resolved by Unistyles. ThemeProvider toggles
    // this runtime setting off only for an explicit light/dark preference.
    adaptiveThemes: true,
  },
});
