import { FieldGroup, Host, Icon, ListItem } from '@expo/ui';
import BottomSheet, { BottomSheetView } from '@expo/ui/community/bottom-sheet';
import ExpoSegmentedControl from '@expo/ui/community/segmented-control';
import { useEffect, useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';

import { radius, space, withAlpha } from '@/components/theme/index';
import { useTheme } from '@/components/theme/ThemeProvider';
import {
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
  Button,
  Divider,
  SegmentedControl as FamSegmentedControl,
  IconButton,
  Pill,
  Press,
  Button as PrimitiveButton,
  Card as PrimitiveCard,
  Row,
  SectionHeading,
  Spacer,
  Surface,
  TextField,
  Txt,
  type TxtVariant,
} from '@/constants/ui';
import { SettingsGroup, SettingsRow } from '@/features/settings/settings-menu';
import { useSheetShadowStyle } from '@/hooks/use-sheet-shadow-style';
import {
  CodeSample,
  ContractIntro,
  ExamplePair,
  ExamplePanel,
  Subsection,
} from './showcase-shared';

export type ComponentCategory = 'surfaces' | 'controls' | 'feedback';

type ShowcaseSegment = 'all' | 'soon';

const SHOWCASE_SEGMENT_OPTIONS: { label: string; value: ShowcaseSegment }[] = [
  { label: 'Alle', value: 'all' },
  { label: 'Bald fällig', value: 'soon' },
];

const SHOWCASE_SEGMENT_VALUES = SHOWCASE_SEGMENT_OPTIONS.map(({ label }) => label);

// Offizielles Expo-UI-Muster (docs.expo.dev/.../ui/universal/list): Icon.select
// statt {ios, android}-Objekt, damit Metro pro Plattform nur eine Seite bündelt.
const CHEVRON = Icon.select({
  ios: 'chevron.right',
  android: import('@expo/material-symbols/chevron_right.xml'),
});

// Referenz für die volle Typoskala, in Kartenform statt als flache Liste
// (die reine Token-Referenz lebt unter Foundations → Typografie).
const TYPE_SCALE: { variant: TxtVariant; sample: string }[] = [
  { variant: 'display', sample: '1.420 kcal' },
  { variant: 'title', sample: 'Wocheneinkauf' },
  { variant: 'brand', sample: 'fam' },
  { variant: 'heading', sample: 'Vorrat' },
  { variant: 'subheading', sample: 'Lagerorte' },
  { variant: 'body', sample: '12 Produkte im Kühlschrank' },
  { variant: 'navigation', sample: 'Einstellungen' },
  { variant: 'label', sample: 'STATUS' },
  { variant: 'caption', sample: 'Zuletzt aktualisiert vor 2 Minuten' },
  { variant: 'eyebrow', sample: 'WOCHENZIEL' },
  { variant: 'glyph', sample: '★' },
];

// 'contrast' ist kein echtes Design-Token — nur zur Verdeutlichung, dass
// shadowColor grundsätzlich wirkt, obwohl shadowCard/shadowSheet sich kaum
// unterscheiden (beide dunkles Mauve bei niedriger shadowOpacity).
type ShadowVariant = 'standard' | 'secondary' | 'contrast';

type ToneKind = 'success' | 'warning' | 'danger';

const TONE_CARDS: { tone: ToneKind; icon: string; title: string; caption: string }[] = [
  {
    tone: 'success',
    icon: '✓',
    title: 'Synchronisiert',
    caption: 'Alle Änderungen sind gespeichert.',
  },
  {
    tone: 'warning',
    icon: '!',
    title: 'Läuft bald ab',
    caption: '2 Artikel laufen in 3 Tagen ab.',
  },
  {
    tone: 'danger',
    icon: '✕',
    title: 'Synchronisierung fehlgeschlagen',
    caption: 'Erneut versuchen oder Verbindung prüfen.',
  },
];

export function ComponentsShowcase({ category }: { category: ComponentCategory }) {
  if (category === 'surfaces') return <SurfaceShowcase />;
  if (category === 'controls') return <ControlShowcase />;
  return <FeedbackShowcase />;
}

function SurfaceShowcase() {
  const { colors } = useTheme();
  const [tappedCard, setTappedCard] = useState<string | null>(null);

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
      <Subsection title="Cards mit Schatten und Progress-Ringen">
        <PrimitiveCard elevation="lg" style={styles.progressCard}>
          <View style={styles.progressCardRow}>
            <View style={styles.progressCardCopy}>
              <Txt variant="label" tone="secondary" style={styles.progressCardLabel}>
                KALORIEN HEUTE
              </Txt>
              <Txt variant="title">1.420 kcal</Txt>
              <Txt tone="secondary">580 kcal übrig</Txt>
            </View>
            <ProgressRing
              value={1420}
              target={2000}
              preset="compact"
              label="Kalorien"
              displayMode="percent"
              animated={false}
            />
          </View>
          <Txt variant="caption" tone="secondary">
            elevation="lg" · preset="compact"
          </Txt>
        </PrimitiveCard>
        <PrimitiveCard elevation="lg" style={styles.progressCard}>
          <View style={styles.progressCardRow}>
            <ProgressRing
              value={7}
              target={10}
              preset="dashboard"
              label="Aufgaben"
              unit="Aufgaben"
              displayMode="percent"
              animated={false}
            />
            <View style={styles.progressCardCopy}>
              <Txt variant="label" tone="secondary" style={styles.progressCardLabel}>
                WOCHENZIEL
              </Txt>
              <Txt variant="title">7 von 10</Txt>
              <Txt tone="secondary">Drei Aufgaben verbleiben</Txt>
            </View>
          </View>
          <Txt variant="caption" tone="secondary">
            elevation="lg" · preset="dashboard"
          </Txt>
        </PrimitiveCard>
      </Subsection>
      <Subsection title="Kartenschatten: Standard- vs. Sekundärfarbe">
        <View style={styles.comparisonGroup}>
          <View style={styles.comparisonExample}>
            <Txt variant="label">Standardfarbe (colors.shadowCard)</Txt>
            <ShadowProgressCard variant="standard" />
          </View>
          <View style={styles.comparisonExample}>
            <Txt variant="label">Sekundärfarbe (colors.shadowSheet)</Txt>
            <ShadowProgressCard variant="secondary" />
          </View>
          <View style={styles.comparisonExample}>
            <Txt variant="label">Auffällige Farbe (colors.danger, nur zum Vergleich)</Txt>
            <ShadowProgressCard variant="contrast" />
          </View>
        </View>
        <CodeSample>
          {
            'shadowCard (#594059) und shadowSheet (#2A1F2C) sind unterschiedliche Hex-Werte, aber beide dunkles Mauve — bei shadowOpacity 0.14 kaum zu unterscheiden. shadowColor wirkt trotzdem, wie die dritte Karte mit colors.danger zeigt.\nAuf Android hat shadowColor ohnehin keinen Effekt: elevation zeichnet immer einen neutralen Systemschatten, unabhängig vom Token.'
          }
        </CodeSample>
      </Subsection>
      <Subsection title="Interaktive Karten">
        <View style={styles.comparisonGroup}>
          <View style={styles.comparisonExample}>
            <Txt variant="label">Standardfarbe, antippbar</Txt>
            <ShadowProgressCard
              variant="standard"
              interactive
              onPress={() => setTappedCard('Standardfarbe')}
            />
          </View>
          <View style={styles.comparisonExample}>
            <Txt variant="label">Sekundärfarbe, antippbar</Txt>
            <ShadowProgressCard
              variant="secondary"
              interactive
              onPress={() => setTappedCard('Sekundärfarbe')}
            />
          </View>
        </View>
        <Txt variant="caption" tone="secondary">
          {tappedCard ? `Zuletzt angetippt: ${tappedCard}` : 'Noch keine Karte angetippt.'}
        </Txt>
        <CodeSample>
          {
            '<Press onPress={...} accessibilityRole="button">\n  <Card elevation="lg">…</Card>\n</Press>\nPress (constants/ui.tsx) liefert Scale- und Haptik-Feedback — die Karte selbst bleibt unverändert.'
          }
        </CodeSample>
      </Subsection>
      <Subsection title="Karten mit unterschiedlicher Typografie">
        <PrimitiveCard elevation="sm" style={styles.typographyCard}>
          {TYPE_SCALE.map(({ variant, sample }) => (
            <View key={variant} style={styles.typographyRow}>
              <Txt variant="caption" tone="secondary" style={styles.typographyVariantLabel}>
                {variant}
              </Txt>
              <Txt variant={variant} numberOfLines={1} style={styles.typographySample}>
                {sample}
              </Txt>
            </View>
          ))}
        </PrimitiveCard>
        <View style={styles.comparisonGroup}>
          <View style={styles.comparisonExample}>
            <Txt variant="label">Große Hierarchie</Txt>
            <PrimitiveCard elevation="sm" style={styles.typographyCompositionCard}>
              <Txt variant="eyebrow">WOCHENZIEL</Txt>
              <Txt variant="title">7 von 10 Aufgaben</Txt>
              <Txt variant="body" tone="secondary">
                Drei Aufgaben verbleiben bis Sonntag.
              </Txt>
            </PrimitiveCard>
          </View>
          <View style={styles.comparisonExample}>
            <Txt variant="label">Kompakte Hierarchie</Txt>
            <PrimitiveCard elevation="sm" style={styles.typographyCompositionCard}>
              <Txt variant="label" tone="secondary">
                STATUS
              </Txt>
              <Txt variant="heading">Vorrat aktualisiert</Txt>
              <Txt variant="caption" tone="secondary">
                Vor 2 Minuten synchronisiert.
              </Txt>
            </PrimitiveCard>
          </View>
        </View>
      </Subsection>
      <Subsection title="Karten nach Ton (Status)">
        <View style={styles.stack}>
          {TONE_CARDS.map((item) => (
            <ToneCard key={item.tone} {...item} />
          ))}
        </View>
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

/** Identische Karte für den Schatten-Vergleich, optional per Press antippbar. */
function ShadowProgressCard({
  variant,
  interactive = false,
  onPress,
}: {
  variant: ShadowVariant;
  interactive?: boolean;
  onPress?: () => void;
}) {
  const { colors } = useTheme();
  const shadowColor =
    variant === 'standard'
      ? colors.shadowCard
      : variant === 'secondary'
        ? colors.shadowSheet
        : colors.danger;
  const tokenName =
    variant === 'standard'
      ? 'colors.shadowCard'
      : variant === 'secondary'
        ? 'colors.shadowSheet'
        : 'colors.danger';

  const card = (
    <PrimitiveCard elevation="lg" style={[styles.progressCard, { shadowColor }]}>
      <View style={styles.progressCardRow}>
        <View style={styles.progressCardCopy}>
          <Txt variant="label" tone="secondary" style={styles.progressCardLabel}>
            KALORIEN HEUTE
          </Txt>
          <Txt variant="title">1.420 kcal</Txt>
          <Txt tone="secondary">580 kcal übrig</Txt>
        </View>
        <ProgressRing
          value={1420}
          target={2000}
          preset="compact"
          label="Kalorien"
          displayMode="percent"
          animated={false}
        />
      </View>
      <Txt variant="caption" tone="secondary">
        shadowColor="{tokenName}"
      </Txt>
    </PrimitiveCard>
  );

  if (!interactive) return card;

  return (
    <Press
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Beispielkarte mit ${tokenName}, antippen`}>
      {card}
    </Press>
  );
}

/** Statuskarte mit tonfarbener Tönung — Vorbild: ExamplePanel-Farblogik. */
function ToneCard({
  tone,
  icon,
  title,
  caption,
}: {
  tone: ToneKind;
  icon: string;
  title: string;
  caption: string;
}) {
  const { colors } = useTheme();
  const toneColor = colors[tone];

  return (
    <View
      style={[
        styles.toneCard,
        { backgroundColor: withAlpha(toneColor, 0.12), borderColor: toneColor },
      ]}>
      <View style={styles.toneCardHeader}>
        <View style={[styles.toneCardIcon, { backgroundColor: toneColor }]}>
          <Txt tone="onAccent" weight="700">
            {icon}
          </Txt>
        </View>
        <Txt variant="label" tone={tone} weight="700">
          {tone.toUpperCase()}
        </Txt>
      </View>
      <Txt variant="subheading">{title}</Txt>
      <Txt tone="secondary">{caption}</Txt>
    </View>
  );
}

function ControlShowcase() {
  const [selectedPill, setSelectedPill] = useState(false);
  const [segment, setSegment] = useState<ShowcaseSegment>('all');
  const [quantity, setQuantity] = useState(2);
  const [tappedRow, setTappedRow] = useState<string | null>(null);
  const { colors } = useTheme();
  const selectedSegmentIndex = SHOWCASE_SEGMENT_OPTIONS.findIndex(
    (option) => option.value === segment,
  );

  return (
    <View style={styles.page}>
      <ContractIntro
        title="Buttons, Felder und Auswahl"
        contract="Produkt-Screens verwenden die Feature-facing Komponenten. Varianten drücken Bedeutung aus; Größen und 3D-Tiefe werden nicht pro Screen nachgebaut."
        source="components/ui und ui.tsx"
      />
      <Subsection title="Buttonvarianten">
        <View style={styles.stack}>
          <Button title="Primäre Aktion" onPress={() => undefined} />
          <Button title="Sekundäre Aktion" variant="secondary" onPress={() => undefined} />
          <Button title="Gefährliche Aktion" variant="danger" onPress={() => undefined} />
          <Button title="Ghost-Aktion" variant="ghost" onPress={() => undefined} />
          <Button
            title="Akzentbereich"
            variant="accent"
            accentKey="nourish"
            onPress={() => undefined}
          />
          <Button title="Als Link" variant="link" onPress={() => undefined} />
          <Button title="Großer Button" size="lg" onPress={() => undefined} />
          <Button
            title="Kompakter Button"
            size="sm"
            variant="secondary"
            onPress={() => undefined}
          />
          <Button title="Wird geladen" loading onPress={() => undefined} />
          <Button title="Deaktiviert" disabled onPress={() => undefined} />
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
          <TextField label="Produktname" placeholder="Zum Beispiel Hafermilch" />
          <View style={styles.wrap}>
            <Pill
              label="Alle"
              selected={selectedPill}
              onPress={() => setSelectedPill((value) => !value)}
            />
            <Badge label="Vorrat" tone="pantry" icon="archive" />
            <Badge label="Warnung" tone="nourish" icon="alert-circle" solid />
          </View>
          <QuantityStepper value={quantity} onChange={setQuantity} min={0} max={20} />
        </View>
      </Subsection>
      <Subsection title="SegmentedControl-Varianten">
        <View style={styles.comparisonGroup}>
          <View style={styles.comparisonExample}>
            <Txt variant="label">Fam UI: constants/ui.tsx (kanonisch)</Txt>
            <FamSegmentedControl
              label="Ansicht"
              options={SHOWCASE_SEGMENT_OPTIONS}
              selected={segment}
              onSelect={setSegment}
              selectionRole="tab"
            />
          </View>
          <View style={styles.comparisonExample}>
            <Txt variant="label">Expo UI: @expo/ui/community/segmented-control</Txt>
            <ExpoSegmentedControl
              values={SHOWCASE_SEGMENT_VALUES}
              selectedIndex={selectedSegmentIndex}
              onChange={(event) => {
                const next = SHOWCASE_SEGMENT_OPTIONS[event.nativeEvent.selectedSegmentIndex];
                if (next) setSegment(next.value);
              }}
              style={styles.expoSegmentedControl}
            />
          </View>
        </View>
      </Subsection>
      <Subsection title="Bottom Sheet">
        <View style={styles.comparisonGroup}>
          <View style={styles.comparisonExample}>
            <Txt variant="label">Fam UI: Modal-Eigenbau (aktueller Standard)</Txt>
            <ClassicBottomSheetDemo />
          </View>
          <View style={styles.comparisonExample}>
            <Txt variant="label">Expo UI: @expo/ui/community/bottom-sheet</Txt>
            <ExpoUiBottomSheetDemo />
          </View>
        </View>
        <CodeSample>
          {
            'Eigenbau (17 Sheets): Modal + Pressable-Backdrop + useSheetShadowStyle() — volle Kontrolle über Look, aber Rubber-Banding/System-Dismiss/Safe-Area selbst gepflegt.\n@expo/ui (3 Sheets: paywall, category-order, complete-run): natives Sheet-Verhalten geschenkt, API bereits gorhom-kompatibel (ref.expand()/close(), snapPoints, enablePanDownToClose) — Umstieg von @gorhom/bottom-sheet wäre ein Import-Tausch, kein Rewrite.'
          }
        </CodeSample>
      </Subsection>
      <Subsection title="Gruppierte Liste (Settings-Stil)">
        <View style={styles.comparisonGroup}>
          <View style={styles.comparisonExample}>
            <Txt variant="label">Fam UI: settings-menu.tsx (kanonisch)</Txt>
            <SettingsGroup title="Beispielgruppe">
              <SettingsRow
                icon="🔔"
                label="Benachrichtigungen"
                hint="Push & E-Mail"
                onPress={() => setTappedRow('Benachrichtigungen (Fam UI)')}
              />
              <SettingsRow
                icon="🔐"
                label="Berechtigungen"
                onPress={() => setTappedRow('Berechtigungen (Fam UI)')}
                last
              />
            </SettingsGroup>
          </View>
          <View style={styles.comparisonExample}>
            <Txt variant="label">Expo UI: FieldGroup + ListItem</Txt>
            <Host style={styles.expoFieldGroupHost}>
              <FieldGroup>
                <FieldGroup.Section title="Beispielgruppe">
                  <ListItem
                    supportingText="Push & E-Mail"
                    trailing={<Icon name={CHEVRON} size={14} color={colors.textSecondary} />}
                    onPress={() => setTappedRow('Benachrichtigungen (Expo UI)')}>
                    Benachrichtigungen
                  </ListItem>
                  <ListItem
                    trailing={<Icon name={CHEVRON} size={14} color={colors.textSecondary} />}
                    onPress={() => setTappedRow('Berechtigungen (Expo UI)')}>
                    Berechtigungen
                  </ListItem>
                </FieldGroup.Section>
              </FieldGroup>
            </Host>
          </View>
        </View>
        <Txt variant="caption" tone="secondary">
          {tappedRow ? `Zuletzt angetippt: ${tappedRow}` : 'Noch keine Zeile angetippt.'}
        </Txt>
        <CodeSample>
          {
            'Eigenbau: eigene Icon-Kacheln, Trennlinien und Theme-Farben (settings-menu.tsx) — auf iOS und Android optisch identisch, volle Kontrolle über jede Zeile.\nExpo UI: FieldGroup rendert echtes SwiftUI Form (iOS) bzw. Compose-LazyColumn (Android) — natives Look-and-feel je Plattform. Chevron per Icon.select (SF Symbol auf iOS, @expo/material-symbols-XML auf Android) statt Emoji-Kachel; kein Icon-Tile-Slot, jede Zeile ein natives Node auf dem JS-Thread (nicht virtualisiert, nur für kurze feste Listen wie Settings-Menüs geeignet).'
          }
        </CodeSample>
      </Subsection>
      <ExamplePair
        correct={<Button title="Speichern" onPress={() => undefined} />}
        incorrect={
          <Pressable
            accessibilityLabel="Absichtlich falsches Button-Beispiel"
            style={[styles.fakeButton, { backgroundColor: '#2FBF71', borderColor: colors.border }]}>
            <Txt color="#FFFFFF" style={{ fontSize: 15 }}>
              Speichern
            </Txt>
          </Pressable>
        }
        correctCode={'<Button title="Speichern" onPress={save} />'}
        incorrectCode={
          "<Pressable style={{ backgroundColor: '#2FBF71', height: 37 }}>…</Pressable>"
        }
      />
    </View>
  );
}

/** Eigenbau-Sheet: Modal + Backdrop + Handle-Bar, wie in den meisten bestehenden `*-sheet.tsx`-Dateien. */
function ClassicBottomSheetDemo() {
  const { colors } = useTheme();
  const sheetStyle = useSheetShadowStyle();
  const [visible, setVisible] = useState(false);

  return (
    <View style={styles.sheetTrigger}>
      <Button
        title="Öffnen (Eigenbau)"
        variant="secondary"
        size="sm"
        onPress={() => setVisible(true)}
      />
      <Modal
        visible={visible}
        transparent
        animationType="slide"
        onRequestClose={() => setVisible(false)}>
        <View style={StyleSheet.absoluteFill}>
          <Pressable
            style={[StyleSheet.absoluteFill, { backgroundColor: withAlpha(colors.text, 0.35) }]}
            onPress={() => setVisible(false)}
            accessibilityRole="button"
            accessibilityLabel="Beispiel-Sheet schließen"
          />
          <View style={[styles.classicSheet, sheetStyle, { backgroundColor: colors.background }]}>
            <View style={[styles.sheetHandle, { backgroundColor: colors.border }]} />
            <View style={styles.sheetHeaderRow}>
              <Txt variant="heading" weight="700">
                Beispiel-Sheet
              </Txt>
              <Pressable
                onPress={() => setVisible(false)}
                accessibilityRole="button"
                accessibilityLabel="Schließen">
                <Txt>✕</Txt>
              </Pressable>
            </View>
            <Txt tone="secondary">Modal(transparent, slide) + Pressable-Backdrop + Handle-Bar.</Txt>
          </View>
        </View>
      </Modal>
    </View>
  );
}

/** @expo/ui-Sheet: gorhom-kompatible API (ref.expand()/close()), bereits im Einsatz in 3 Sheets. */
function ExpoUiBottomSheetDemo() {
  const { colors } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const sheetRef = useRef<BottomSheet>(null);

  useEffect(() => {
    if (isOpen) {
      sheetRef.current?.expand();
    } else {
      sheetRef.current?.close();
    }
  }, [isOpen]);

  return (
    <View style={styles.sheetTrigger}>
      <Button
        title="Öffnen (@expo/ui)"
        variant="secondary"
        size="sm"
        onPress={() => setIsOpen(true)}
      />
      <BottomSheet
        ref={sheetRef}
        snapPoints={['35%']}
        enablePanDownToClose
        onClose={() => setIsOpen(false)}
        backgroundStyle={{ backgroundColor: colors.background }}
        handleIndicatorStyle={{ backgroundColor: colors.border }}>
        <BottomSheetView style={styles.expoSheetContent}>
          <Txt variant="heading" weight="700">
            Beispiel-Sheet
          </Txt>
          <Txt tone="secondary">
            @expo/ui/community/bottom-sheet — API-kompatibel zu @gorhom/bottom-sheet.
          </Txt>
        </BottomSheetView>
      </BottomSheet>
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
            action={<PrimitiveButton title="Eintrag anlegen" size="sm" onPress={() => undefined} />}
          />
        </ExamplePanel>
      </Subsection>
      <ExamplePair
        correct={
          <View style={styles.stack}>
            <Txt variant="subheading">Keine Treffer</Txt>
            <Txt tone="secondary">Passe den Suchbegriff an oder füge ein Produkt hinzu.</Txt>
            <Button title="Produkt hinzufügen" variant="secondary" onPress={() => undefined} />
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
  progressCard: { gap: space.md },
  progressCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.lg,
  },
  progressCardCopy: { flex: 1, minWidth: 0, gap: space.xs },
  progressCardLabel: { letterSpacing: 0.6 },
  // Ein Paar für jeden "Fam UI vs. Alternative"-Vergleich in dieser Datei —
  // bewusst nicht pro Vergleich neu benannt, sonst vervielfachen sich
  // identische { gap } -Definitionen bei jedem neuen Beispiel.
  comparisonGroup: { gap: space.lg },
  comparisonExample: { gap: space.xs },
  expoSegmentedControl: { width: '100%', minHeight: 44 },
  sheetTrigger: { alignItems: 'flex-start' },
  classicSheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: space.lg,
    paddingTop: space.sm,
    gap: space.sm,
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 42,
    height: 4,
    borderRadius: radius.pill,
    marginBottom: space.sm,
  },
  sheetHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  expoSheetContent: { flex: 1, padding: space.lg, gap: space.sm },
  // FieldGroup ist ein scrollbarer Container (Form/LazyColumn) und hat daher
  // keine natürliche Inhaltshöhe — matchContents kollabiert hier auf 0.
  // In einem ohnehin scrollenden Screen braucht der Host eine feste Höhe.
  expoFieldGroupHost: { width: '100%', height: 220 },
  surfaceSample: {
    minHeight: 64,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    padding: space.md,
    justifyContent: 'center',
  },
  typographyCard: { gap: space.sm },
  typographyRow: { flexDirection: 'row', alignItems: 'baseline', gap: space.sm },
  typographyVariantLabel: { width: 88 },
  typographySample: { flex: 1, minWidth: 0 },
  typographyCompositionCard: { gap: space.xs },
  toneCard: {
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: space.lg,
    gap: space.sm,
  },
  toneCardHeader: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  toneCardIcon: {
    width: 24,
    height: 24,
    borderRadius: radius.pill,
    alignItems: 'center',
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
