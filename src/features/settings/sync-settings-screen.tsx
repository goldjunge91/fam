import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Screen } from '@/components/layout/screen';
import { ThemedText } from '@/components/theme/themed-text';
import { Button } from '@/components/ui/buttons';
import { Card } from '@/components/ui/card';
import { useActiveHousehold } from '@/features/household/active-household-provider';
import { describeSyncStatus } from '@/features/settings/sync-status-text';
import { useSyncStatus } from '@/hooks/use-sync-status';
import { getDatabase } from '@/lib/db/client';
import { triggerHouseholdSync } from '@/lib/sync/sync-runner';

/**
 * Synchronisation als eigene Seite.
 *
 * Auf der Uebersicht steht nur noch der Zustand in einer Zeile; alles, was man
 * dazu tun kann — manuell anstossen, Fehlgeschlagene erneut versuchen, in die
 * Diagnose schauen — liegt hier.
 */
export function SyncSettingsScreen() {
  const queryClient = useQueryClient();
  const { activeHousehold } = useActiveHousehold();
  const syncStatus = useSyncStatus(getDatabase);

  const [isSyncing, setIsSyncing] = useState(false);
  const [lastErrorMsg, setLastErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (syncStatus.kind !== 'failed') {
      setLastErrorMsg(null);
      return;
    }

    getDatabase().then((db) => {
      db.getFirstAsync<{ last_error: string | null }>(
        'select last_error from outbox where last_error is not null order by id desc limit 1',
      ).then((row) => {
        if (row?.last_error) setLastErrorMsg(row.last_error);
      });
    });
  }, [syncStatus.kind]);

  async function handleManualSync() {
    if (isSyncing || !activeHousehold) return;
    setIsSyncing(true);

    try {
      await triggerHouseholdSync([activeHousehold.id], true);
      queryClient.invalidateQueries();
    } finally {
      setIsSyncing(false);
    }
  }

  const { text, tone } = describeSyncStatus(syncStatus);

  return (
    <Screen
      title="Synchronisation"
      back={{ label: 'Einstellungen', href: '/settings' }}
      backStyle="icon">
      {/* Statuskarte mit aktuellem Sync-Zustand, Fehlermeldungen und manuellen Sync-Aktionen */}
      <Card title="Status">
        <ThemedText type="small" themeColor="textSecondary">
          Daten werden im Hintergrund automatisch synchronisiert.
        </ThemedText>
        {/* Kein separates marginTop mehr: card-fam liefert bereits gap-two
            zwischen allen Kindern (Card-Komponente). */}
        <ThemedText type="smallBold" themeColor={tone}>
          {text}
        </ThemedText>
        {lastErrorMsg ? (
          <ThemedText type="small" themeColor="danger">
            Ursache: {lastErrorMsg}
          </ThemedText>
        ) : null}

        <View className="action-stack">
          <Button
            label={
              syncStatus.kind === 'failed'
                ? 'Fehlgeschlagene erneut versuchen'
                : 'Jetzt synchronisieren'
            }
            onPress={handleManualSync}
            loading={isSyncing}
            disabled={!activeHousehold}
          />
          <Button
            label="Sync-Diagnose & Outbox anzeigen"
            variant="secondary"
            onPress={() => router.push('/settings/sync-debug')}
          />
        </View>
      </Card>
    </Screen>
  );
}
