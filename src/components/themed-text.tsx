import { Platform, StyleSheet, Text, type TextProps, type TextStyle } from 'react-native';

import { Fonts, type ThemeColor } from '@/constants/theme';

/**
 * Einzige Quelle fuer feste Schriftgroessen in der App.
 *
 * Die numerischen Schluessel bilden die bisherigen Designwerte ab. Aufrufer
 * referenzieren nur diese Tokens, damit keine Schriftgroesse ausserhalb dieser
 * Datei definiert wird.
 */
export const FontSize = {
  7: { fontSize: 7 },
  8: { fontSize: 8 },
  9: { fontSize: 9 },
  10: { fontSize: 10 },
  11: { fontSize: 11 },
  12: { fontSize: 12 },
  13: { fontSize: 13 },
  14: { fontSize: 14 },
  15: { fontSize: 15 },
  16: { fontSize: 16 },
  17: { fontSize: 17 },
  18: { fontSize: 18 },
  19: { fontSize: 19 },
  20: { fontSize: 20 },
  21: { fontSize: 21 },
  22: { fontSize: 22 },
  23: { fontSize: 23 },
  24: { fontSize: 24 },
  27: { fontSize: 27 },
  28: { fontSize: 28 },
  32: { fontSize: 32 },
  48: { fontSize: 48 },
  52: { fontSize: 52 },
} as const;

/** Semantische Textstile des fam Design-Systems. */
export const Typography = {
  micro: { ...FontSize[9], lineHeight: 14 },
  captionCompact: { ...FontSize[11], lineHeight: 14 },
  caption: { ...FontSize[11], lineHeight: 15 },
  detail: { ...FontSize[12], lineHeight: 16 },
  label: { ...FontSize[13], lineHeight: 17 },
  bodySmall: { ...FontSize[14], lineHeight: 20 },
  controlValue: { ...FontSize[15], lineHeight: 20 },
  body: { ...FontSize[16], lineHeight: 22 },
  bodyRelaxed: { ...FontSize[16], lineHeight: 24 },
  controlValueLarge: { ...FontSize[17], lineHeight: 22 },
  bodyLarge: { ...FontSize[18], lineHeight: 24 },
  controlAction: { ...FontSize[20], lineHeight: 22 },
  headingSmall: { ...FontSize[20], lineHeight: 26 },
  controlActionLarge: { ...FontSize[22], lineHeight: 24 },
  title: { ...FontSize[32], lineHeight: 44 },
  display: { ...FontSize[48], lineHeight: 52 },
  link: { ...FontSize[14], lineHeight: 30 },
  code: { ...FontSize[12] },
} as const;

/**
 * Benannte Text-Rollen: Groesse **und** Gewicht liegen fest, unabhaengig
 * davon, ob ein gleichnamiger `Typography`-Schluessel existiert. `title` ist
 * z. B. immer "grosse Ueberschrift" (`display`-Groesse + Gewicht 600) und
 * beansprucht den Namen `title` fuer sich — der rohe `Typography.title`-Wert
 * (32/44, ohne Gewicht) ist ueber `type` deshalb nicht separat erreichbar,
 * sondern nur direkt per `import { Typography } from '@/components/themed-text'`.
 * Praktisch betrifft das nur `title`: `link` und `code` als Rolle liefern
 * ohnehin exakt `Typography.link`/`Typography.code` (kein Unterschied), nur
 * `title` (Rolle) und `Typography.title` (Rohgroesse) sind zwei
 * verschiedene Werte hinter demselben Namen.
 */
const TEXT_ROLE_STYLES = StyleSheet.create({
  small: { ...Typography.bodySmall, fontWeight: 500 },
  smallBold: { ...Typography.bodySmall, fontWeight: 700 },
  smallSelected: { ...Typography.bodySmall, fontWeight: 600 },
  smallMuted: { ...Typography.bodySmall, fontWeight: 500 },
  smallDanger: { ...Typography.bodySmall, fontWeight: 500 },
  default: { ...Typography.bodyRelaxed, fontWeight: 500 },
  bodyBold: { ...Typography.bodyRelaxed, fontWeight: 700 },
  bodyMuted: { ...Typography.bodyRelaxed, fontWeight: 500 },
  title: { ...Typography.display, fontWeight: 600 },
  subtitle: { ...Typography.title, fontWeight: 600 },
  subtitleMuted: { ...Typography.title, fontWeight: 600 },
  caption: { ...Typography.caption, fontWeight: 500 },
  captionMuted: { ...Typography.caption, fontWeight: 500 },
  captionCompact: { ...Typography.captionCompact, fontWeight: 500 },
  label: { ...Typography.label, fontWeight: 500 },
  labelBold: { ...Typography.label, fontWeight: 700 },
  labelMuted: { ...Typography.label, fontWeight: 500 },
  link: { ...Typography.link },
  linkPrimary: { ...Typography.link },
  code: {
    fontFamily: Fonts.mono,
    fontWeight: Platform.select({ android: 700 }) ?? 500,
    ...Typography.code,
  },
}) satisfies Record<string, TextStyle>;

export type TextRole = keyof typeof TEXT_ROLE_STYLES;

const TEXT_ROLE_CLASSES: Record<string, string> = {
  small: 'text-body-small font-medium text-text',
  smallBold: 'text-body-small font-bold text-text',
  smallSelected: 'text-body-small font-semibold text-accent',
  smallMuted: 'text-body-small font-medium text-text-secondary',
  smallDanger: 'text-body-small font-medium text-danger',
  default: 'text-body-relaxed font-medium text-text',
  bodyBold: 'text-body-relaxed font-bold text-text',
  bodyMuted: 'text-body-relaxed font-medium text-text-secondary',
  title: 'text-display font-semibold text-text',
  subtitle: 'text-title font-semibold text-text',
  subtitleMuted: 'text-title font-semibold text-text-secondary',
  caption: 'text-caption font-medium text-text',
  captionMuted: 'text-caption font-medium text-text-secondary',
  captionCompact: 'text-caption-compact font-medium text-text',
  label: 'text-label font-medium text-text',
  labelBold: 'text-label font-bold text-text',
  labelMuted: 'text-label font-medium text-text-secondary',
  micro: 'text-micro text-text',
  detail: 'text-detail text-text',
  controlValue: 'text-control-value text-text',
  body: 'text-body text-text',
  bodyRelaxed: 'text-body-relaxed text-text',
  controlValueLarge: 'text-control-value-lg text-text',
  bodyLarge: 'text-body-lg text-text',
  controlAction: 'text-control-action text-text',
  headingSmall: 'text-heading-small text-text',
  controlActionLarge: 'text-control-action-lg text-text',
  display: 'text-display text-text',
  link: 'text-link text-accent',
  linkPrimary: 'text-link text-accent',
  code: 'text-code font-mono text-text',
};

const THEME_COLOR_CLASSES: Partial<Record<ThemeColor, string>> = {
  text: 'text-text',
  textSecondary: 'text-text-secondary',
  accent: 'text-accent',
  onAccent: 'text-on-accent',
  background: 'text-background',
  backgroundElement: 'text-background-element',
  backgroundSelected: 'text-background-selected',
  border: 'text-border',
  danger: 'text-danger',
  warning: 'text-warning',
  success: 'text-success',
};

export const TYPOGRAPHY_STYLES = StyleSheet.create(Typography) satisfies Record<string, TextStyle>;

export type ThemedTextProps = TextProps & {
  type?: TextRole | Exclude<keyof typeof Typography, TextRole>;
  themeColor?: ThemeColor;
  className?: string;
};

export function ThemedText({
  style,
  type = 'default',
  themeColor,
  className = '',
  ...rest
}: ThemedTextProps) {
  const roleClass = TEXT_ROLE_CLASSES[type] ?? 'text-body-relaxed font-medium text-text';
  const colorClass = themeColor ? (THEME_COLOR_CLASSES[themeColor] ?? '') : '';

  const mergedClassName = `${roleClass} ${colorClass} ${className}`.trim();

  return (
    <Text
      className={mergedClassName}
      style={[type === 'code' ? { fontFamily: Fonts.mono } : null, style]}
      {...rest}
    />
  );
}
