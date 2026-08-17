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
import { Card } from '@/components/card';
import { useGlassAvailable } from '@/components/glass-card';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { useHubGradient } from '@/hooks/use-hub-gradient';
import { useTheme } from '@/hooks/use-theme';

/**
 * Entwickler-Testseite fuer Liquid Glass (Phase C, #Nachtrag) — Spielwiese
 * fuer alles, was `expo-glass-effect` und `@expo/ui`s SwiftUI-Glass koennen,
 * bevor es irgendwo im echten Produkt landet. Bewusst mit Inline-Styles statt
 * durchgaengiger NativeWind-Klassen (`GlassView`/`Host` haben ohnehin kein
 * `cssInterop`, s. docs/design-system/nativewind-liquid-glass-migration.md
 * "KRITISCH") und ohne vorherigen Mock — reine Werkstatt, kein
 * Design-Entscheid. Nur sichtbar mit `EXPO_PUBLIC_DEV_TOOLS=true`.
 *
 * Auf Android/iOS < 26 zeigt jeder Abschnitt seinen dokumentierten
 * Fallback-Zustand (solide Flaeche) statt zu crashen — das ist hier
 * ausdruecklich Teil der Vorfuehrung, kein Bug.
 */
export function LiquidGlassLabScreen() {
  const theme = useTheme();
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
          <ThemedText type="small" themeColor="textSecondary">
            expo-glass-effect verfügbar
          </ThemedText>
          <ThemedText type="smallBold" themeColor={glassAvailable ? 'success' : 'danger'}>
            {glassAvailable ? 'true' : 'false'}
          </ThemedText>
        </View>
        <ThemedText type="caption" themeColor="textSecondary">
          Nur auf iOS 26+ (echtes Gerät oder Simulator-Runtime), ohne Reduce Transparency, außerhalb
          von Expo Go — sonst zeigt jede Kachel unten ihren soliden Fallback.
        </ThemedText>
      </Card>

      {/* ---------------------------------------------------------------- */}
      <Card title="Buttons — expo-glass-effect">
        <ThemedText type="caption" themeColor="textSecondary" style={{ marginBottom: 12 }}>
          `GlassView` mit verschiedenen Tints/Styles, dieselbe Komponente wie im Dashboard.
        </ThemedText>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
          <GlassLabButton label="Primär" tintColor={theme.accent} onPress={() => {}} />
          <GlassLabButton label="Sekundär" onPress={() => {}} />
          <GlassLabButton label="Löschen" tintColor={theme.danger} onPress={() => {}} />
          <GlassLabButton label="Clear-Style" glassStyle="clear" onPress={() => {}} />
        </View>

        <View style={{ flexDirection: 'row', gap: 16, marginTop: 16, alignItems: 'center' }}>
          <GlassIconButton glyph="+" accessibilityLabel="Hinzufügen" onPress={() => {}} />
          <GlassIconButton
            glyph="✎"
            accessibilityLabel="Bearbeiten"
            tintColor={theme.accent}
            onPress={() => {}}
          />
          <GlassIconButton
            glyph="🗑"
            accessibilityLabel="Löschen"
            tintColor={theme.danger}
            onPress={() => {}}
          />
          <GlassIconButton
            glyph="+"
            accessibilityLabel="Groß hinzufügen"
            size={64}
            onPress={() => {}}
          />
        </View>

        <ThemedText
          type="caption"
          themeColor="textSecondary"
          style={{ marginTop: 16, marginBottom: 8 }}>
          Segmentierte Auswahl (`GlassContainer` + `isInteractive`)
        </ThemedText>
        <GlassContainer spacing={8} style={{ flexDirection: 'row', gap: 8 }}>
          {(['tag', 'woche', 'monat'] as const).map((value) => (
            <GlassView
              key={value}
              glassEffectStyle="regular"
              tintColor={segment === value ? theme.accent : undefined}
              isInteractive
              style={{ borderRadius: 999 }}>
              <Pressable
                onPress={() => setSegment(value)}
                style={{ paddingHorizontal: 18, paddingVertical: 10 }}>
                <ThemedText type="smallBold" themeColor={segment === value ? 'onAccent' : 'text'}>
                  {value === 'tag' ? 'Tag' : value === 'woche' ? 'Woche' : 'Monat'}
                </ThemedText>
              </Pressable>
            </GlassView>
          ))}
        </GlassContainer>
      </Card>

      {/* ---------------------------------------------------------------- */}
      <Card title="Buttons — @expo/ui (natives SwiftUI-Glass)">
        <ThemedText type="caption" themeColor="textSecondary" style={{ marginBottom: 12 }}>
          `buttonStyle('glass' | 'glassProminent')` — Apples eigener, system-nativer
          Glas-Button-Stil statt selbst gebauter `GlassView`.
        </ThemedText>
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
            modifiers={[buttonStyle('glassProminent'), tint(theme.accent)]}
            onPress={() => Alert.alert('Glass Prominent', 'gedrückt')}
          />
        </Host>
        <View style={{ height: 10 }} />
        <Host matchContents style={{ flexDirection: 'row' }}>
          {/* biome-ignore lint/a11y/useValidAriaRole: `role` ist hier @expo/ui's SwiftUI-`ButtonRole` ('destructive'), keine ARIA-Rolle. */}
          <NativeButton
            label="Löschen"
            role="destructive"
            systemImage="trash"
            modifiers={[buttonStyle('glass')]}
            onPress={() => Alert.alert('Löschen', 'gedrückt')}
          />
        </Host>
      </Card>

      {/* ---------------------------------------------------------------- */}
      <Card title="Kontextmenü (Long-Press)">
        <ThemedText type="caption" themeColor="textSecondary" style={{ marginBottom: 12 }}>
          Systemeigenes `ContextMenu` aus `@expo/ui` — auf iOS 26 rendert das Menü selbst bereits
          Liquid Glass, ohne dass wir etwas dafür tun. Öffnen: gedrückt halten. Schließen: Auswahl
          treffen oder daneben tippen.
        </ThemedText>
        <Host matchContents>
          <ContextMenu>
            {/* Trigger/Preview bewusst rein aus @expo/ui-Primitiven (VStack +
            Text + glassEffect-Modifier), nicht aus `GlassView`
            (expo-glass-effect) — zwei verschiedene native Module in einem
            SwiftUI-Host verschachtelt haben den Long-Press nicht ausgeloest,
            vermutlich weil `GlassView`s eigene UIView-Gestenerkennung dem
            `ContextMenu`s `UIContextMenuInteraction` in die Quere kam. */}
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
                <Text modifiers={[foregroundStyle(theme.textSecondary)]}>
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
                  backgroundOverlay({ color: theme.backgroundElement }),
                ]}>
                <Text modifiers={[font({ weight: 'bold' })]}>Rührei mit Toast</Text>
                <Text modifiers={[foregroundStyle(theme.textSecondary)]}>
                  Frühstück · 2 Portionen
                </Text>
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
              {/* biome-ignore lint/a11y/useValidAriaRole: `role` ist hier @expo/ui's SwiftUI-`ButtonRole` ('destructive'), keine ARIA-Rolle. */}
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

      {/* ---------------------------------------------------------------- */}
      <Card title="Bearbeiten-Menü — zwei Varianten">
        <ThemedText type="caption" themeColor="textSecondary" style={{ marginBottom: 12 }}>
          Variante A: natives `Menu` aus `@expo/ui`, öffnet/schließt komplett system-gesteuert
          (Tippen öffnet, Auswahl/Antippen daneben schließt).
        </ThemedText>
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
            {/* biome-ignore lint/a11y/useValidAriaRole: `role` ist hier @expo/ui's SwiftUI-`ButtonRole` ('destructive'), keine ARIA-Rolle. */}
            <NativeButton
              systemImage="trash"
              label="Löschen"
              role="destructive"
              onPress={() => Alert.alert('Menü', 'Löschen gewählt')}
            />
          </Menu>
        </Host>

        <View style={{ height: 20 }} />

        <ThemedText type="caption" themeColor="textSecondary" style={{ marginBottom: 12 }}>
          Variante B: selbst gebautes Popover aus `GlassView`, Öffnen/Schließen per eigenem State —
          das Muster für eigene Action-Sheets (analog `fridge-item-actions-sheet.tsx`), nur mit Glas
          statt solider Fläche.
        </ThemedText>
        <View style={{ position: 'relative', alignItems: 'flex-start' }}>
          <GlassIconButton
            glyph="⋯"
            accessibilityLabel={
              editMenuOpen ? 'Bearbeiten-Menü schließen' : 'Bearbeiten-Menü öffnen'
            }
            onPress={() => setEditMenuOpen((open) => !open)}
          />
          <ThemedText type="caption" themeColor="textSecondary" style={{ marginTop: 6 }}>
            Zustand: {editMenuOpen ? 'offen' : 'geschlossen'}
          </ThemedText>

          {editMenuOpen ? (
            // Klappt bewusst nach OBEN auf (`bottom: '100%'` statt `top`):
            // dieser Block ist die letzte Card auf dem Screen, "nach unten"
            // ragte das Menü ueber den Bildschirmrand hinaus und wurde
            // abgeschnitten.
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
                  <ThemedText type="body">{item.glyph}</ThemedText>
                  <ThemedText type="smallBold" themeColor={item.danger ? 'danger' : 'text'}>
                    {item.label}
                  </ThemedText>
                </Pressable>
              ))}
            </GlassView>
          ) : null}
        </View>
      </Card>

      {/* ---------------------------------------------------------------- */}
      <Card title="Schriften auf Glas vs. solide">
        <ThemedText type="caption" themeColor="textSecondary" style={{ marginBottom: 12 }}>
          Lesbarkeits-Vergleich derselben `ThemedText`-Rollen auf Glas- und solider Fläche, über dem
          echten Hub-Verlauf.
        </ThemedText>
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
              backgroundColor: theme.backgroundElement,
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
      <ThemedText type="title">Titel</ThemedText>
      <ThemedText type="subtitle">Untertitel</ThemedText>
      <ThemedText type="body">Fließtext in normaler Stärke.</ThemedText>
      <ThemedText type="bodyBold">Fließtext, fett.</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        Kleiner Text, sekundär.
      </ThemedText>
      <ThemedText type="label">LABEL</ThemedText>
      <ThemedText type="caption" themeColor="textSecondary">
        Caption-Text für Meta-Infos.
      </ThemedText>
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
        <ThemedText type="smallBold" themeColor={tintColor ? 'onAccent' : 'text'}>
          {label}
        </ThemedText>
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
        <ThemedText type="body">{glyph}</ThemedText>
      </Pressable>
    </GlassView>
  );
}
