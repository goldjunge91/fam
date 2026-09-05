import { Pressable, StyleSheet, View } from 'react-native';

import { radius, space, withAlpha } from '@/components/theme/index';
import { useTheme } from '@/components/theme/ThemeProvider';
import { BackButton, Button, MenuButton, ProfileButton } from '@/components/ui/buttons';
import { Pill, Surface, Txt } from '@/constants/ui';
import { CodeSample, ContractIntro, ExamplePair, Subsection } from './showcase-shared';

export type PatternCategory = 'screens' | 'hybrid' | 'accessibility';

export function PatternsShowcase({ category }: { category: PatternCategory }) {
  if (category === 'screens') return <ScreenShowcase />;
  if (category === 'hybrid') return <HybridShowcase />;
  return <AccessibilityShowcase />;
}

function ScreenShowcase() {
  const { colors } = useTheme();

  return (
    <View style={styles.page}>
      <ContractIntro
        title="Screens und Navigation"
        contract="Screen besitzt Safe Area, Hintergrund, Inhaltsbreite, Scrollen und Header. chrome ist für Hauptbereiche, back für Unterseiten."
        source="components/layout/screen.tsx"
      />
      <Subsection title="Hauptbereich mit chrome">
        <Surface tone="surface" style={[styles.phoneFrame, { borderColor: colors.border }]}>
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
        <Surface tone="surface" style={[styles.phoneFrame, { borderColor: colors.border }]}>
          <BackButton label="Vorrat" href="/inventory" variant="arrow" onPress={() => undefined} />
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
          "chrome und back niemals kombinieren.\nFallback-Ziel: back={{ label: 'Vorrat', href: '/inventory' }}"
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
        title="NativeWind und StyleSheet"
        contract="NativeWind beschreibt statisches Layout. Themewerte, berechnete Maße, native Spezialwerte und Fremdkomponenten laufen über typisierte Styles."
        source="SPEC-native-boundaries.md"
      />
      <Subsection title="Aufgabenteilung">
        <ExamplePair
          correct={
            <View
              className="flex-row items-center gap-two p-three rounded-card"
              style={{ backgroundColor: colors.backgroundSoft }}>
              <View className="w-3 h-3 rounded-full" style={{ backgroundColor: colors.accent }} />
              <Txt variant="body">Statisches Layout, dynamische Farbe</Txt>
            </View>
          }
          incorrect={
            <View style={[styles.conflictBox, { borderColor: colors.danger }]}>
              <Txt tone="danger">Dynamische Klassen und widersprüchliche Quellen</Txt>
            </View>
          }
          correctCode={
            '<View className="flex-row gap-two" style={{ backgroundColor: colors.backgroundSoft }} />'
          }
          incorrectCode={
            'const className = "bg-[" + colors.background + "]";\n<View className={className} />'
          }
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
          <Rule number="1" text="Ist der Wert statisch und unterstützt className? NativeWind." />
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
  const { colors } = useTheme();

  return (
    <View style={styles.page}>
      <ContractIntro
        title="Accessibility und Zustände"
        contract="Interaktive Elemente haben Rolle, verständliche Beschriftung, mindestens 44 Punkte Zielgröße und einen sichtbaren Zustand, der nicht nur aus Farbe besteht."
        source="UI-Verträge und React-Native-Accessibility"
      />
      <Subsection title="Interaktionszustände">
        <View style={styles.stack}>
          <Button label="Bereit" onPress={() => undefined} />
          <Button label="Speichert" loading onPress={() => undefined} />
          <Button label="Nicht verfügbar" disabled onPress={() => undefined} />
          <View style={styles.wrap}>
            <Pill label="Ausgewählt ✓" selected onPress={() => undefined} />
            <Pill label="Deaktiviert" disabled onPress={() => undefined} />
          </View>
        </View>
      </Subsection>
      <ExamplePair
        correct={
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Eintrag hinzufügen"
            accessibilityState={{ disabled: false }}
            style={[styles.goodTarget, { backgroundColor: colors.accent }]}>
            <Txt tone="onAccent" weight="700">
              Eintrag hinzufügen
            </Txt>
          </Pressable>
        }
        incorrect={
          <View style={styles.badA11yRow}>
            <Pressable accessibilityLabel="Absichtlich zu kleines Ziel" style={styles.tinyTarget}>
              <Txt color="#20C776">+</Txt>
            </Pressable>
            <View style={[styles.colorOnlyState, { backgroundColor: '#20C776' }]} />
            <Txt color="#777777">Nur Farbe zeigt den Zustand.</Txt>
          </View>
        }
        correctCode={
          '<Pressable accessibilityRole="button" accessibilityLabel="Eintrag hinzufügen" accessibilityState={{ disabled }}>…</Pressable>'
        }
        incorrectCode={'<Pressable style={{ width: 20, height: 20 }}><Text>+</Text></Pressable>'}
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
  const { colors } = useTheme();
  return (
    <View style={styles.rule}>
      <View style={[styles.ruleNumber, { backgroundColor: colors.accent }]}>
        <Txt variant="label" tone="onAccent">
          {number}
        </Txt>
      </View>
      <Txt style={styles.ruleText}>{text}</Txt>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { gap: space.xxl },
  stack: { gap: space.md },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  phoneFrame: { borderWidth: 1, borderRadius: radius.lg, padding: space.lg, gap: space.lg },
  chromeRow: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.sm,
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
  conflictBox: { borderWidth: 3, borderRadius: 3, padding: 11, backgroundColor: '#FFFFFF' },
  overlayBase: {
    height: 120,
    borderRadius: radius.lg,
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  overlay: { padding: space.lg },
  ruleList: { gap: space.md },
  rule: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md },
  ruleNumber: {
    width: 28,
    height: 28,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ruleText: { flex: 1 },
  goodTarget: {
    minHeight: 44,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space.lg,
  },
  badA11yRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  tinyTarget: { width: 20, height: 20, alignItems: 'center', justifyContent: 'center' },
  colorOnlyState: { width: 14, height: 14, borderRadius: radius.pill },
  readableText: { borderRadius: radius.md, padding: space.lg },
});
