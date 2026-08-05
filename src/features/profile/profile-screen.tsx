import { StyleSheet, View } from 'react-native';

import { Card } from '@/components/card';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type ZeileProps = {
  label: string;
  wert: string;
  /** Noch nicht umgesetzt — wird sichtbar als solches gekennzeichnet, statt so zu tun als ginge es. */
  offen?: boolean;
};

function Zeile({ label, wert, offen }: ZeileProps) {
  const theme = useTheme();

  return (
    <View style={[styles.zeile, { borderBottomColor: theme.border }]}>
      <ThemedText type="small">{label}</ThemedText>
      <ThemedText type="small" themeColor={offen ? 'textSecondary' : 'text'}>
        {wert}
      </ThemedText>
    </View>
  );
}

/**
 * Profil und Einstellungen (#94).
 *
 * Zeigt bewusst an, was noch nicht implementiert ist, statt Schalter
 * anzubieten, die nichts tun.
 */
export function ProfileScreen() {
  return (
    <Screen title="Profil">
      <Card title="Konto">
        <Zeile label="Anmeldung" wert="noch nicht eingerichtet" offen />
        <Zeile label="Haushalt" wert="keiner" offen />
      </Card>

      <Card title="Ziele">
        <Zeile label="Kalorienziel" wert="nicht gesetzt" offen />
        <Zeile label="Makro-Verteilung" wert="nicht gesetzt" offen />
      </Card>

      <Card title="Daten">
        <Zeile label="Export" wert="in Vorbereitung" offen />
        <Zeile label="Konto löschen" wert="in Vorbereitung" offen />
      </Card>

      <Card title="Datenschutz">
        <ThemedText type="small" themeColor="textSecondary">
          Vorrat und Einkaufsliste teilst du mit deinem Haushalt. Kalorien, Gewicht und Ziele
          bleiben privat — die Trennung ist in der Datenbank erzwungen, nicht nur in der Anzeige.
        </ThemedText>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  zeile: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.two,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
});
