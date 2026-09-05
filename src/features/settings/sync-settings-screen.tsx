import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Screen } from '@/components/layout/screen';
import { Button } from '@/components/ui/buttons';
import { Card } from '@/components/ui/card';
import { Txt } from '@/constants/ui';
import { useActiveHousehold } from '@/features/household/active-household-provider';
import { describeSyncStatus } from '@/features/settings/sync-status-text';
import { useSyncStatus } from '@/hooks/use-sync-status';
import { trackAnalyticsEvent } from '@/lib/analytics';
import { getDatabase } from '@/lib/db/client';
import { syncRunHasErrors, triggerHouseholdSync } from '@/lib/sync/sync-runner';

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
    trackAnalyticsEvent('sync.manual.started', { source: 'sync_settings' });

    try {
      const result = await triggerHouseholdSync([activeHousehold.id], true);
      trackAnalyticsEvent(
        syncRunHasErrors(result) ? 'sync.manual.failed' : 'sync.manual.completed',
        { source: 'sync_settings' },
      );
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
      <Card title="Status">
        <Txt variant="body" tone="secondary">
          Daten werden im Hintergrund automatisch synchronisiert.
        </Txt>
        {/* Die Card-Komponente setzt den Abstand zwischen ihren Kindern. */}
        <Txt variant="body" weight="700" tone={tone}>
          {text}
        </Txt>
        {lastErrorMsg ? (
          <Txt variant="body" tone="danger">
            Ursache: {lastErrorMsg}
          </Txt>
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
