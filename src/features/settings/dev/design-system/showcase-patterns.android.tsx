import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { withAlpha } from '@/components/theme/index';
import { useTheme } from '@/components/theme/ThemeProvider';
import { BackButton, MenuButton, ProfileButton } from '@/components/ui/buttons';
import { Button, Pill, Press, Surface, Txt } from '@/constants/ui';
import { CodeSample, ContractIntro, ExamplePair, Subsection } from './showcase-shared';

export type PatternCategory = 'screens' | 'hybrid' | 'accessibility';

export function PatternsShowcase({ category }: { category: PatternCategory }) {
  if (category === 'screens') return <ScreenShowcase />;
  if (category === 'hybrid') return <HybridShowcase />;
  return <AccessibilityShowcase />;
}

function ScreenShowcase() {
  return (
    <View style={styles.page}>
      <ContractIntro
        title="Screens und Navigation"
        contract="Screen besitzt Safe Area, Hintergrund, Inhaltsbreite, Scrollen und Header. chrome ist für Hauptbereiche, back für Unterseiten."
        source="components/layout/screen.tsx"
      />
      <Subsection title="Hauptbereich mit chrome">
        <Surface tone="surface" style={styles.phoneFrame}>
          <View style={styles.chromeRow}>
            <MenuButton onPress={() => undefined} />
            <View style={styles.chromeTitle}>
              <Txt variant="caption" tone="secondary" center>
                Gemeinsamer Haushalt
              </Txt>
              <Txt variant="title" center>
                Vorrat
              </Txt>
            </View>
            <ProfileButton initials="MF" onPress={() => undefined} />
          </View>
          <Txt tone="secondary">
            Der echte Screen übernimmt Safe Area und Scrollverhalten außerhalb dieser Vorschau.
          </Txt>
        </Surface>
      </Subsection>
      <Subsection title="Unterseite mit back">
        <Surface tone="surface" style={styles.phoneFrame}>
          <BackButton label="Vorrat" href="/fridge" variant="arrow" onPress={() => undefined} />
          <View>
            <Txt variant="title">Produkt bearbeiten</Txt>
            <Txt tone="secondary">Details und Menge anpassen</Txt>
          </View>
        </Surface>
      </Subsection>
      <ExamplePair
        correct={
          <View style={styles.stack}>
            <Txt variant="subheading">Ein Header-Vertrag</Txt>
            <Txt tone="secondary">Navigation, Titel und Aktion bleiben in festen Rollen.</Txt>
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
  const { colors } = useTheme();
  const overlay = withAlpha(colors.shadowSheet, 0.45);

  return (
    <View style={styles.page}>
      <ContractIntro
        title="Unistyles und StyleSheet"
        contract="Statisches Layout, Themewerte, berechnete Maße, native Spezialwerte und Fremdkomponenten laufen über typisierte Styles."
        source="SPEC-native-boundaries.md"
      />
      <Subsection title="Aufgabenteilung">
        <ExamplePair
          correct={
            <Surface tone="soft" style={styles.hybridCorrect}>
              <View style={styles.hybridDot} />
              <Txt variant="body">Statisches Layout, dynamische Farbe</Txt>
            </Surface>
          }
          incorrect={
            <View style={styles.conflictBox}>
              <Txt tone="danger">Dynamische Klassen und widersprüchliche Quellen</Txt>
            </View>
          }
          correctCode={'<Surface tone="soft" style={styles.row} />'}
          incorrectCode={'<View style={{ backgroundColor: dynamicColor }}>…</View>'}
        />
      </Subsection>
      <Subsection title="Transparenz aus einer Themefarbe">
        <View style={[styles.overlayBase, { backgroundColor: colors.backgroundSoft }]}>
          <View style={[styles.overlay, { backgroundColor: overlay }]}>
            <Txt tone="inverse" weight="700">
              withAlpha(colors.shadowSheet, 0.45)
            </Txt>
          </View>
        </View>
        <CodeSample>{'const overlay = withAlpha(colors.shadowSheet, 0.45);'}</CodeSample>
      </Subsection>
      <Subsection title="Entscheidungsregel">
        <View style={styles.ruleList}>
          <Rule number="1" text="Ist der Wert statisch? Zentrale Layout-Styles verwenden." />
          <Rule
            number="2"
            text="Kommt der Wert aus dem Theme oder aus Daten? style oder useThemedStyles()."
          />
          <Rule
            number="3"
            text="Wiederholt sich die Semantik? Als Token oder Komponente zentralisieren."
          />
        </View>
      </Subsection>
    </View>
  );
}

function AccessibilityShowcase() {
  return (
    <View style={styles.page}>
      <ContractIntro
        title="Accessibility und Zustände"
        contract="Interaktive Elemente haben Rolle, verständliche Beschriftung, mindestens 44 Punkte Zielgröße und einen sichtbaren Zustand, der nicht nur aus Farbe besteht."
        source="UI-Verträge und React-Native-Accessibility"
      />
      <Subsection title="Interaktionszustände">
        <View style={styles.stack}>
          <Button title="Bereit" onPress={() => undefined} />
          <Button title="Speichert" loading onPress={() => undefined} />
          <Button title="Nicht verfügbar" disabled onPress={() => undefined} />
          <View style={styles.wrap}>
            <Pill label="Ausgewählt ✓" selected onPress={() => undefined} />
            <Pill label="Deaktiviert" disabled onPress={() => undefined} />
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
