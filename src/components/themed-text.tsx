import { Platform, StyleSheet, Text, type TextProps } from 'react-native';

import { Fonts, type ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

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

export type ThemedTextProps = TextProps & {
  type?: 'default' | 'title' | 'small' | 'smallBold' | 'subtitle' | 'link' | 'linkPrimary' | 'code';
  themeColor?: ThemeColor;
};

export function ThemedText({ style, type = 'default', themeColor, ...rest }: ThemedTextProps) {
  const theme = useTheme();

  return (
    <Text
      style={[
        { color: theme[themeColor ?? (type === 'linkPrimary' ? 'accent' : 'text')] },
        type === 'default' && styles.default,
        type === 'title' && styles.title,
        type === 'small' && styles.small,
        type === 'smallBold' && styles.smallBold,
        type === 'subtitle' && styles.subtitle,
        type === 'link' && styles.link,
        type === 'linkPrimary' && styles.linkPrimary,
        type === 'code' && styles.code,
        style,
      ]}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  small: {
    ...Typography.bodySmall,
    fontWeight: 500,
  },
  smallBold: {
    ...Typography.bodySmall,
    fontWeight: 700,
  },
  default: {
    ...Typography.bodyRelaxed,
    fontWeight: 500,
  },
  title: {
    ...Typography.display,
    fontWeight: 600,
  },
  subtitle: {
    ...Typography.title,
    fontWeight: 600,
  },
  link: {
    ...Typography.link,
  },
  linkPrimary: {
    ...Typography.link,
  },
  code: {
    fontFamily: Fonts.mono,
    fontWeight: Platform.select({ android: 700 }) ?? 500,
    ...Typography.code,
  },
});
