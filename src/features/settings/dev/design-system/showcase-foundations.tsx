import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import {
  CONTENT_MAX_WIDTH,
  Colors,
  Fonts,
  font,
  IS_TABLET,
  radius,
  SCREEN_W,
  space,
} from '@/components/theme/index';
import { useTheme } from '@/components/theme/ThemeProvider';
import { Button, Txt, type TxtTone, type TxtVariant } from '@/constants/ui';
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
  const { t } = useTranslation();
  const { mode, pref, setPref, colors } = useTheme();

  return (
    <View style={styles.page}>
      <ContractIntro
        title={t('dev.design.foundations.themeTitle')}
        contract={t('dev.design.foundations.themeContract')}
        source={t('dev.design.foundations.themeSource')}
      />
      <Subsection title={t('dev.design.foundations.activeState')}>
        <TokenGrid>
          <TokenItem name="pref" value={pref} />
          <TokenItem name="mode" value={mode} />
        </TokenGrid>
        <View style={styles.buttonStack}>
          <Button
            title={t('dev.design.foundations.system')}
            variant={pref === 'system' ? 'primary' : 'secondary'}
            onPress={() => setPref('system')}
          />
          <Button
            title={t('dev.design.light')}
            variant={pref === 'light' ? 'primary' : 'secondary'}
            onPress={() => setPref('light')}
          />
          <Button
            title={t('dev.design.dark')}
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
            <Txt variant="heading">{t('dev.design.foundations.semanticSurface')}</Txt>
            <Txt tone="secondary">{t('dev.design.foundations.themeChanges')}</Txt>
          </View>
        }
        incorrect={
          <View style={[styles.themePreview, styles.hardcodedPreview]}>
            <Txt color="#20C776" style={styles.badText}>
              {t('dev.design.foundations.hardcodedGreen')}
            </Txt>
            <Txt color="#666666">{t('dev.design.foundations.hardcodedTheme')}</Txt>
          </View>
        }
        correctCode={'const { colors } = useTheme();\n<Surface tone="surface">…</Surface>'}
        incorrectCode={"<View style={{ backgroundColor: '#FFFFFF' }}>…</View>"}
      />
    </View>
  );
}

function ColorShowcase() {
  const { t } = useTranslation();
  const { colors, accent } = useTheme();

  return (
    <View style={styles.page}>
      <ContractIntro
        title={t('dev.design.foundations.colorsTitle')}
        contract={t('dev.design.foundations.colorsContract')}
        source={t('dev.design.foundations.colorsSource')}
      />
      <Subsection title={t('dev.design.foundations.activePalette')}>
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
      <Subsection title={t('dev.design.foundations.canonicalPalette')}>
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
      <Subsection title={t('dev.design.foundations.accents')}>
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
      <ExamplePair
        correct={<Txt tone="success">{t('dev.design.foundations.success')}</Txt>}
        incorrect={<Txt color="#2FBF71">{t('dev.design.foundations.navigationGreen')}</Txt>}
        correctCode={'<Txt tone="success">Erfolgreich gespeichert</Txt>'}
        incorrectCode={'<Txt color="#2FBF71">Übersicht</Txt>'}
      />
    </View>
  );
}

function TypographyShowcase() {
  const { t } = useTranslation();
  const { colors } = useTheme();

  return (
    <View style={styles.page}>
      <ContractIntro
        title={t('dev.design.foundations.typographyTitle')}
        contract={t('dev.design.foundations.typographyContract')}
        source={t('dev.design.foundations.typographySource')}
      />
      <Subsection title={t('dev.design.foundations.allVariants')}>
        <View style={styles.typeList}>
          {TYPOGRAPHY_VARIANTS.map((variant) => (
            <View key={variant} style={[styles.typeRow, { borderBottomColor: colors.border }]}>
              <Txt variant="caption" tone="secondary">
                {variant}
              </Txt>
              <Txt variant={variant}>{t('dev.design.foundations.sampleText')}</Txt>
            </View>
          ))}
        </View>
      </Subsection>
      <Subsection title={t('dev.design.foundations.allTones')}>
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
            <Txt variant="subheading">{t('dev.design.foundations.meal')}</Txt>
            <Txt variant="body" tone="secondary">
              {t('dev.design.foundations.zeroCalories')}
            </Txt>
          </View>
        }
        incorrect={
          <View>
            <Txt style={{ fontSize: 20, lineHeight: 16, fontWeight: '700' }}>
              {t('dev.design.foundations.cutHeading')}
            </Txt>
            <Txt color="#777" style={{ fontSize: 13 }}>
              {t('dev.design.foundations.zeroCalories')}
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
  const { t } = useTranslation();
  const { colors } = useTheme();

  return (
    <View style={styles.page}>
      <ContractIntro
        title={t('dev.design.foundations.tokensTitle')}
        contract={t('dev.design.foundations.tokensContract')}
        source={t('dev.design.foundations.tokensSource')}
      />
      <Subsection title={t('dev.design.foundations.spacing')}>
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
      <Subsection title={t('dev.design.foundations.radii')}>
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
      <Subsection title={t('dev.design.foundations.platformFonts')}>
        <TokenGrid>
          {entries(Fonts ?? {}).map(([name, value]) => (
            <TokenItem key={String(name)} name={`Fonts.${String(name)}`} value={String(value)} />
          ))}
        </TokenGrid>
      </Subsection>
      <Subsection title={t('dev.design.foundations.responsive')}>
        <CodeSample>{`SCREEN_W = ${SCREEN_W}\nIS_TABLET = ${IS_TABLET}\nCONTENT_MAX_WIDTH = ${CONTENT_MAX_WIDTH}\nfont.sizes.base = ${font.sizes.base}`}</CodeSample>
      </Subsection>
      <Subsection title={t('dev.design.foundations.fontSizes')}>
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
      <Subsection title={t('dev.design.foundations.lineHeights')}>
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
      <Subsection title={t('dev.design.foundations.fontWeights')}>
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
            <Txt>{t('dev.design.foundations.spacingFirst')}</Txt>
            <Txt>{t('dev.design.foundations.spacingSecond')}</Txt>
          </View>
        }
        incorrect={
          <View style={{ gap: 11 }}>
            <Txt>{t('dev.design.foundations.spacingFirst')}</Txt>
            <Txt>{t('dev.design.foundations.randomSpacing')}</Txt>
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
});
