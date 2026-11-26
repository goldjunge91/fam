import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { BackButton } from '@/components/layout/back-button';
import { ProfileButton } from '@/components/layout/profile-button';
import { withAlpha } from '@/components/theme/index';
import { useTheme } from '@/components/theme/ThemeProvider';
import { MenuButton } from '@/components/ui/menu-button';
import { Button, Pill, Press, Surface, Txt } from '@/constants/ui';
import { CodeSample, ContractIntro, ExamplePair, Subsection } from './showcase-shared';

export type PatternCategory = 'screens' | 'hybrid' | 'accessibility';

export function PatternsShowcase({ category }: { category: PatternCategory }) {
  if (category === 'screens') return <ScreenShowcase />;
  if (category === 'hybrid') return <HybridShowcase />;
  return <AccessibilityShowcase />;
}

function ScreenShowcase() {
  const { t } = useTranslation();
  return (
    <View style={styles.page}>
      <ContractIntro
        title={t('dev.design.patterns.screensTitle')}
        contract={t('dev.design.patterns.screensContract')}
        source={t('dev.design.patterns.screensSource')}
      />
      <Subsection title={t('dev.design.patterns.mainChrome')}>
        <Surface tone="surface" style={styles.phoneFrame}>
          <View style={styles.chromeRow}>
            <MenuButton onPress={() => undefined} />
            <View style={styles.chromeTitle}>
              <Txt variant="caption" tone="secondary" center>
                {t('dev.design.patterns.household')}
              </Txt>
              <Txt variant="title" center>
                {t('dev.design.patterns.inventory')}
              </Txt>
            </View>
            <ProfileButton initials="MF" onPress={() => undefined} />
          </View>
          <Txt tone="secondary">{t('dev.design.patterns.screenBehavior')}</Txt>
        </Surface>
      </Subsection>
      <Subsection title={t('dev.design.patterns.subpage')}>
        <Surface tone="surface" style={styles.phoneFrame}>
          <BackButton
            label={t('dev.design.patterns.inventory')}
            href="/fridge"
            variant="arrow"
            onPress={() => undefined}
          />
          <View>
            <Txt variant="title">{t('dev.design.patterns.editProduct')}</Txt>
            <Txt tone="secondary">{t('dev.design.patterns.adjustDetails')}</Txt>
          </View>
        </Surface>
      </Subsection>
      <ExamplePair
        correct={
          <View style={styles.stack}>
            <Txt variant="subheading">{t('dev.design.patterns.headerContract')}</Txt>
            <Txt tone="secondary">{t('dev.design.patterns.headerRoles')}</Txt>
          </View>
        }
        incorrect={
          <View style={styles.fakeHeader}>
            <Txt color="#00B86B">‹</Txt>
            <Txt color="#111111" style={{ fontSize: 27 }}>
              Vorrat
            </Txt>
            <Txt color="#00B86B">+</Txt>
          </View>
        }
        correctCode={
          '<Screen title="Vorrat" chrome={{ onMenuPress, onAvatarPress, initials }}>…</Screen>'
        }
        incorrectCode={'<View><Text>‹</Text><Text style={{ fontSize: 27 }}>Vorrat</Text></View>'}
      />
      <CodeSample>
        {
          "chrome und back niemals kombinieren.\nFallback-Ziel: back={{ label: 'Vorrat', href: '/fridge' }}"
        }
      </CodeSample>
    </View>
  );
}

function HybridShowcase() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const overlay = withAlpha(colors.shadowSheet, 0.45);

  return (
    <View style={styles.page}>
      <ContractIntro
        title={t('dev.design.patterns.hybridTitle')}
        contract={t('dev.design.patterns.hybridContract')}
        source={t('dev.design.patterns.hybridSource')}
      />
      <Subsection title={t('dev.design.patterns.division')}>
        <ExamplePair
          correct={
            <Surface tone="soft" style={styles.hybridCorrect}>
              <View style={styles.hybridDot} />
              <Txt variant="body">{t('dev.design.patterns.staticLayout')}</Txt>
            </Surface>
          }
          incorrect={
            <View style={styles.conflictBox}>
              <Txt tone="danger">{t('dev.design.patterns.dynamicClasses')}</Txt>
            </View>
          }
          correctCode={'<Surface tone="soft" style={styles.row} />'}
          incorrectCode={'<View style={{ backgroundColor: dynamicColor }}>…</View>'}
        />
      </Subsection>
      <Subsection title={t('dev.design.patterns.transparency')}>
        <View style={[styles.overlayBase, { backgroundColor: colors.backgroundSoft }]}>
          <View style={[styles.overlay, { backgroundColor: overlay }]}>
            <Txt tone="inverse" weight="700">
              withAlpha(colors.shadowSheet, 0.45)
            </Txt>
          </View>
        </View>
        <CodeSample>{'const overlay = withAlpha(colors.shadowSheet, 0.45);'}</CodeSample>
      </Subsection>
      <Subsection title={t('dev.design.patterns.decisionRule')}>
        <View style={styles.ruleList}>
          <Rule number="1" text={t('dev.design.patterns.rule1')} />
          <Rule number="2" text={t('dev.design.patterns.rule2')} />
          <Rule number="3" text={t('dev.design.patterns.rule3')} />
        </View>
      </Subsection>
    </View>
  );
}

function AccessibilityShowcase() {
  const { t } = useTranslation();
  return (
    <View style={styles.page}>
      <ContractIntro
        title={t('dev.design.patterns.accessibilityTitle')}
        contract={t('dev.design.patterns.accessibilityContract')}
        source={t('dev.design.patterns.accessibilitySource')}
      />
      <Subsection title={t('dev.design.patterns.interactionStates')}>
        <View style={styles.stack}>
          <Button title={t('dev.design.patterns.ready')} onPress={() => undefined} />
          <Button title={t('dev.design.patterns.saving')} loading onPress={() => undefined} />
          <Button title={t('dev.design.patterns.unavailable')} disabled onPress={() => undefined} />
          <View style={styles.wrap}>
            <Pill label={t('dev.design.patterns.selected')} selected onPress={() => undefined} />
            <Pill label={t('dev.design.patterns.disabled')} disabled onPress={() => undefined} />
          </View>
        </View>
      </Subsection>
      <ExamplePair
        correct={
          <Press
            accessibilityRole="button"
            accessibilityLabel="Eintrag hinzufügen"
            accessibilityState={{ disabled: false }}
            style={styles.goodTarget}>
            <Txt tone="onAccent" weight="700">
              Eintrag hinzufügen
            </Txt>
          </Press>
        }
        incorrect={
          <View style={styles.badA11yRow}>
            <Press accessibilityLabel="Absichtlich zu kleines Ziel" style={styles.tinyTarget}>
              <Txt color="#20C776">+</Txt>
            </Press>
            <View style={[styles.colorOnlyState, { backgroundColor: '#20C776' }]} />
            <Txt color="#777777">Nur Farbe zeigt den Zustand.</Txt>
          </View>
        }
        correctCode={
          '<Press accessibilityRole="button" accessibilityLabel="Eintrag hinzufügen" accessibilityState={{ disabled }}>…</Press>'
        }
        incorrectCode={'<Press style={{ width: 20, height: 20 }}><Text>+</Text></Press>'}
      />
      <Subsection title="Text und Vergrößerung">
        <Surface tone="soft" style={styles.readableText}>
          <Txt variant="body">
            Txt kombiniert Schriftgröße und Zeilenhöhe, damit Inhalte bei größeren
            Systemeinstellungen lesbar bleiben.
          </Txt>
        </Surface>
      </Subsection>
    </View>
  );
}

function Rule({ number, text }: { number: string; text: string }) {
  return (
    <View style={styles.rule}>
      <View style={styles.ruleNumber}>
        <Txt variant="label" tone="onAccent">
          {number}
        </Txt>
      </View>
      <Txt style={styles.ruleText}>{text}</Txt>
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  page: { gap: theme.space.xxl },
  stack: { gap: theme.space.md },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.space.sm },
  phoneFrame: {
    borderWidth: theme.borderWidth.base,
    borderColor: theme.border,
    borderRadius: theme.radius.lg,
    padding: theme.space.lg,
    gap: theme.space.lg,
  },
  chromeRow: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.space.sm,
  },
  chromeTitle: { flex: 1 },
  fakeHeader: {
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 5,
  },
  hybridCorrect: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space.sm,
    padding: theme.space.lg,
    borderRadius: theme.radius.md,
  },
  hybridDot: {
    width: theme.space.md,
    height: theme.space.md,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.accent,
  },
  conflictBox: {
    borderWidth: 3,
    borderColor: theme.danger,
    borderRadius: 3,
    padding: 11,
    backgroundColor: '#FFFFFF',
  },
  overlayBase: {
    height: 120,
    borderRadius: theme.radius.lg,
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  overlay: { padding: theme.space.lg },
  ruleList: { gap: theme.space.md },
  rule: { flexDirection: 'row', alignItems: 'flex-start', gap: theme.space.md },
  ruleNumber: {
    width: 28,
    height: 28,
    borderRadius: theme.radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.accent,
  },
  ruleText: { flex: 1 },
  goodTarget: {
    minHeight: 44,
    borderRadius: theme.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.space.lg,
    backgroundColor: theme.accent,
  },
  badA11yRow: { flexDirection: 'row', alignItems: 'center', gap: theme.space.sm },
  tinyTarget: { width: 20, height: 20, alignItems: 'center', justifyContent: 'center' },
  colorOnlyState: { width: 14, height: 14, borderRadius: theme.radius.pill },
  readableText: { borderRadius: theme.radius.md, padding: theme.space.lg },
}));
