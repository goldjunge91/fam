import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useSession } from '@/features/auth/session-provider';
import { signOutAndClearLocalData } from '@/features/auth/sign-out';
import { useActiveHousehold } from '@/features/household/active-household-provider';
import { NotificationSettingsCard } from '@/features/settings/notification-settings-card';
import { useSyncStatus } from '@/hooks/use-sync-status';
import { useTheme } from '@/hooks/use-theme';
import { getDatabase } from '@/lib/db/client';
import { triggerHouseholdSync } from '@/lib/sync/sync-runner';

type ZeileProps = {
  label: string;
  wert: string;
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

export function SettingsScreen() {
  const { session } = useSession();
  const queryClient = useQueryClient();
  const [signingOut, setSigningOut] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastErrorMsg, setLastErrorMsg] = useState<string | null>(null);

  const { activeHousehold } = useActiveHousehold();
  const currentHousehold = activeHousehold;
  const syncStatus = useSyncStatus(getDatabase);

  useEffect(() => {
    if (syncStatus.kind === 'failed') {
      getDatabase().then((db) => {
        db.getFirstAsync<{ last_error: string | null }>(
          'select last_error from outbox where last_error is not null order by id desc limit 1',
        ).then((row) => {
          if (row?.last_error) {
            setLastErrorMsg(row.last_error);
          }
        });
      });
    } else {
      setLastErrorMsg(null);
    }
  }, [syncStatus.kind]);

  async function handleManualSync() {
    if (isSyncing || !currentHousehold) return;
    setIsSyncing(true);

    try {
      await triggerHouseholdSync([currentHousehold.id], true);
      queryClient.invalidateQueries();
    } finally {
      setIsSyncing(false);
    }
  }

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

  let syncStatusText = 'Alle Daten sind synchronisiert';
  let syncStatusColor: 'accent' | 'warning' | 'danger' = 'accent';

  if (syncStatus.kind === 'offline') {
    syncStatusText =
      syncStatus.pendingCount > 0
        ? `Offline (${syncStatus.pendingCount} Änderungen ausstehend)`
        : 'Offline (Keine Internetverbindung)';
    syncStatusColor = 'warning';
  } else if (syncStatus.kind === 'syncing') {
    syncStatusText = `Synchronisiere … (${syncStatus.pendingCount} ausstehend)`;
    syncStatusColor = 'warning';
  } else if (syncStatus.kind === 'failed') {
    syncStatusText = `${syncStatus.failedCount} Änderungen konnten nicht synchronisiert werden.`;
    syncStatusColor = 'danger';
  }

  return (
    <Screen title="Einstellungen">
      <Card title="Profil">
        <Zeile label="Angemeldet als" wert={session?.user.email ?? '—'} />
        <View style={styles.aktion}>
          <Button
            label="Profil ergänzen / bearbeiten"
            variant="secondary"
            onPress={() => router.push('/settings/profile')}
          />
        </View>
      </Card>

      <Card title="Haushalt & Mitnutzer">
        <Zeile label="Aktueller Haushalt" wert={currentHousehold?.name ?? 'Lädt...'} />
        {currentHousehold && (
          <View style={styles.aktionStack}>
            <Button
              label="Mitglieder verwalten"
              variant="secondary"
              onPress={() => router.push('/household/members')}
            />
          </View>
        )}
      </Card>

      <Card title="Lagerorte">
        <ThemedText type="small" themeColor="textSecondary">
          Verwalte vordefinierte Orte wie Kühlschrank, Tiefkühltruhe und Abstellkammer oder lege
          neue an.
        </ThemedText>
        {currentHousehold && (
          <View style={styles.aktion}>
            <Button
              label="Lagerorte verwalten"
              variant="secondary"
              onPress={() => router.push('/household/storage-locations')}
            />
          </View>
        )}
      </Card>

      <NotificationSettingsCard />

      <Card title="Synchronisation">
        <ThemedText type="small" themeColor="textSecondary">
          Daten werden im Hintergrund automatisch synchronisiert.
        </ThemedText>
        <ThemedText
          type="smallBold"
          themeColor={syncStatusColor}
          style={{ marginTop: Spacing.two }}>
          {syncStatusText}
        </ThemedText>
        {lastErrorMsg && (
          <ThemedText type="small" themeColor="danger" style={{ marginTop: Spacing.one }}>
            Ursache: {lastErrorMsg}
          </ThemedText>
        )}
        <View style={styles.aktionStack}>
          <Button
            label={
              syncStatus.kind === 'failed'
                ? 'Fehlgeschlagene erneut versuchen'
                : 'Jetzt synchronisieren'
            }
            onPress={handleManualSync}
            loading={isSyncing}
            disabled={!currentHousehold}
          />
          <Button
            label="Sync-Diagnose & Outbox anzeigen"
            variant="secondary"
            onPress={() => router.push('/settings/sync-debug')}
          />
        </View>
      </Card>

      <Card title="Ziele & Daten">
        <Zeile label="Kalorienziel" wert="nicht gesetzt" offen />
        <Zeile label="Export" wert="in Vorbereitung" offen />
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
    marginTop: Spacing.three,
  },
  aktionStack: {
    marginTop: Spacing.three,
    gap: Spacing.two,
  },
});
