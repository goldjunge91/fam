import { useQueryClient } from '@tanstack/react-query';
import { Redirect, router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, View } from 'react-native';

import { Screen } from '@/components/layout/screen';
import { ContentCard } from '@/components/ui/content-card';
import { Button, Txt } from '@/constants/ui';
import { useSession } from '@/features/auth/session-provider';
import { describeDatabaseOwnership } from '@/features/settings/dev/dev-info';
import { useDevToolsAccess } from '@/hooks/use-dev-tools-access';
import { deleteLocalDatabase, getDatabase, runWithCurrentDatabase } from '@/lib/db/local-client';
import type { SerializedSqlDatabase } from '@/lib/db/serialize';
import {
  checkOffDumpIntegrity,
  forceRefreshOffDump,
  getOffDumpStatus,
  type OffDumpStatus,
  reinstallOffDumpBaseline,
} from '@/lib/off-dump/off-dump';
import { MAX_ATTEMPTS } from '@/lib/sync/backoff';
import {
  type DbSnapshot,
  devStyles,
  formatBytes,
  formatZeitpunkt,
  Zeile,
} from './dev-screen-shared';

export function DevDataScreen() {
  const { t, i18n } = useTranslation();
  const hasAccess = useDevToolsAccess();
  const { session } = useSession();
  const queryClient = useQueryClient();
  const [snapshot, setSnapshot] = useState<DbSnapshot | null>(null);
  const [offDump, setOffDump] = useState<OffDumpStatus | null>(null);
  const [dbError, setDbError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const ladeSnapshot = useCallback(async () => {
    try {
      const db = await getDatabase();
      setOffDump(await getOffDumpStatus(db));

      const zahl = async (sql: string, params: readonly (string | number)[] = []) =>
        (await db.getFirstAsync<{ c: number }>(sql, params))?.c ?? 0;

      const version = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
      const owner = await db.getFirstAsync<{ value: string }>(
        'select value from app_meta where key = ?',
        ['user_id'],
      );

      setSnapshot({
        userVersion: version?.user_version ?? 0,
        storedUserId: owner?.value ?? null,
        pending: await zahl('select count(*) as c from outbox where attempts < ?', [MAX_ATTEMPTS]),
        failed: await zahl('select count(*) as c from outbox where attempts >= ?', [MAX_ATTEMPTS]),
        fridgeItems: await zahl('select count(*) as c from fridge_items'),
        shoppingItems: await zahl('select count(*) as c from shopping_list_items'),
        storageLocations: await zahl('select count(*) as c from storage_locations'),
      });
      setDbError(null);
    } catch (error) {
      setDbError(error instanceof Error ? error.message : String(error));
    }
  }, []);

  useEffect(() => {
    void ladeSnapshot();
  }, [ladeSnapshot]);

  const ownership = describeDatabaseOwnership(
    snapshot?.storedUserId ?? null,
    session?.user.id ?? null,
  );

  async function mitBusy(name: string, action: () => Promise<void>) {
    if (busy) return;
    setBusy(name);
    try {
      await action();
    } catch (error) {
      Alert.alert(t('dev.states.failed'), error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(null);
    }
  }

  async function runOffDumpAction<T>(
    action: (db: SerializedSqlDatabase) => Promise<T>,
  ): Promise<T> {
    let result: T;
    try {
      result = await runWithCurrentDatabase(action);
    } catch (error) {
      try {
        setOffDump(await runWithCurrentDatabase(getOffDumpStatus));
      } catch {
        // Preserve the operation error; status cannot be refreshed without a usable connection.
      }
      throw error;
    }

    setOffDump(await runWithCurrentDatabase(getOffDumpStatus));
    return result;
  }

  function handleWipe() {
    Alert.alert(t('dev.data.deleteDatabaseTitle'), t('dev.data.deleteDatabaseMessage'), [
      { text: t('common.actions.cancel'), style: 'cancel' },
      {
        text: t('common.actions.delete'),
        style: 'destructive',
        onPress: () =>
          void mitBusy('wipe', async () => {
            await deleteLocalDatabase();
            await queryClient.resetQueries();
            await ladeSnapshot();
          }),
      },
    ]);
  }

  if (!hasAccess) {
    return <Redirect href="/settings" />;
  }

  return (
    <Screen
      title={t('dev.data.title')}
      subtitle={t('dev.data.subtitle')}
      back={{ label: t('dev.tools.title'), href: '/settings/dev' }}
      backStyle="icon">
      <ContentCard title={t('dev.data.database')}>
        {dbError ? (
          <Txt variant="caption" tone="danger">
            {t('dev.data.dbError', { error: dbError })}
          </Txt>
        ) : (
          <>
            <Zeile
              label={t('dev.data.userOwner')}
              wert={t(
                ownership.key,
                'userId' in ownership ? { userId: ownership.userId } : undefined,
              )}
              tone={
                ownership.key === 'dev.info.ownershipForeign'
                  ? 'danger'
                  : ownership.key === 'dev.info.ownershipMatches'
                    ? 'accent'
                    : 'warning'
              }
            />
            <Zeile
              label={t('dev.data.schemaVersion')}
              wert={String(snapshot?.userVersion ?? '—')}
            />
            <Zeile
              label={t('dev.data.outbox')}
              wert={t('dev.data.pending', {
                pending: snapshot?.pending ?? 0,
                failed: snapshot?.failed ?? 0,
              })}
              tone={snapshot && snapshot.failed > 0 ? 'danger' : undefined}
            />
            <Zeile
              label={t('dev.data.rows')}
              wert={t('dev.data.inventoryRows', {
                inventory: snapshot?.fridgeItems ?? 0,
                shopping: snapshot?.shoppingItems ?? 0,
                locations: snapshot?.storageLocations ?? 0,
              })}
            />
          </>
        )}

        <View style={devStyles.actionStack}>
          <Button title={t('dev.data.readAgain')} variant="secondary" onPress={ladeSnapshot} />
          <Button
            title={t('dev.data.syncDebug')}
            variant="secondary"
            onPress={() => router.push('/settings/sync-debug')}
          />
          <Button
            title={t('dev.data.deleteDatabase')}
            variant="danger"
            onPress={handleWipe}
            loading={busy === 'wipe'}
          />
        </View>
      </ContentCard>

      <ContentCard title={t('dev.data.dump')}>
        <Zeile
          label={t('dev.data.downloaded')}
          wert={
            offDump?.fileExists
              ? t('dev.data.downloadedFile', { size: formatBytes(offDump.fileSizeBytes) })
              : t('dev.data.no')
          }
          tone={offDump?.fileExists ? undefined : 'warning'}
        />
        <Zeile label={t('dev.data.schemaVersion')} wert={String(offDump?.schemaVersion ?? '—')} />
        <Zeile
          label={t('dev.data.dataVersion')}
          wert={formatZeitpunkt(offDump?.dataVersion ?? null, i18n.language)}
        />
        <Zeile
          label={t('dev.data.attached')}
          wert={offDump?.attached ? t('dev.data.yes') : t('dev.data.no')}
          tone={offDump?.attached ? undefined : 'warning'}
        />
        <Zeile
          label={t('dev.data.lastCheck')}
          wert={formatZeitpunkt(offDump?.lastCheckAt ?? null, i18n.language)}
        />
        <Zeile
          label={t('dev.data.lastUpdate')}
          wert={formatZeitpunkt(offDump?.lastSuccessfulUpdateAt ?? null, i18n.language)}
        />
        <Zeile
          label={t('dev.data.lastError')}
          wert={offDump?.lastError ?? '—'}
          tone={offDump?.lastError ? 'danger' : undefined}
        />

        <View style={devStyles.actionStack}>
          <Button
            title={t('dev.data.update')}
            variant="secondary"
            onPress={() =>
              void mitBusy('off-dump-update', async () => {
                await runOffDumpAction(forceRefreshOffDump);
              })
            }
            loading={busy === 'off-dump-update'}
          />
          <Button
            title={t('dev.data.baseline')}
            variant="secondary"
            onPress={() =>
              Alert.alert(t('dev.data.baselineTitle'), t('dev.data.baselineMessage'), [
                { text: t('common.actions.cancel'), style: 'cancel' },
                {
                  text: t('dev.data.reinstall'),
                  onPress: () =>
                    void mitBusy('off-dump-baseline', async () => {
                      await runOffDumpAction(reinstallOffDumpBaseline);
                    }),
                },
              ])
            }
            loading={busy === 'off-dump-baseline'}
          />
          <Button
            title={t('dev.data.integrity')}
            variant="secondary"
            onPress={() =>
              void mitBusy('off-dump-integrity', async () => {
                const ok = await runOffDumpAction(checkOffDumpIntegrity);
                Alert.alert(
                  t('dev.data.integrityTitle'),
                  ok ? t('dev.data.integrityOk') : t('dev.data.integrityFailed'),
                );
              })
            }
            loading={busy === 'off-dump-integrity'}
          />
        </View>
      </ContentCard>
    </Screen>
  );
}
