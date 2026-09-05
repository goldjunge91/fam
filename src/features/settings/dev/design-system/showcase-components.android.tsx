import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { radius, space } from '@/components/theme/index';
import { useTheme } from '@/components/theme/ThemeProvider';
import {
  Button,
  CompactActionButton,
  FloatingActionButton,
  HeaderIconButton,
} from '@/components/ui/buttons';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { ProgressBar } from '@/components/ui/progress-bar';
import { ProgressRing } from '@/components/ui/progress-ring';
import { QuantityStepper } from '@/components/ui/quantity-stepper';
import {
  Badge,
  Divider,
  Field,
  IconButton,
  Pill,
  Press,
  Button as PrimitiveButton,
  Card as PrimitiveCard,
  EmptyState as PrimitiveEmptyState,
  Row,
  SectionHeading,
  SegmentedControl,
  Spacer,
  Surface,
  Txt,
} from '@/constants/ui';
import { ContractIntro, ExamplePair, ExamplePanel, Subsection } from './showcase-shared';

export type ComponentCategory = 'surfaces' | 'controls' | 'feedback';

export function ComponentsShowcase({ category }: { category: ComponentCategory }) {
  if (category === 'surfaces') return <SurfaceShowcase />;
  if (category === 'controls') return <ControlShowcase />;
  return <FeedbackShowcase />;
}

function SurfaceShowcase() {
  const { colors } = useTheme();

  return (
    <View style={styles.page}>
      <ContractIntro
        title="Oberflächen und Karten"
        contract="Surface bestimmt nur eine semantische Hintergrundrolle. Card gruppiert zusammengehörende Inhalte. Reines Layout bleibt ein View."
        source="ui.tsx: Surface und components/ui/card.tsx"
      />
      <Subsection title="Surface-Töne">
        <View style={styles.stack}>
          {(['page', 'surface', 'soft', 'accent'] as const).map((tone) => (
            <Surface
              key={tone}
              tone={tone}
              style={[styles.surfaceSample, { borderColor: colors.border }]}>
              <Txt variant="label" tone={tone === 'accent' ? 'onAccent' : 'primary'}>
                tone="{tone}"
              </Txt>
            </Surface>
          ))}
        </View>
      </Subsection>
      <Subsection title="Feature-Card">
        <Card title="Vorrat">
          <Txt tone="secondary">12 Produkte, 2 laufen bald ab</Txt>
          <ProgressBar value={0.68} />
        </Card>
      </Subsection>
      <Subsection title="Layout- und Basisprimitiven">
        <PrimitiveCard elevation="sm">
          <Row justify="space-between">
            <Txt weight="700">Row</Txt>
            <Txt tone="secondary">flex-row</Txt>
          </Row>
          <Spacer h={space.sm} />
          <Divider />
          <Spacer h={space.sm} />
          <Txt tone="secondary">Card, Spacer und Divider aus der Foundation-API.</Txt>
        </PrimitiveCard>
      </Subsection>
      <ExamplePair
        correct={
          <Surface tone="surface" style={styles.correctGroup}>
            <Txt variant="subheading">Zusammengehörender Inhalt</Txt>
            <Txt tone="secondary">Eine semantische Oberfläche, ein klarer Zweck.</Txt>
          </Surface>
        }
        incorrect={
          <View style={styles.decorativeCards}>
            <View style={styles.randomCard}>
              <Txt color="#111111">Karte in Karte</Txt>
            </View>
            <View style={styles.randomPill}>
              <Txt color="#111111">Dekoration ohne Bedeutung</Txt>
            </View>
          </View>
        }
        correctCode={'<Surface tone="surface">…</Surface>'}
        incorrectCode={"<View style={{ backgroundColor: '#fff', borderRadius: 37 }}>…</View>"}
      />
    </View>
  );
}

function ControlShowcase() {
  const [selectedPill, setSelectedPill] = useState(false);
  const [segment, setSegment] = useState<'all' | 'soon'>('all');
  const [quantity, setQuantity] = useState(2);
  const { colors } = useTheme();

  return (
    <View style={styles.page}>
      <ContractIntro
        title="Buttons, Felder und Auswahl"
        contract="Produkt-Screens verwenden die Feature-facing Komponenten. Varianten drücken Bedeutung aus; Größen und 3D-Tiefe werden nicht pro Screen nachgebaut."
        source="components/ui und ui.tsx"
      />
      <Subsection title="Buttonvarianten">
        <View style={styles.stack}>
          <Button label="Primäre Aktion" onPress={() => undefined} />
          <Button label="Sekundäre Aktion" variant="secondary" onPress={() => undefined} />
          <Button label="Gefährliche Aktion" variant="danger" onPress={() => undefined} />
          <Button label="Ghost-Aktion" variant="ghost" onPress={() => undefined} />
          <Button
            label="Akzentbereich"
            variant="accent"
            accentKey="nourish"
            onPress={() => undefined}
          />
          <Button label="Als Link" variant="link" onPress={() => undefined} />
          <Button label="Großer Button" size="large" onPress={() => undefined} />
          <Button
            label="Kompakter Button"
            size="compact"
            variant="secondary"
            onPress={() => undefined}
          />
          <Button label="Wird geladen" loading onPress={() => undefined} />
          <Button label="Deaktiviert" disabled onPress={() => undefined} />
        </View>
      </Subsection>
      <Subsection title="Kompakte Aktionen">
        <View style={styles.stack}>
          <CompactActionButton label="Sortierung" expanded={false} onPress={() => undefined} />
          <View style={styles.iconActions}>
            <HeaderIconButton label="Filter öffnen" onPress={() => undefined}>
              <Txt variant="body">⌕</Txt>
            </HeaderIconButton>
            <FloatingActionButton label="Eintrag hinzufügen" onPress={() => undefined}>
              <Txt variant="subheading" tone="onAccent">
                +
              </Txt>
            </FloatingActionButton>
          </View>
        </View>
      </Subsection>
      <Subsection title="Foundation-Aktionen für gemeinsame Komponenten">
        <View style={styles.stack}>
          <SectionHeading title="Abschnitt" action="Alle zeigen" onAction={() => undefined} />
          <PrimitiveButton title="Foundation Button" icon="check" full onPress={() => undefined} />
          <Row>
            <IconButton icon="heart" accessibilityLabel="Favorit" onPress={() => undefined} />
            <Press
              accessibilityRole="button"
              accessibilityLabel="Press-Primitiv"
              onPress={() => undefined}
              style={[styles.pressPrimitive, { backgroundColor: colors.backgroundSoft }]}>
              <Txt weight="700">Press</Txt>
            </Press>
          </Row>
        </View>
      </Subsection>
      <Subsection title="Eingabe und Auswahl">
        <View style={styles.stack}>
          <Field label="Produktname" placeholder="Zum Beispiel Hafermilch" />
          <View style={styles.wrap}>
            <Pill
              label="Alle"
              selected={selectedPill}
              onPress={() => setSelectedPill((value) => !value)}
            />
            <Badge label="Vorrat" tone="pantry" icon="archive" />
            <Badge label="Warnung" tone="nourish" icon="alert-circle" solid />
          </View>
          <SegmentedControl
            options={[
              { label: 'Alle', value: 'all' },
              { label: 'Bald fällig', value: 'soon' },
            ]}
            value={segment}
            onChange={setSegment}
          />
          <QuantityStepper value={quantity} onChange={setQuantity} min={0} max={20} />
        </View>
      </Subsection>
      <ExamplePair
        correct={<Button label="Speichern" onPress={() => undefined} />}
        incorrect={
          <Pressable
            accessibilityLabel="Absichtlich falsches Button-Beispiel"
            style={[styles.fakeButton, { backgroundColor: '#2FBF71', borderColor: colors.border }]}>
            <Txt color="#FFFFFF" style={{ fontSize: 15 }}>
              Speichern
            </Txt>
          </Pressable>
        }
        correctCode={'<Button label="Speichern" onPress={save} />'}
        incorrectCode={
          "<Pressable style={{ backgroundColor: '#2FBF71', height: 37 }}>…</Pressable>"
        }
      />
    </View>
  );
}

function FeedbackShowcase() {
  return (
    <View style={styles.page}>
      <ContractIntro
        title="Status und Feedback"
        contract="Erfolg, Warnung und Fehler verwenden semantische Töne. Loading, leer und Fortschritt geben Zustand und nächsten Schritt sichtbar an."
        source="Txt-Töne, Progress-Komponenten und EmptyState"
      />
      <Subsection title="Semantische Status">
        <View style={styles.stack}>
          <Txt tone="success" weight="700">
            Erfolgreich gespeichert
          </Txt>
          <Txt tone="warning" weight="700">
            Läuft in zwei Tagen ab
          </Txt>
          <Txt tone="danger" weight="700">
            Synchronisierung fehlgeschlagen
          </Txt>
          <ProgressBar value={0.72} />
        </View>
      </Subsection>
      <Subsection title="Fortschritt">
        <View style={styles.centered}>
          <ProgressRing
            value={1420}
            target={2000}
            preset="dashboard"
            displayMode="remaining"
            animated={false}
            label="Kalorien heute"
          />
        </View>
      </Subsection>
      <Subsection title="Leerer Zustand">
        <ExamplePanel kind="neutral" label="Echte EmptyState-Komponente">
          <EmptyState
            symbol="archivebox"
            title="Noch nichts im Vorrat"
            hint="Füge dein erstes Produkt hinzu."
          />
        </ExamplePanel>
        <ExamplePanel kind="neutral" label="Foundation EmptyState">
          <PrimitiveEmptyState
            emoji="🧺"
            title="Liste ist leer"
            subtitle="Die Foundation-Variante akzeptiert optional eine eigene Aktion."
            action={<PrimitiveButton title="Eintrag anlegen" size="sm" onPress={() => undefined} />}
          />
        </ExamplePanel>
      </Subsection>
      <ExamplePair
        correct={
          <View style={styles.stack}>
            <Txt variant="subheading">Keine Treffer</Txt>
            <Txt tone="secondary">Passe den Suchbegriff an oder füge ein Produkt hinzu.</Txt>
            <Button label="Produkt hinzufügen" variant="secondary" onPress={() => undefined} />
          </View>
        }
        incorrect={<Txt color="#999999">Leer.</Txt>}
        correctCode={'<EmptyState title="Keine Treffer" hint="…" />'}
        incorrectCode={'{items.length === 0 ? <Text>Leer.</Text> : null}'}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  page: { gap: space.xxl },
  stack: { gap: space.md },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.sm },
  surfaceSample: {
    minHeight: 64,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    padding: space.md,
    justifyContent: 'center',
  },
  correctGroup: { borderRadius: radius.md, padding: space.lg, gap: space.sm },
  decorativeCards: {
    gap: space.sm,
    padding: space.sm,
    backgroundColor: '#EEEEEE',
    borderRadius: 32,
  },
  randomCard: { padding: 17, backgroundColor: '#FFFFFF', borderRadius: 25 },
  randomPill: { padding: 13, backgroundColor: '#FFF1D9', borderRadius: 999 },
  iconActions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  fakeButton: {
    height: 37,
    borderWidth: 1,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressPrimitive: {
    minHeight: 44,
    borderRadius: radius.md,
    paddingHorizontal: space.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centered: { alignItems: 'center' },
});
