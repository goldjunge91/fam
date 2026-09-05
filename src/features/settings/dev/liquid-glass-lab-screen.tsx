import { ContextMenu, Host, Menu, Button as NativeButton, Text, VStack } from '@expo/ui/swift-ui';
import {
  backgroundOverlay,
  buttonStyle,
  controlSize,
  cornerRadius,
  font,
  foregroundStyle,
  frame,
  glassEffect,
  padding,
  tint,
} from '@expo/ui/swift-ui/modifiers';
import { GlassContainer, GlassView } from 'expo-glass-effect';
import { useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import { Screen } from '@/components/layout/screen';
import { useTheme } from '@/components/theme/ThemeProvider';
import { Card } from '@/components/ui/card';
import { useGlassAvailable } from '@/components/ui/glass-card';
import { Txt } from '@/constants/ui';
import { useHubGradient } from '@/hooks/use-hub-gradient';

export function LiquidGlassLabScreen() {
  const { colors } = useTheme();
  const hubGradient = useHubGradient();
  const glassAvailable = useGlassAvailable();
  const [segment, setSegment] = useState<'tag' | 'woche' | 'monat'>('woche');
  const [editMenuOpen, setEditMenuOpen] = useState(false);

  return (
    <Screen
      title="Liquid-Glass-Labor"
      subtitle="Nur sichtbar mit EXPO_PUBLIC_DEV_TOOLS"
      back={{ label: 'Entwickler', href: '/settings/dev' }}
      backStyle="icon"
      backgroundGradient={hubGradient}>
      <Card title="Status">
        <View
          style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Txt variant="caption" tone="secondary">
            expo-glass-effect verfügbar
          </Txt>
          <Txt variant="caption" weight="700" tone={glassAvailable ? 'success' : 'danger'}>
            {glassAvailable ? 'true' : 'false'}
          </Txt>
        </View>
        <Txt variant="caption" tone="secondary">
          Nur auf iOS 26+ (echtes Gerät oder Simulator-Runtime), ohne Reduce Transparency, außerhalb
          von Expo Go — sonst zeigt jede Kachel unten ihren soliden Fallback.
        </Txt>
      </Card>

      {/* Buttons & Segment-Controls auf Basis von expo-glass-effect */}
      <Card title="Buttons — expo-glass-effect">
        <Txt variant="caption" tone="secondary" style={{ marginBottom: 12 }}>
          `GlassView` mit verschiedenen Tints/Styles, dieselbe Komponente wie im Dashboard.
        </Txt>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
          <GlassLabButton label="Primär" tintColor={colors.basil} onPress={() => {}} />
          <GlassLabButton label="Sekundär" onPress={() => {}} />
          <GlassLabButton label="Löschen" tintColor={colors.tomato} onPress={() => {}} />
          <GlassLabButton label="Clear-Style" glassStyle="clear" onPress={() => {}} />
        </View>

        <View style={{ flexDirection: 'row', gap: 16, marginTop: 16, alignItems: 'center' }}>
          <GlassIconButton glyph="+" accessibilityLabel="Hinzufügen" onPress={() => {}} />
          <GlassIconButton
            glyph="✎"
            accessibilityLabel="Bearbeiten"
            tintColor={colors.basil}
            onPress={() => {}}
          />
          <GlassIconButton
            glyph="🗑"
            accessibilityLabel="Löschen"
            tintColor={colors.tomato}
            onPress={() => {}}
          />
          <GlassIconButton
            glyph="+"
            accessibilityLabel="Groß hinzufügen"
            size={64}
            onPress={() => {}}
          />
        </View>

        <Txt variant="caption" tone="secondary" style={{ marginTop: 16, marginBottom: 8 }}>
          Segmentierte Auswahl (`GlassContainer` + `isInteractive`)
        </Txt>
        <GlassContainer spacing={8} style={{ flexDirection: 'row', gap: 8 }}>
          {(['tag', 'woche', 'monat'] as const).map((value) => (
            <GlassView
              key={value}
              glassEffectStyle="regular"
              tintColor={segment === value ? colors.basil : undefined}
              isInteractive
              style={{ borderRadius: 999 }}>
              <Pressable
                onPress={() => setSegment(value)}
                style={{ paddingHorizontal: 18, paddingVertical: 10 }}>
                <Txt
                  variant="caption"
                  weight="700"
                  tone={segment === value ? 'onAccent' : 'primary'}>
                  {value === 'tag' ? 'Tag' : value === 'woche' ? 'Woche' : 'Monat'}
                </Txt>
              </Pressable>
            </GlassView>
          ))}
        </GlassContainer>
      </Card>

      {/* Native SwiftUI Glass-Buttons via @expo/ui */}
      <Card title="Buttons — @expo/ui (natives SwiftUI-Glass)">
        <Txt variant="caption" tone="secondary" style={{ marginBottom: 12 }}>
          `buttonStyle('glass' | 'glassProminent')` — Apples eigener, system-nativer
          Glas-Button-Stil statt selbst gebauter `GlassView`.
        </Txt>
        <Host matchContents style={{ flexDirection: 'row' }}>
          <NativeButton
            label="Glass"
            systemImage="sparkles"
            modifiers={[buttonStyle('glass'), controlSize('regular')]}
            onPress={() => Alert.alert('Glass-Button', 'gedrückt')}
          />
        </Host>
        <View style={{ height: 10 }} />
        <Host matchContents style={{ flexDirection: 'row' }}>
          <NativeButton
            label="Glass Prominent"
            systemImage="star.fill"
            modifiers={[buttonStyle('glassProminent'), tint(colors.basil)]}
            onPress={() => Alert.alert('Glass Prominent', 'gedrückt')}
          />
        </Host>
        <View style={{ height: 10 }} />
        <Host matchContents style={{ flexDirection: 'row' }}>
          {/* biome-ignore lint/a11y/useValidAriaRole: Dies ist eine SwiftUI-ButtonRole von @expo/ui, keine ARIA-Rolle. */}
          <NativeButton
            label="Löschen"
            role="destructive"
            systemImage="trash"
            modifiers={[buttonStyle('glass')]}
            onPress={() => Alert.alert('Löschen', 'gedrückt')}
          />
        </Host>
      </Card>

      {/* SwiftUI ContextMenu mit Long-Press Trigger und Preview */}
      <Card title="Kontextmenü (Long-Press)">
        <Txt variant="caption" tone="secondary" style={{ marginBottom: 12 }}>
          Systemeigenes `ContextMenu` aus `@expo/ui` — auf iOS 26 rendert das Menü selbst bereits
          Liquid Glass, ohne dass wir etwas dafür tun. Öffnen: gedrückt halten. Schließen: Auswahl
          treffen oder daneben tippen.
        </Txt>
        <Host matchContents>
          <ContextMenu>
            {}
            <ContextMenu.Trigger>
              <VStack
                alignment="leading"
                spacing={2}
                modifiers={[
                  padding({ horizontal: 18, vertical: 16 }),
                  frame({ minWidth: 220 }),
                  glassEffect({ glass: { variant: 'regular' }, cornerRadius: 20 }),
                ]}>
                <Text modifiers={[font({ weight: 'bold' })]}>Rührei mit Toast</Text>
                <Text modifiers={[foregroundStyle(colors.textMuted)]}>
                  Gedrückt halten für Optionen
                </Text>
              </VStack>
            </ContextMenu.Trigger>
            <ContextMenu.Preview>
              <VStack
                alignment="leading"
                spacing={2}
                modifiers={[
                  padding({ all: 20 }),
                  frame({ minWidth: 220 }),
                  cornerRadius(20),
                  backgroundOverlay({ color: colors.bg }),
                ]}>
                <Text modifiers={[font({ weight: 'bold' })]}>Rührei mit Toast</Text>
                <Text modifiers={[foregroundStyle(colors.textMuted)]}>Frühstück · 2 Portionen</Text>
              </VStack>
            </ContextMenu.Preview>
            <ContextMenu.Items>
              <NativeButton
                systemImage="pencil"
                label="Bearbeiten"
                onPress={() => Alert.alert('Kontextmenü', 'Bearbeiten gewählt')}
              />
              <NativeButton
                systemImage="heart"
                label="Favorisieren"
                onPress={() => Alert.alert('Kontextmenü', 'Favorisieren gewählt')}
              />
              {/* biome-ignore lint/a11y/useValidAriaRole: Dies ist eine SwiftUI-ButtonRole von @expo/ui, keine ARIA-Rolle. */}
              <NativeButton
                systemImage="trash"
                label="Löschen"
                role="destructive"
                onPress={() => Alert.alert('Kontextmenü', 'Löschen gewählt')}
              />
            </ContextMenu.Items>
          </ContextMenu>
        </Host>
      </Card>

      {/* Menü-Varianten (Natives SwiftUI Menu vs. GlassView Popover) */}
      <Card title="Bearbeiten-Menü — zwei Varianten">
        <Txt variant="caption" tone="secondary" style={{ marginBottom: 12 }}>
          Variante A: natives `Menu` aus `@expo/ui`, öffnet/schließt komplett system-gesteuert
          (Tippen öffnet, Auswahl/Antippen daneben schließt).
        </Txt>
        <Host matchContents style={{ flexDirection: 'row' }}>
          <Menu label="Bearbeiten" systemImage="ellipsis.circle">
            <NativeButton
              systemImage="pencil"
              label="Bearbeiten"
              onPress={() => Alert.alert('Menü', 'Bearbeiten gewählt')}
            />
            <NativeButton
              systemImage="doc.on.doc"
              label="Duplizieren"
              onPress={() => Alert.alert('Menü', 'Duplizieren gewählt')}
            />
            <NativeButton
              systemImage="square.and.arrow.up"
              label="Teilen"
              onPress={() => Alert.alert('Menü', 'Teilen gewählt')}
            />
            {/* biome-ignore lint/a11y/useValidAriaRole: Dies ist eine SwiftUI-ButtonRole von @expo/ui, keine ARIA-Rolle. */}
            <NativeButton
              systemImage="trash"
              label="Löschen"
              role="destructive"
              onPress={() => Alert.alert('Menü', 'Löschen gewählt')}
            />
          </Menu>
        </Host>

        <View style={{ height: 20 }} />

        <Txt variant="caption" tone="secondary" style={{ marginBottom: 12 }}>
          Variante B: selbst gebautes Popover aus `GlassView`, Öffnen/Schließen per eigenem State —
          das Muster für eigene Action-Sheets (analog `inventory-item-actions-sheet.tsx`), nur mit
          Glas statt solider Fläche.
        </Txt>
        <View style={{ position: 'relative', alignItems: 'flex-start' }}>
          <GlassIconButton
            glyph="⋯"
            accessibilityLabel={
              editMenuOpen ? 'Bearbeiten-Menü schließen' : 'Bearbeiten-Menü öffnen'
            }
            onPress={() => setEditMenuOpen((open) => !open)}
          />
          <Txt variant="caption" tone="secondary" style={{ marginTop: 6 }}>
            Zustand: {editMenuOpen ? 'offen' : 'geschlossen'}
          </Txt>

          {editMenuOpen ? (
            // Nach oben öffnen, da dies die letzte Karte des Screens ist.
            <GlassView
              glassEffectStyle="regular"
              style={{
                position: 'absolute',
                bottom: '100%',
                marginBottom: 8,
                left: 0,
                borderRadius: 16,
                paddingVertical: 6,
                minWidth: 200,
                zIndex: 10,
              }}>
              {[
                { label: 'Bearbeiten', glyph: '✎', danger: false },
                { label: 'Duplizieren', glyph: '⧉', danger: false },
                { label: 'Löschen', glyph: '🗑', danger: true },
              ].map((item) => (
                <Pressable
                  key={item.label}
                  onPress={() => {
                    setEditMenuOpen(false);
                    Alert.alert('Eigenes Menü', `${item.label} gewählt`);
                  }}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 10,
                    paddingHorizontal: 16,
                    paddingVertical: 10,
                  }}>
                  <Txt variant="body">{item.glyph}</Txt>
                  <Txt variant="caption" weight="700" tone={item.danger ? 'danger' : 'primary'}>
                    {item.label}
                  </Txt>
                </Pressable>
              ))}
            </GlassView>
          ) : null}
        </View>
      </Card>

      {/* Typografie-Vergleich: Glasoberfläche vs. Solider Hintergrund */}
      <Card title="Schriften auf Glas vs. solide">
        <Txt variant="caption" tone="secondary" style={{ marginBottom: 12 }}>
          Lesbarkeits-Vergleich derselben `Txt`-Rollen auf Glas- und solider Fläche, über dem echten
          Hub-Verlauf.
        </Txt>
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <GlassView
            glassEffectStyle="regular"
            style={{ flex: 1, borderRadius: 20, padding: 14, gap: 4 }}>
            <TypeSample />
          </GlassView>
          <View
            style={{
              flex: 1,
              borderRadius: 20,
              padding: 14,
              gap: 4,
              backgroundColor: colors.bg,
            }}>
            <TypeSample />
          </View>
        </View>
      </Card>
    </Screen>
  );
}

function TypeSample() {
  return (
    <>
      <Txt variant="title">Titel</Txt>
      <Txt variant="subheading">Untertitel</Txt>
      <Txt variant="body">Fließtext in normaler Stärke.</Txt>
      <Txt variant="body" weight="700">
        Fließtext, fett.
      </Txt>
      <Txt variant="caption" tone="secondary">
        Kleiner Text, sekundär.
      </Txt>
      <Txt variant="label">LABEL</Txt>
      <Txt variant="caption" tone="secondary">
        Caption-Text für Meta-Infos.
      </Txt>
    </>
  );
}

/** Einfacher, beschrifteter Glas-Button für die Buttons-Sektion — bewusst
 * lokal in dieser Datei, kein neues app-weites Primitive (nur Testzweck). */
function GlassLabButton({
  label,
  onPress,
  tintColor,
  glassStyle = 'regular',
}: {
  label: string;
  onPress: () => void;
  tintColor?: string;
  glassStyle?: 'regular' | 'clear';
}) {
  return (
    <GlassView
      glassEffectStyle={glassStyle}
      tintColor={tintColor}
      isInteractive
      style={{ borderRadius: 14 }}>
      <Pressable onPress={onPress} style={{ paddingHorizontal: 16, paddingVertical: 12 }}>
        <Txt variant="caption" weight="700" tone={tintColor ? 'onAccent' : 'primary'}>
          {label}
        </Txt>
      </Pressable>
    </GlassView>
  );
}

/** Runder Icon-Glas-Button (z. B. FAB-Groesse via `size`). */
function GlassIconButton({
  glyph,
  accessibilityLabel,
  onPress,
  tintColor,
  size = 44,
}: {
  glyph: string;
  accessibilityLabel: string;
  onPress: () => void;
  tintColor?: string;
  size?: number;
}) {
  return (
    <GlassView
      glassEffectStyle="regular"
      tintColor={tintColor}
      isInteractive
      style={{ width: size, height: size, borderRadius: size / 2 }}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <Txt variant="body">{glyph}</Txt>
      </Pressable>
    </GlassView>
  );
}
