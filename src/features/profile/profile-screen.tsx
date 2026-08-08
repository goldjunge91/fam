import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useSession } from '@/features/auth/session-provider';
import { signOutAndClearLocalData } from '@/features/auth/sign-out';
import { useActiveHousehold } from '@/features/household/active-household-provider';
import { useTheme } from '@/hooks/use-theme';

type ZeileProps = {
  label: string;
  wert: string;
  /** Noch nicht umgesetzt — wird als solches gekennzeichnet, statt so zu tun als ginge es. */
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

export function ProfileScreen() {
  const { session } = useSession();
  const queryClient = useQueryClient();
  const [signingOut, setSigningOut] = useState(false);
  const { activeHousehold } = useActiveHousehold();
  const currentHousehold = activeHousehold;

  async function handleSignOut() {
    if (signingOut) return;
    setSigningOut(true);

    const { error } = await signOutAndClearLocalData(queryClient);

    setSigningOut(false);

    if (error) {
      Alert.alert('Abmelden fehlgeschlagen', error.message);
      return;
    }
    router.replace('/onboarding');
  }

  return (
    <Screen title="Profil">
      <Card title="Konto">
        <Zeile label="Angemeldet als" wert={session?.user.email ?? '—'} />
        <Zeile label="Haushalt" wert={currentHousehold?.name ?? 'Lädt...'} />
        <View style={styles.aktion}>
          <Button
            label="Profil ergänzen"
            variant="secondary"
            onPress={() => router.push('/onboarding')}
          />
          {currentHousehold && (
            <View style={{ marginTop: 8, gap: 8 }}>
              <Button
                label="Mitglieder verwalten"
                variant="secondary"
                onPress={() => router.push('/household/members')}
              />
              <Button
                label="Lagerorte verwalten"
                variant="secondary"
                onPress={() => router.push('/household/storage-locations')}
              />
            </View>
          )}
        </View>
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

      <Button label="Abmelden" variant="danger" onPress={handleSignOut} loading={signingOut} />
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
  aktion: {
    marginTop: Spacing.two,
  },
});
