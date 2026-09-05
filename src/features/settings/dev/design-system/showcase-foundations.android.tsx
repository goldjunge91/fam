import { StyleSheet, View } from 'react-native';

import { GradientBackground } from '@/components/layout/gradient-background';
import {
  BUTTON_DEPTH,
  CONTENT_MAX_WIDTH,
  Colors,
  Fonts,
  font,
  Gradients,
  IS_TABLET,
  legacyWaivyColors,
  makeCategoryTone,
  radius,
  SCREEN_W,
  shadow,
  space,
} from '@/components/theme/index';
import { useTheme } from '@/components/theme/ThemeProvider';
import { Button } from '@/components/ui/buttons';
import { Txt, type TxtTone, type TxtVariant } from '@/constants/ui';
import {
  CodeSample,
  ContractIntro,
  ExamplePair,
  Subsection,
  TokenGrid,
  TokenItem,
} from './showcase-shared';

export type FoundationCategory = 'theme' | 'colors' | 'typography' | 'tokens';

const TYPOGRAPHY_VARIANTS = [
  'display',
  'title',
  'heading',
  'subheading',
  'body',
  'label',
  'caption',
] as const satisfies readonly TxtVariant[];

const TEXT_TONES = [
  'primary',
  'secondary',
  'accent',
  'onAccent',
  'success',
  'warning',
  'danger',
  'inverse',
] as const satisfies readonly TxtTone[];

function entries<T extends object>(value: T) {
  return Object.entries(value) as [keyof T, T[keyof T]][];
}

export function FoundationsShowcase({ category }: { category: FoundationCategory }) {
  if (category === 'theme') return <ThemeShowcase />;
  if (category === 'colors') return <ColorShowcase />;
  if (category === 'typography') return <TypographyShowcase />;
  return <TokenShowcase />;
}

function ThemeShowcase() {
  const { mode, pref, setPref, colors } = useTheme();

  return (
    <View style={styles.page}>
      <ContractIntro
        title="Theme-Laufzeit"
        contract="System, Hell und Dunkel werden ausschließlich vom ThemeProvider aufgelöst. Komponenten lesen semantische Farben über useTheme()."
        source="ThemeProvider.tsx und index.ts"
      />
      <Subsection title="Aktiver Zustand">
        <TokenGrid>
          <TokenItem name="pref" value={pref} />
          <TokenItem name="mode" value={mode} />
        </TokenGrid>
        <View style={styles.buttonStack}>
          <Button
            label="System"
            variant={pref === 'system' ? 'primary' : 'secondary'}
            onPress={() => setPref('system')}
          />
          <Button
            label="Hell"
            variant={pref === 'light' ? 'primary' : 'secondary'}
            onPress={() => setPref('light')}
          />
          <Button
            label="Dunkel"
            variant={pref === 'dark' ? 'primary' : 'secondary'}
            onPress={() => setPref('dark')}
          />
        </View>
      </Subsection>
      <ExamplePair
        correct={
          <View
            style={[
              styles.themePreview,
              { backgroundColor: colors.backgroundElement, borderColor: colors.border },
            ]}>
            <Txt variant="heading">Semantische Oberfläche</Txt>
            <Txt tone="secondary">Wechselt vollständig mit dem aktiven Theme.</Txt>
          </View>
        }
        incorrect={
          <View style={[styles.themePreview, styles.hardcodedPreview]}>
            <Txt color="#20C776" style={styles.badText}>
              Fest verdrahtetes Grün
            </Txt>
            <Txt color="#666666">Bleibt unabhängig vom Theme gleich.</Txt>
          </View>
        }
        correctCode={'const { colors } = useTheme();\n<Surface tone="surface">…</Surface>'}
        incorrectCode={"<View style={{ backgroundColor: '#FFFFFF' }}>…</View>"}
      />
    </View>
  );
}

function ColorShowcase() {
  const { colors, accent } = useTheme();
  const categoryTones = makeCategoryTone(colors);

  return (
    <View style={styles.page}>
      <ContractIntro
        title="Farben und Töne"
        contract="Screens wählen eine semantische Rolle. Produktbereiche verwenden Accent- oder Category-Tones, aber keine zufälligen Hexwerte."
        source="index.ts: Palette, makeAccent(), makeCategoryTone()"
      />
      <Subsection title="Aktive Palette">
        <TokenGrid>
          {entries(colors).map(([name, value]) => (
            <TokenItem
              key={String(name)}
              name={String(name)}
              value={String(value)}
              color={String(value)}
            />
          ))}
        </TokenGrid>
      </Subsection>
      <Subsection title="Kanonische Fam-Palette: Hell und Dunkel">
        <TokenGrid>
          {entries(Colors.light).map(([name, lightValue]) => {
            const darkValue = Colors.dark[name];
            return (
              <TokenItem
                key={String(name)}
                name={String(name)}
                value={`${lightValue} · ${darkValue}`}
                preview={
                  <View style={styles.colorPair}>
                    <View style={[styles.colorHalf, { backgroundColor: lightValue }]} />
                    <View style={[styles.colorHalf, { backgroundColor: darkValue }]} />
                  </View>
                }
              />
            );
          })}
        </TokenGrid>
      </Subsection>
      <Subsection title="Akzente">
        <TokenGrid>
          {entries(accent).map(([name, value]) => (
            <TokenItem
              key={String(name)}
              name={String(name)}
              value={`${value.main} · ${value.tint}`}
              color={value.main}
            />
          ))}
        </TokenGrid>
      </Subsection>
      <Subsection title="Lebensmittel-Kategorien">
        <TokenGrid>
          {entries(categoryTones).map(([name, value]) => (
            <TokenItem
              key={String(name)}
              name={String(name)}
              value={`${value.icon} · ${value.color}`}
              color={value.tint}
            />
          ))}
        </TokenGrid>
      </Subsection>
      <Subsection title="Legacy-Waivy-Referenz, nicht aktiv">
        <Txt variant="body" tone="secondary">
          Diese Werte bleiben nur für Migration und Vergleich erhalten. Produktcode verwendet sie
          nicht als Standardpalette.
        </Txt>
        <TokenGrid>
          {entries(legacyWaivyColors.light).map(([name, lightValue]) => {
            const darkValue = legacyWaivyColors.dark[name];
            return (
              <TokenItem
                key={String(name)}
                name={String(name)}
                value={`${lightValue} · ${darkValue}`}
                preview={
                  <View style={styles.colorPair}>
                    <View style={[styles.colorHalf, { backgroundColor: lightValue }]} />
                    <View style={[styles.colorHalf, { backgroundColor: darkValue }]} />
                  </View>
                }
              />
            );
          })}
        </TokenGrid>
      </Subsection>
      <ExamplePair
        correct={<Txt tone="success">Erfolgreich gespeichert</Txt>}
        incorrect={<Txt color="#2FBF71">Grün bedeutet hier versehentlich Navigation</Txt>}
        correctCode={'<Txt tone="success">Erfolgreich gespeichert</Txt>'}
        incorrectCode={'<Txt color="#2FBF71">Übersicht</Txt>'}
      />
    </View>
  );
}

function TypographyShowcase() {
  const { colors } = useTheme();

  return (
    <View style={styles.page}>
      <ContractIntro
        title="Typografie"
        contract="Schriftgröße, Zeilenhöhe und Standardgewicht kommen gemeinsam aus einer Txt-Variante. Tone beschreibt Bedeutung, nicht Dekoration."
        source="ui.tsx: Txt, TxtVariant und TxtTone"
      />
      <Subsection title="Alle Varianten">
        <View style={styles.typeList}>
          {TYPOGRAPHY_VARIANTS.map((variant) => (
            <View key={variant} style={[styles.typeRow, { borderBottomColor: colors.border }]}>
              <Txt variant="caption" tone="secondary">
                {variant}
              </Txt>
              <Txt variant={variant}>
                Franz jagt im komplett verwahrlosten Taxi quer durch Bayern.
              </Txt>
            </View>
          ))}
        </View>
      </Subsection>
      <Subsection title="Alle Töne">
        <View style={[styles.toneBox, { backgroundColor: colors.accent }]}>
          {TEXT_TONES.map((tone) => (
            <Txt key={tone} tone={tone} variant="body" weight="600">
              {tone}
            </Txt>
          ))}
        </View>
      </Subsection>
      <ExamplePair
        correct={
          <View>
            <Txt variant="subheading">Mahlzeit</Txt>
            <Txt variant="body" tone="secondary">
              0 kcal
            </Txt>
          </View>
        }
        incorrect={
          <View>
            <Txt style={{ fontSize: 20, lineHeight: 16, fontWeight: '700' }}>
              Abgeschnittene Überschrift
            </Txt>
            <Txt color="#777" style={{ fontSize: 13 }}>
              0 kcal
            </Txt>
          </View>
        }
        correctCode={
          '<Txt variant="subheading">Mahlzeit</Txt>\n<Txt variant="body" tone="secondary">0 kcal</Txt>'
        }
        incorrectCode={'<Txt style={{ fontSize: 20, lineHeight: 16 }}>Mahlzeit</Txt>'}
      />
    </View>
  );
}

function TokenShowcase() {
  const { mode, colors } = useTheme();
  const gradient = Gradients.hub[mode];

  return (
    <View style={styles.page}>
      <ContractIntro
        title="Abstände, Formen und Effekte"
        contract="Wiederkehrende Maße stammen aus Tokens. Layout bleibt in NativeWind oder StyleSheet; dynamische Farben kommen aus dem Theme."
        source="index.ts: space, radius, shadow, font, Gradients und responsive Werte"
      />
      <Subsection title="Spacing">
        <TokenGrid>
          {entries(space).map(([name, value]) => (
            <TokenItem
              key={String(name)}
              name={`space.${String(name)}`}
              value={`${value}px`}
              preview={
                <View
                  style={[
                    styles.spacePreview,
                    { width: Math.max(4, value), backgroundColor: colors.accent },
                  ]}
                />
              }
            />
          ))}
        </TokenGrid>
      </Subsection>
      <Subsection title="Radien">
        <TokenGrid>
          {entries(radius).map(([name, value]) => (
            <TokenItem
              key={String(name)}
              name={`radius.${String(name)}`}
              value={`${value}`}
              preview={
                <View
                  style={[
                    styles.radiusPreview,
                    { borderRadius: value, backgroundColor: colors.backgroundSoft },
                  ]}
                />
              }
            />
          ))}
        </TokenGrid>
      </Subsection>
      <Subsection title="Schatten und 3D-Tiefe">
        <TokenGrid>
          {entries(shadow).map(([name, value]) => (
            <TokenItem
              key={String(name)}
              name={`shadow.${String(name)}`}
              value={`elevation ${value.elevation}`}
              preview={
                <View
                  style={[
                    styles.shadowPreview,
                    value,
                    { backgroundColor: colors.backgroundElement, shadowColor: colors.shadowCard },
                  ]}
                />
              }
            />
          ))}
          <TokenItem
            name="BUTTON_DEPTH"
            value={`${BUTTON_DEPTH}px`}
            preview={
              <View
                style={[
                  styles.depthPreview,
                  {
                    borderBottomWidth: BUTTON_DEPTH,
                    borderColor: colors.shadowCard,
                    backgroundColor: colors.accent,
                  },
                ]}
              />
            }
          />
        </TokenGrid>
      </Subsection>
      <Subsection title="Verlauf und Plattformfonts">
        <View style={[styles.gradientPreview, { borderColor: colors.border }]}>
          <GradientBackground {...gradient} />
          <Txt variant="heading">Gradients.hub.{mode}</Txt>
        </View>
        <TokenGrid>
          {entries(Fonts ?? {}).map(([name, value]) => (
            <TokenItem key={String(name)} name={`Fonts.${String(name)}`} value={String(value)} />
          ))}
        </TokenGrid>
      </Subsection>
      <Subsection title="Responsive Werte">
        <CodeSample>{`SCREEN_W = ${SCREEN_W}\nIS_TABLET = ${IS_TABLET}\nCONTENT_MAX_WIDTH = ${CONTENT_MAX_WIDTH}\nfont.sizes.base = ${font.sizes.base}`}</CodeSample>
      </Subsection>
      <Subsection title="Font-Größen">
        <TokenGrid>
          {entries(font.sizes).map(([name, value]) => (
            <TokenItem
              key={String(name)}
              name={`font.sizes.${String(name)}`}
              value={`${value}px`}
              preview={
                <View style={[styles.fontPreview, { backgroundColor: colors.backgroundSoft }]}>
                  <Txt style={{ fontSize: value, lineHeight: Math.ceil(value * 1.2) }}>Aa</Txt>
                </View>
              }
            />
          ))}
        </TokenGrid>
      </Subsection>
      <Subsection title="Zeilenhöhen">
        <TokenGrid>
          {entries(font.lineHeights).map(([name, value]) => (
            <TokenItem
              key={String(name)}
              name={`font.lineHeights.${String(name)}`}
              value={`${value}px`}
              preview={
                <View
                  style={[styles.lineHeightPreview, { backgroundColor: colors.backgroundSoft }]}>
                  <Txt style={{ fontSize: 12, lineHeight: value }}>{'Aa\nBb'}</Txt>
                </View>
              }
            />
          ))}
        </TokenGrid>
      </Subsection>
      <Subsection title="Schriftgewichte">
        <TokenGrid>
          {entries(font.weight).map(([name, value]) => (
            <TokenItem
              key={String(name)}
              name={`font.weight.${String(name)}`}
              value={value}
              preview={
                <View style={[styles.fontPreview, { backgroundColor: colors.backgroundSoft }]}>
                  <Txt style={{ fontSize: 24, lineHeight: 30, fontWeight: value }}>Aa</Txt>
                </View>
              }
            />
          ))}
        </TokenGrid>
      </Subsection>
      <ExamplePair
        correct={
          <View style={{ gap: space.md }}>
            <Txt>Erste Zeile</Txt>
            <Txt>Zweite Zeile</Txt>
          </View>
        }
        incorrect={
          <View style={{ gap: 11 }}>
            <Txt>Erste Zeile</Txt>
            <Txt>Zufälliger Abstand: 11</Txt>
          </View>
        }
        correctCode={'<View style={{ gap: space.md }}>…</View>'}
        incorrectCode={'<View style={{ gap: 11 }}>…</View>'}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  page: { gap: space.xxl },
  buttonStack: { gap: space.sm },
  themePreview: { borderWidth: 1, borderRadius: radius.md, padding: space.lg, gap: space.xs },
  hardcodedPreview: { backgroundColor: '#FFFFFF', borderColor: '#DDDDDD' },
  badText: { fontWeight: '700' },
  colorPair: {
    height: 48,
    flexDirection: 'row',
    overflow: 'hidden',
    borderRadius: radius.sm,
  },
  colorHalf: { flex: 1 },
  fontPreview: {
    minHeight: 72,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  lineHeightPreview: {
    minHeight: 120,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  typeList: { gap: 0 },
  typeRow: {
    gap: space.xs,
    paddingVertical: space.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  toneBox: { borderRadius: radius.md, padding: space.lg, gap: space.sm },
  spacePreview: { height: 28, minWidth: 4, borderRadius: radius.sm },
  radiusPreview: { height: 48, width: '100%' },
  shadowPreview: { height: 48, width: '100%', borderRadius: radius.md },
  depthPreview: { height: 48, width: '100%', borderRadius: radius.md },
  gradientPreview: {
    minHeight: 120,
    overflow: 'hidden',
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: space.lg,
    justifyContent: 'center',
  },
});
