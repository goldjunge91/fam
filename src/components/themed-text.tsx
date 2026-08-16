import { Platform, StyleSheet, Text, type TextProps, type TextStyle } from 'react-native';

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
  subheading: { ...FontSize[20], lineHeight: 26 },
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
  default: { ...Typography.bodyRelaxed, fontWeight: 500 },
  title: { ...Typography.display, fontWeight: 600 },
  subtitle: { ...Typography.title, fontWeight: 600 },
  link: { ...Typography.link },
  linkPrimary: { ...Typography.link },
  code: {
    fontFamily: Fonts.mono,
    fontWeight: Platform.select({ android: 700 }) ?? 500,
    ...Typography.code,
  },
}) satisfies Record<string, TextStyle>;

type TextRole = keyof typeof TEXT_ROLE_STYLES;

/**
 * Jeder `Typography`-Token ist automatisch als `type`-Wert nutzbar (#122) —
 * ein Screen muss `Typography.*` nicht mehr manuell in ein `style`-Objekt
 * spreaden, um z. B. `type="label"` oder `type="bodyLarge"` zu bekommen. Ein
 * neuer `Typography`-Eintrag steht dadurch ohne weitere Aenderung hier zur
 * Verfuegung.
 *
 * `fontWeight` ist bewusst nicht Teil dieses Mappings, weil Groesse und
 * Gewicht zwei unabhaengige Achsen sind: dieselbe Groesse taucht in den
 * Referenz-Screens mit unterschiedlichem Gewicht auf (z. B. Dashboard-Label
 * 400 vs. PageHeader-Untertitel 600 — beide `label`-grosse Schrift). Wuerde
 * jede Groesse ein festes Gewicht bekommen, muesste jede Kombination aus
 * Groesse × Gewicht einen eigenen `type`-Namen haben (`label`, `labelBold`,
 * `caption`, `captionBold`, …) — eine Vervielfachung der Varianten fuer
 * denselben Zweck, den ein einfacher `style={{ fontWeight: ... }}`-Override
 * bereits abdeckt (RN mergt Style-Arrays, der Override gewinnt).
 */
const TYPOGRAPHY_STYLES = StyleSheet.create(Typography) satisfies Record<string, TextStyle>;

export type ThemedTextProps = TextProps & {
  type?: TextRole | Exclude<keyof typeof Typography, TextRole>;
  themeColor?: ThemeColor;
};

export function ThemedText({ style, type = 'default', themeColor, ...rest }: ThemedTextProps) {
  const theme = useTheme();
  const typeStyle =
    type in TEXT_ROLE_STYLES
      ? TEXT_ROLE_STYLES[type as TextRole]
      : TYPOGRAPHY_STYLES[type as keyof typeof Typography];

  return (
    <Text
      style={[
        { color: theme[themeColor ?? (type === 'linkPrimary' ? 'accent' : 'text')] },
        typeStyle,
        style,
      ]}
      {...rest}
    />
  );
}
