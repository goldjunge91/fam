/**
 * Our mobile Fam theme, native edition.
 *
 * feel like one brand, but expressed as React Native style primitives (raw hex,
 * numeric spacing/radius, shadow objects) instead of Tailwind classes.
 */
import { Dimensions, Platform } from 'react-native';

/**
 * Legacy ui reference values.
 *
 * These values remain available for gradual migration or visual comparison,
 * but they are not used by the active Fam palette. This prevents the old
 * green text and espresso shadow from returning through an accidental import.
 */
export const legacyWaivyColors = {
  light: {
    bg: '#FFF8ED',
    surface: '#FFFFFF',
    surfaceSoft: '#FFF1D9',
    oat: '#F6E7CF',
    borderSoft: '#E8D8C4',
    border: '#EADBC7',
    text: '#241A12',
    textMuted: '#6B5A4A',
    textFaint: '#A3937F',
    inverse: '#FFFFFF',
    basil: '#2FBF71',
    basilShadow: '#16834A',
    basilSoft: '#E8FAF0',
    carrot: '#FF8A3D',
    carrotShadow: '#C75F18',
    butter: '#FFD166',
    butterShadow: '#C99A23',
    tomato: '#EF4444',
    tomatoShadow: '#B91C1C',
    grape: '#7C5CFF',
    grapeShadow: '#4F38C7',
    teal: '#20C7A5',
    tealShadow: '#0E8E76',
    sky: '#3BA7FF',
    skyShadow: '#1E72C2',
    pink: '#FF6B9E',
    pinkShadow: '#C73E70',
    basilTint: '#E3F7EC',
    carrotTint: '#FFEAD9',
    butterTint: '#FFF3D2',
    grapeTint: '#ECE6FF',
    tealTint: '#D8F6EF',
    skyTint: '#DCEEFF',
    pinkTint: '#FFE2EC',
    tomatoTint: '#FCE3E3',
    scrim: 'rgba(36,26,18,0.45)',
  },
  dark: {
    bg: '#120E0B',
    surface: '#1C1714',
    surfaceSoft: '#262019',
    oat: '#262019',
    borderSoft: '#3A312A',
    border: '#3A312A',
    text: '#F3ECE2',
    textMuted: '#B6A896',
    textFaint: '#8A7C6C',
    inverse: '#FFFFFF',
    basil: '#34CF7C',
    basilShadow: '#16834A',
    basilSoft: '#10301F',
    carrot: '#FF8A3D',
    carrotShadow: '#C75F18',
    butter: '#FFD166',
    butterShadow: '#C99A23',
    tomato: '#F2554E',
    tomatoShadow: '#B91C1C',
    grape: '#9B82FF',
    grapeShadow: '#4F38C7',
    teal: '#20C7A5',
    tealShadow: '#0E8E76',
    sky: '#5AB6FF',
    skyShadow: '#1E72C2',
    pink: '#FF6B9E',
    pinkShadow: '#C73E70',
    basilTint: '#122E20',
    carrotTint: '#33210F',
    butterTint: '#2E2710',
    grapeTint: '#221A3D',
    tealTint: '#0F2E28',
    skyTint: '#102532',
    pinkTint: '#3A1722',
    tomatoTint: '#3A1717',
    scrim: 'rgba(0,0,0,0.55)',
  },
  shadow: '#241A12',
} as const;

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
const famColorsLight = {
  text: '#2D2830', // fam/color/text-primary
  background: '#F8F4EF', // fam/color/bg-app
  backgroundElement: '#FBF7F2', // fam/color/bg-surface
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
  danger: '#C65F50', // fam/color/status-danger
  buttonPrimaryDepth: '#5E4861',
  buttonDangerDepth: '#A94C40',
  buttonAccentDepth: '#A87343',
  shadowCard: '#594059',
  shadowSheet: '#2A1F2C',
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
  shadowCard: '#594059',
  shadowSheet: '#2A1F2C',
} as const;

/** Canonical Fam names retained while feature code uses the shorter aliases below. */
export const Colors = {
  light: famColorsLight,
  dark: famColorsDark,
} as const;

/** Runtime aliases used by the shared primitives. Every alias maps to a Fam token. */
export const colorsLight = {
  ...famColorsLight,
  bg: famColorsLight.background,
  surface: famColorsLight.backgroundElement,
  oat: famColorsLight.premiumActionBackground,
  borderSoft: famColorsLight.border,
  textMuted: famColorsLight.textSecondary,
  textFaint: famColorsLight.textSecondary,
  inverse: famColorsLight.onAccent,
  basil: famColorsLight.accent,
  basilShadow: famColorsLight.shadowCard,
  basilSoft: famColorsLight.backgroundSoft,
  carrot: famColorsLight.warning,
  carrotShadow: famColorsLight.shadowCard,
  butter: famColorsLight.premiumGradientEnd,
  butterShadow: famColorsLight.shadowCard,
  tomato: famColorsLight.danger,
  tomatoShadow: famColorsLight.shadowSheet,
  grape: famColorsLight.premiumGradientStart,
  grapeShadow: famColorsLight.shadowSheet,
  teal: famColorsLight.premiumGradientMid,
  tealShadow: famColorsLight.shadowCard,
  sky: famColorsLight.premiumGradientEnd,
  skyShadow: famColorsLight.shadowCard,
  pink: famColorsLight.premiumActionText,
  pinkShadow: famColorsLight.shadowSheet,
  basilTint: famColorsLight.backgroundSoft,
  carrotTint: famColorsLight.premiumActionBackground,
  butterTint: famColorsLight.premiumActionBackground,
  grapeTint: famColorsLight.backgroundSoft,
  tealTint: famColorsLight.premiumActionBackground,
  skyTint: famColorsLight.backgroundSoft,
  pinkTint: famColorsLight.premiumActionBackground,
  tomatoTint: famColorsLight.premiumActionBackground,
  scrim: 'rgba(42,31,44,0.45)',
} as const;

export type Palette = { -readonly [K in keyof typeof colorsLight]: string };

/**
 * Dark Fam palette. The semantic names are the same as light mode and the
 * aliases below point to the canonical Fam values above.
 */
// The canonical dark values are retained here for comparison with the aliases.
/**
 *  text: '#F2ECE7',
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
    shadowCard: '#594059',
    shadowSheet: '#2A1F2C',
 */
export const colorsDark: Palette = {
  ...famColorsDark,
  bg: famColorsDark.background,
  surface: famColorsDark.backgroundElement,
  oat: famColorsDark.backgroundSoft,
  borderSoft: famColorsDark.border,
  textMuted: famColorsDark.textSecondary,
  textFaint: famColorsDark.textSecondary,
  inverse: famColorsDark.onAccent,
  basil: famColorsDark.accent,
  basilShadow: famColorsDark.shadowCard,
  basilSoft: famColorsDark.backgroundSoft,
  carrot: famColorsDark.warning,
  carrotShadow: famColorsDark.shadowCard,
  butter: famColorsDark.premiumGradientEnd,
  butterShadow: famColorsDark.shadowCard,
  tomato: famColorsDark.danger,
  tomatoShadow: famColorsDark.shadowSheet,
  grape: famColorsDark.premiumGradientStart,
  grapeShadow: famColorsDark.shadowSheet,
  teal: famColorsDark.premiumGradientMid,
  tealShadow: famColorsDark.shadowCard,
  sky: famColorsDark.premiumGradientEnd,
  skyShadow: famColorsDark.shadowCard,
  pink: famColorsDark.premiumActionText,
  pinkShadow: famColorsDark.shadowSheet,
  basilTint: famColorsDark.backgroundSoft,
  carrotTint: famColorsDark.backgroundSoft,
  butterTint: famColorsDark.backgroundSoft,
  grapeTint: famColorsDark.backgroundSoft,
  tealTint: famColorsDark.backgroundSoft,
  skyTint: famColorsDark.backgroundSoft,
  pinkTint: famColorsDark.backgroundSoft,
  tomatoTint: famColorsDark.backgroundSoft,
  scrim: 'rgba(0,0,0,0.55)',
};

/** Back-compat default export (light). Converted screens use useTheme(). */
export const colors = colorsLight;

/** Maps a product/category to its accent + soft tint + shadow + on-color. */
export function makeAccent(c: Palette) {
  return {
    'ai-chef': { main: c.grape, tint: c.grapeTint, shadow: c.grapeShadow, on: c.inverse },
    pantry: { main: c.basil, tint: c.basilTint, shadow: c.basilShadow, on: c.inverse },
    nourish: { main: c.carrot, tint: c.carrotTint, shadow: c.carrotShadow, on: c.inverse },
    grocery: { main: c.teal, tint: c.tealTint, shadow: c.tealShadow, on: c.inverse },
    cheap: { main: c.butter, tint: c.butterTint, shadow: c.butterShadow, on: c.text },
    saved: { main: c.pink, tint: c.pinkTint, shadow: c.pinkShadow, on: c.inverse },
    explore: { main: c.sky, tint: c.skyTint, shadow: c.skyShadow, on: c.inverse },
    protein: { main: c.grape, tint: c.grapeTint, shadow: c.grapeShadow, on: c.inverse },
    carbs: { main: c.sky, tint: c.skyTint, shadow: c.skyShadow, on: c.inverse },
    fat: { main: c.butter, tint: c.butterTint, shadow: c.butterShadow, on: c.text },
    fiber: { main: c.basil, tint: c.basilTint, shadow: c.basilShadow, on: c.inverse },
    water: { main: c.sky, tint: c.skyTint, shadow: c.skyShadow, on: c.inverse },
  } as const;
}

export const accent = makeAccent(colorsLight);

export type AccentKey = keyof ReturnType<typeof makeAccent>;

/**
 * Soft tint + text/icon color + a Feather icon for each of the 10 ingredient
 * CATEGORIES, so pantry items can be color-coded by category. Mirrors the web
 * `PANTRY_TONE_BY_CATEGORY` intent (grain→gold, protein→grape, veg→basil,
 * fruit→pink, dairy→sky, canned→carrot, condiment→teal, spice→tomato) using
 * existing palette tokens so it flips in dark mode for free. `icon` strings are
 * valid Feather glyph names.
 */
export function makeCategoryTone(c: Palette) {
  return {
    protein: { tint: c.grapeTint, color: c.grapeShadow, icon: 'zap' },
    vegetable: { tint: c.basilTint, color: c.basilShadow, icon: 'feather' },
    fruit: { tint: c.pinkTint, color: c.pinkShadow, icon: 'heart' },
    dairy: { tint: c.skyTint, color: c.skyShadow, icon: 'droplet' },
    grain: { tint: c.butterTint, color: c.butterShadow, icon: 'circle' },
    canned: { tint: c.carrotTint, color: c.carrotShadow, icon: 'archive' },
    frozen: { tint: c.skyTint, color: c.skyShadow, icon: 'cloud-snow' },
    condiment: { tint: c.tealTint, color: c.tealShadow, icon: 'coffee' },
    spice: { tint: c.tomatoTint, color: c.tomatoShadow, icon: 'thermometer' },
    snack: { tint: c.oat, color: c.textMuted, icon: 'box' },
  } as const;
}

export type CategoryToneKey = keyof ReturnType<typeof makeCategoryTone>;

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
const rs = (n: number) => Math.round(n * _scale);

export const radius = {
  sm: 12,
  md: 16,
  lg: 20,
  xl: 26,
  xxl: 32,
  pill: 999,
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

export const theme = { colors, accent, radius, space, font, shadow, BUTTON_DEPTH };
export default theme;
