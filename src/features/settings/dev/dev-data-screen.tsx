import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, View } from 'react-native';

import { Screen } from '@/components/layout/screen';
import { Card } from '@/components/ui/card';
import { Button, Txt } from '@/constants/ui';
import { useSession } from '@/features/auth/session-provider';
import { describeDatabaseOwnership } from '@/features/settings/dev/dev-info';
import { deleteLocalDatabase, getDatabase } from '@/lib/db/local-client';
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
      Alert.alert('Fehlgeschlagen', error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(null);
    }
  }

  function handleWipe() {
    Alert.alert(
      'Lokale Datenbank löschen?',
      'Alle lokal gespiegelten Daten und die Outbox werden verworfen. Noch nicht ' +
        'synchronisierte Änderungen gehen dabei verloren. Serverdaten bleiben unberührt.',
      [
        { text: 'Abbrechen', style: 'cancel' },
        {
          text: 'Löschen',
          style: 'destructive',
          onPress: () =>
            void mitBusy('wipe', async () => {
              await deleteLocalDatabase();
              await queryClient.resetQueries();
              await ladeSnapshot();
            }),
        },
      ],
    );
  }

  return (
    <Screen
      title="Daten & Synchronisation"
      subtitle="Lokale Datenbank, Katalog-Dump und Outbox"
      back={{ label: 'Entwickler', href: '/settings/dev' }}
      backStyle="icon">
      <Card title="Lokale Datenbank">
        {dbError ? (
          <Txt variant="caption" tone="danger">
            Nicht lesbar: {dbError}
          </Txt>
        ) : (
          <>
            <Zeile label="Gehört Nutzer" wert={ownership.label} tone={ownership.tone} />
            <Zeile label="Schema-Version" wert={String(snapshot?.userVersion ?? '—')} />
            <Zeile
              label="Outbox"
              wert={`${snapshot?.pending ?? 0} offen · ${snapshot?.failed ?? 0} fehlgeschlagen`}
              tone={snapshot && snapshot.failed > 0 ? 'danger' : undefined}
            />
            <Zeile
              label="Zeilen"
              wert={
                `${snapshot?.fridgeItems ?? 0} Vorrat · ` +
                `${snapshot?.shoppingItems ?? 0} Einkauf · ` +
                `${snapshot?.storageLocations ?? 0} Orte`
              }
            />
          </>
        )}

        <View style={devStyles.actionStack}>
          <Button title="Neu einlesen" variant="secondary" onPress={ladeSnapshot} />
          <Button
            title="Sync-Diagnose & Outbox öffnen"
            variant="secondary"
            onPress={() => router.push('/settings/sync-debug')}
          />
          <Button
            title="Lokale Datenbank löschen"
            variant="danger"
            onPress={handleWipe}
            loading={busy === 'wipe'}
          />
        </View>
      </Card>

      <Card title="OpenFoodFacts-Dump">
        <Zeile
          label="Heruntergeladen"
          wert={offDump?.fileExists ? `ja · ${formatBytes(offDump.fileSizeBytes)}` : 'nein'}
          tone={offDump?.fileExists ? undefined : 'warning'}
        />
        <Zeile label="Schema-Version" wert={String(offDump?.schemaVersion ?? '—')} />
        <Zeile label="Daten-Version" wert={formatZeitpunkt(offDump?.dataVersion ?? null)} />
        <Zeile
          label="Angehängt"
          wert={offDump?.attached ? 'ja' : 'nein'}
          tone={offDump?.attached ? undefined : 'warning'}
        />
        <Zeile label="Letzter Check" wert={formatZeitpunkt(offDump?.lastCheckAt ?? null)} />
        <Zeile
          label="Letztes Update"
          wert={formatZeitpunkt(offDump?.lastSuccessfulUpdateAt ?? null)}
        />
        <Zeile
          label="Letzter Fehler"
          wert={offDump?.lastError ?? '—'}
          tone={offDump?.lastError ? 'danger' : undefined}
        />

        <View style={devStyles.actionStack}>
          <Button
            title="Jetzt aktualisieren"
            variant="secondary"
            onPress={() =>
              void mitBusy('off-dump-update', async () => {
                const db = await getDatabase();
                await forceRefreshOffDump(db);
                setOffDump(await getOffDumpStatus(db));
              })
            }
            loading={busy === 'off-dump-update'}
          />
          <Button
            title="Baseline neu installieren"
            variant="secondary"
            onPress={() =>
              Alert.alert(
                'Baseline neu installieren?',
                'Lädt den vollständigen Dump neu herunter und ersetzt die lokale Datei. Bei großem Dateiumfang kann das dauern.',
                [
                  { text: 'Abbrechen', style: 'cancel' },
                  {
                    text: 'Neu installieren',
                    onPress: () =>
                      void mitBusy('off-dump-baseline', async () => {
                        const db = await getDatabase();
                        await reinstallOffDumpBaseline(db);
                        setOffDump(await getOffDumpStatus(db));
                      }),
                  },
                ],
              )
            }
            loading={busy === 'off-dump-baseline'}
          />
          <Button
            title="Integrität prüfen"
            variant="secondary"
            onPress={() =>
              void mitBusy('off-dump-integrity', async () => {
                const db = await getDatabase();
                const ok = await checkOffDumpIntegrity(db);
                Alert.alert(
                  'Integritätsprüfung',
                  ok
                    ? 'Der OpenFoodFacts-Dump ist intakt.'
                    : 'Der OpenFoodFacts-Dump ist beschädigt.',
                );
              })
            }
            loading={busy === 'off-dump-integrity'}
          />
        </View>
      </Card>
    </Screen>
  );
}
