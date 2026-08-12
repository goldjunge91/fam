import { useQueryClient } from '@tanstack/react-query';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Platform, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useSession } from '@/features/auth/session-provider';
import { useActiveHousehold } from '@/features/household/active-household-provider';
import {
  classifySupabaseTarget,
  describeDatabaseOwnership,
  formatTokenExpiry,
  maskSecret,
} from '@/features/settings/dev/dev-info';
import { useTheme } from '@/hooks/use-theme';
import { deleteLocalDatabase, getDatabase } from '@/lib/db/client';
import { env } from '@/lib/env';
import { sendTestNotification } from '@/lib/notifications';
import { getOffDumpStatus, type OffDumpStatus } from '@/lib/off-dump/off-dump';
import { MAX_ATTEMPTS } from '@/lib/sync/backoff';

function formatBytes(bytes: number): string {
  if (bytes <= 0) return '0 MB';
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/**
 * Entwickler-Bereich, sichtbar nur mit `EXPO_PUBLIC_DEV_TOOLS=true`.
 *
 * Die Auswahl ist nicht "alles, was geht", sondern das, wonach man beim
 * Nachstellen eines Fehlers zuerst sucht und was die App sonst nirgends
 * verraet:
 *
 * - **gegen welches Supabase-Projekt** dieser Build laeuft (lokal oder echt),
 * - **wie lange die Session noch gilt** — die Erklaerung fuer viele
 *   "auf einmal geht nichts mehr"-Momente,
 * - **ob die lokale Datenbank zum angemeldeten Nutzer gehoert** — die
 *   Abweichung, die das Cross-Account-Datenleck ausgemacht hat,
 * - **Migrationsstand und Zeilenzahlen**, um "kommt gar nichts an" von
 *   "kommt an, wird aber nicht angezeigt" zu unterscheiden.
 *
 * Die rohen Outbox- und Tabelleninhalte stehen weiterhin in der Sync-Diagnose;
 * von hier fuehrt nur ein Verweis dorthin, damit es die Ansicht nicht zweimal
 * gibt.
 */

type DbSnapshot = {
  userVersion: number;
  storedUserId: string | null;
  pending: number;
  failed: number;
  fridgeItems: number;
  shoppingItems: number;
  storageLocations: number;
};

function Zeile({
  label,
  wert,
  tone,
}: {
  label: string;
  wert: string;
  tone?: 'accent' | 'warning' | 'danger';
}) {
  const theme = useTheme();

  return (
    <View style={[styles.zeile, { borderBottomColor: theme.border }]}>
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
      <ThemedText type="smallBold" themeColor={tone} numberOfLines={2} style={styles.wert}>
        {wert}
      </ThemedText>
    </View>
  );
}

export function DevToolsScreen() {
  const { session } = useSession();
  const queryClient = useQueryClient();
  const { activeHousehold } = useActiveHousehold();

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
        // Schwelle aus `backoff.ts`, nicht hartcodiert: Sonst zeigt dieser
        // Bereich irgendwann andere Zahlen als das Sync-Banner.
        pending: await zahl('select count(*) as c from outbox where attempts < ?', [MAX_ATTEMPTS]),
        failed: await zahl('select count(*) as c from outbox where attempts >= ?', [MAX_ATTEMPTS]),
        fridgeItems: await zahl('select count(*) as c from fridge_items'),
        shoppingItems: await zahl('select count(*) as c from shopping_list_items'),
        storageLocations: await zahl('select count(*) as c from storage_locations'),
      });
      setDbError(null);
    } catch (err) {
      setDbError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  useEffect(() => {
    ladeSnapshot();
  }, [ladeSnapshot]);

  const ziel = classifySupabaseTarget(env.supabaseUrl);
  const besitz = describeDatabaseOwnership(
    snapshot?.storedUserId ?? null,
    session?.user.id ?? null,
  );
  const ablauf = formatTokenExpiry(session?.expires_at, Date.now());

  async function mitBusy(name: string, aktion: () => Promise<void>) {
    if (busy) return;
    setBusy(name);
    try {
      await aktion();
    } catch (err) {
      Alert.alert('Fehlgeschlagen', err instanceof Error ? err.message : String(err));
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
            mitBusy('wipe', async () => {
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
      title="Entwickler"
      subtitle="Nur sichtbar mit EXPO_PUBLIC_DEV_TOOLS"
      back={{ label: 'Einstellungen', href: '/settings' }}>
      <Card title="Umgebung">
        <Zeile label="Supabase" wert={ziel.label} tone={ziel.tone} />
        <Zeile label="URL" wert={env.supabaseUrl} />
        <Zeile label="Schlüssel" wert={maskSecret(env.supabaseKey)} />
        <Zeile label="Build" wert={__DEV__ ? 'Development' : 'Production'} />
        <Zeile
          label="App-Version"
          wert={`${Constants.expoConfig?.version ?? '—'} (${Platform.OS} ${Platform.Version})`}
        />
        <Zeile label="Onboarding erzwungen" wert={env.forceOnboarding ? 'ja' : 'nein'} />
      </Card>

      <Card title="Session">
        <Zeile label="Nutzer-ID" wert={session?.user.id ?? '—'} />
        <Zeile label="E-Mail" wert={session?.user.email ?? '—'} />
        <Zeile
          label="Token gültig"
          wert={ablauf}
          tone={ablauf === 'abgelaufen' ? 'danger' : undefined}
        />
        <Zeile label="Aktiver Haushalt" wert={activeHousehold?.name ?? '—'} />
        <Zeile label="Haushalts-ID" wert={activeHousehold?.id ?? '—'} />
      </Card>

      <Card title="Lokale Datenbank">
        {dbError ? (
          <ThemedText type="small" themeColor="danger">
            Nicht lesbar: {dbError}
          </ThemedText>
        ) : (
          <>
            <Zeile label="Gehört Nutzer" wert={besitz.label} tone={besitz.tone} />
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

        <View style={styles.aktionStack}>
          <Button label="Neu einlesen" variant="secondary" onPress={ladeSnapshot} />
        </View>
      </Card>

      <Card title="OpenFoodFacts-Dump">
        <Zeile
          label="Heruntergeladen"
          wert={offDump?.fileExists ? `ja · ${formatBytes(offDump.fileSizeBytes)}` : 'nein'}
          tone={offDump?.fileExists ? undefined : 'warning'}
        />
        <Zeile label="Release" wert={offDump?.storedReleaseTag ?? '—'} />
        <Zeile
          label="Angehängt"
          wert={offDump?.attached ? 'ja' : 'nein'}
          tone={offDump?.attached ? undefined : 'warning'}
        />
      </Card>

      <Card title="Aktionen">
        <View style={styles.aktionStack}>
          <Button
            label="Test-Benachrichtigung senden"
            variant="secondary"
            onPress={() =>
              mitBusy('notify', async () => {
                const result = await sendTestNotification();
                Alert.alert(result.success ? 'Erfolg' : 'Hinweis', result.message);
              })
            }
            loading={busy === 'notify'}
          />
          <Button
            label="Sync-Diagnose & Outbox öffnen"
            variant="secondary"
            onPress={() => router.push('/settings/sync-debug')}
          />
          <Button
            label="Lokale Datenbank löschen"
            variant="danger"
            onPress={handleWipe}
            loading={busy === 'wipe'}
          />
        </View>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  zeile: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: Spacing.three,
    paddingVertical: Spacing.two,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  wert: {
    flexShrink: 1,
    textAlign: 'right',
  },
  aktionStack: {
    marginTop: Spacing.three,
    gap: Spacing.two,
  },
});
