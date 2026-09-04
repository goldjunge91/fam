// TODO: DELETE — maintainer removes this compatibility wrapper after the migration is reviewed.
import { Text, type TextProps, type TextStyle } from 'react-native';

import { Fonts, type ThemeColor } from '@/components/theme/index';

/**
 * Einzige Quelle fuer feste Schriftgroessen in der App.
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

const TEXT_ROLE_CLASS_MAP = {
  // 16px statt der frueheren 14px (text-body-small) — die "small"-Rolle
  // traegt fast den gesamten Fliesstext der App (Listenzeilen, Metadaten,
  // Sekundaertexte) und wurde als zu klein empfunden. Deckt sich jetzt mit
  // "default"/"body-relaxed", kein neuer Groessenwert im System.
  small: 'text-body-relaxed font-medium text-text',
  smallBold: 'text-body-relaxed font-bold text-text',
  smallSelected: 'text-body-relaxed font-semibold text-accent',
  smallMuted: 'text-body-relaxed font-medium text-text-secondary',
  smallDanger: 'text-body-relaxed font-medium text-danger',
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
} as const;

export type TextRole = keyof typeof TEXT_ROLE_CLASS_MAP;

const TEXT_ROLE_CLASSES: Record<string, string> = TEXT_ROLE_CLASS_MAP;

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

export const TYPOGRAPHY_STYLES = Typography satisfies Record<string, TextStyle>;

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
