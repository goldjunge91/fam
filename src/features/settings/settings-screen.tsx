import { useQueryClient } from '@tanstack/react-query';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useSession } from '@/features/auth/session-provider';
import { signOutAndClearLocalData } from '@/features/auth/sign-out';
import { useCurrentGoal } from '@/features/calorie-tracking/api';
import { useActiveHousehold } from '@/features/household/active-household-provider';
import { classifySupabaseTarget } from '@/features/settings/dev/dev-info';
import { SettingsGroup, SettingsRow } from '@/features/settings/settings-menu';
import { env } from '@/lib/env';

/**
 * Einstellungen als Verzeichnis, nicht als Sammelseite.
 *
 * Vorher lag hier alles untereinander: Profilzeile, Haushaltsaktionen,
 * Lagerorte, das komplette Benachrichtigungsformular, der Sync-Status samt
 * Knoepfen und Fehlermeldung. Das war eine lange Scrollstrecke, auf der
 * Anzeigen, Aktionen und Formulare optisch gleich aussahen.
 *
 * Jetzt fuehrt jeder Punkt auf seine eigene Seite. Was auf der Uebersicht
 * bleibt, ist der jeweils aktuelle Wert rechts — angemeldete Adresse, aktiver
 * Haushalt —, damit der haeufigste Grund fuer einen Blick in die Einstellungen
 * ohne Antippen beantwortet ist.
 *
 * Kein eigener Sync-Status/-Trigger hier: `SyncStatusBanner` zeigt den
 * Zustand bereits app-weit an, manuelles Anstossen geht ueber Pull-to-Refresh
 * im Dashboard. Die Detailseite (`/settings/sync`) bleibt fuer Diagnosezwecke
 * ausschliesslich ueber die Entwickler-Werkzeuge erreichbar.
 */
export function SettingsScreen() {
  const { session } = useSession();
  const queryClient = useQueryClient();
  const [signingOut, setSigningOut] = useState(false);

  const { activeHousehold } = useActiveHousehold();
  const { data: currentGoal } = useCurrentGoal(session?.user.id);

  async function handleSignOut() {
    if (signingOut) return;
    setSigningOut(true);

    const { error } = await signOutAndClearLocalData(queryClient);

    setSigningOut(false);

    if (error) {
      Alert.alert('Abmelden fehlgeschlagen', error.message);
    } else {
      router.replace('/onboarding');
    }
  }

  const hasHousehold = Boolean(activeHousehold);

  // Schon in der Uebersicht sichtbar, nicht erst eine Ebene tiefer: Ob dieser
  // Build gegen die echten Daten laeuft, ist die Information, die man beim
  // Ausprobieren nicht suchen wollen sollte.
  const supabaseTarget = env.devTools
    ? classifySupabaseTarget(env.supabaseUrl)
    : { label: '', tone: 'accent' as const };

  const appVersion = Constants.expoConfig?.version ?? '1.0.0';

  return (
    <Screen title="Einstellungen">
      <View style={styles.groups}>
        <SettingsGroup title="Konto">
          <SettingsRow
            icon="👤"
            label="Profil"
            value={session?.user.email ?? '—'}
            onPress={() => router.push('/settings/profile')}
            last
          />
        </SettingsGroup>

        <SettingsGroup title="Haushalt">
          <SettingsRow
            icon="🏠"
            label="Mitglieder"
            value={activeHousehold?.name ?? 'Kein Haushalt'}
            hint={hasHousehold ? undefined : 'Haushalt wechseln oder beitreten'}
            onPress={() => router.push('/household/members')}
          />
          <SettingsRow
            icon="📦"
            label="Lagerorte"
            hint="Kühlschrank, Tiefkühler, Vorratskammer"
            onPress={hasHousehold ? () => router.push('/household/storage-locations') : undefined}
            disabled={!hasHousehold}
          />
          <SettingsRow
            icon="🏬"
            label="Märkte"
            hint="REWE, Aldi, Lidl, ..."
            onPress={hasHousehold ? () => router.push('/household/stores') : undefined}
            disabled={!hasHousehold}
            last
          />
        </SettingsGroup>

        <SettingsGroup title="App">
          <SettingsRow
            icon="🔔"
            label="Benachrichtigungen"
            onPress={() => router.push('/settings/notifications')}
          />
          <SettingsRow
            icon="🧩"
            label="Module"
            hint="Vorrat, Einkauf, Tagebuch, Rezepte"
            onPress={() => router.push('/settings/modules')}
            last
          />
        </SettingsGroup>

        <SettingsGroup title="Ziele & Daten">
          <SettingsRow
            icon="🎯"
            label="Kalorienziel"
            value={currentGoal ? `${currentGoal.daily_kcal ?? '–'} kcal` : 'nicht gesetzt'}
            onPress={() => router.push('/settings/goals')}
          />
          <SettingsRow icon="📤" label="Export" onPress={() => router.push('/settings/export')} />
          <SettingsRow
            icon="🔒"
            label="Datenschutz"
            onPress={() => router.push('/settings/privacy')}
          />
          <SettingsRow
            icon="🗑️"
            label="Konto löschen"
            onPress={() => router.push('/settings/delete-account')}
            last
          />
        </SettingsGroup>

        {/* Nur mit EXPO_PUBLIC_DEV_TOOLS=true. Die Gruppe verschwindet dann
            vollstaendig statt nur deaktiviert zu sein — ein ausgegrauter
            Eintrag "Entwickler" waere fuer Nutzer eine Frage ohne Antwort. */}
        {env.devTools ? (
          <SettingsGroup title="Entwickler">
            <SettingsRow
              icon="🛠"
              label="Entwickler-Werkzeuge"
              hint="Umgebung, Session, lokale Datenbank"
              value={supabaseTarget.label}
              onPress={() => router.push('/settings/dev')}
              last
            />
          </SettingsGroup>
        ) : null}
      </View>

      <View style={styles.abmelden}>
        <Button label="Abmelden" variant="danger" onPress={handleSignOut} loading={signingOut} />
      </View>

      <View style={styles.versionContainer}>
        <ThemedText type="small" style={styles.versionText}>
          {`fam v${appVersion}`}
        </ThemedText>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  groups: {
    gap: Spacing.four,
  },
  abmelden: {
    marginTop: Spacing.five,
  },
  versionContainer: {
    alignItems: 'center',
    marginTop: Spacing.four,
    marginBottom: Spacing.two,
  },
  versionText: {
    opacity: 0.6,
  },
});
