import { StyleSheet, View } from 'react-native';

import { Card } from '@/components/card';
import { EmptyState } from '@/components/empty-state';
import { MacroBar } from '@/components/macro-bar';
import { ProgressRing } from '@/components/progress-ring';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';

/**
 * Tagesuebersicht (#93).
 *
 * Solange Datenschicht (#30) und Ziele (#84) fehlen, stehen hier Nullwerte und
 * ein Hinweis darauf, was als Naechstes zu tun ist — bewusst keine Beispiel-
 * daten. Eine Ernaehrungs-App, die erfundene Zahlen zeigt, ist schlimmer als
 * eine leere.
 *
 * Streaks, XP und Level fehlen absichtlich: Gamification kommt erst in Phase 4,
 * wenn die Datenbasis darunter stimmt.
 */
export function DashboardScreen() {
  const heute = new Date().toLocaleDateString('de-DE', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  // Platzhalter bis #87 (Tagessummen) und #84 (Ziele) angebunden sind.
  const aufgenommen = 0;
  const ziel = 0;

  return (
    <Screen title="Übersicht" subtitle={heute}>
      <Card>
        <ProgressRing value={aufgenommen} target={ziel} label="Kalorien" />
        {ziel === 0 ? (
          <ThemedText type="small" themeColor="textSecondary" style={styles.centered}>
            Noch kein Kalorienziel gesetzt. Lege es im Profil an, damit hier ein Fortschritt
            erscheint.
          </ThemedText>
        ) : null}
      </Card>

      <Card title="Makronährstoffe">
        <View style={styles.macros}>
          <MacroBar label="Eiweiß" value={0} target={0} />
          <MacroBar label="Kohlenhydrate" value={0} target={0} />
          <MacroBar label="Fett" value={0} target={0} />
        </View>
      </Card>

      <Card title="Läuft bald ab">
        <EmptyState
          symbol="checkmark.circle"
          title="Nichts läuft demnächst ab"
          hint="Sobald du Vorräte mit Mindesthaltbarkeitsdatum erfasst, erscheinen sie hier."
        />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  centered: {
    textAlign: 'center',
    marginTop: Spacing.two,
  },
  macros: {
    gap: Spacing.three,
  },
});
