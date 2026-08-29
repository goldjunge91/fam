import { useQueryClient } from '@tanstack/react-query';
import Constants from 'expo-constants';
import { Observe } from 'expo-observe';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Platform, View } from 'react-native';
import { Screen } from '@/components/layout/screen';
import { ThemedText } from '@/components/theme/themed-text';
import { Button } from '@/components/ui/buttons';
import { Card } from '@/components/ui/card';
import { initMobileAds, useAdsEnabled, useAdsOverrideStore } from '@/features/ads';
import { useSession } from '@/features/auth/session-provider';
import { VISION_CAMERA_LAB_ENABLED } from '@/features/experimentalscreens/vision-camera-lab';
import { useActiveHousehold } from '@/features/household/active-household-provider';
import { useForcePremiumOverrideStore } from '@/features/premium/force-premium-override';
import { presentPaywall } from '@/features/premium/paywall';
import { usePremium } from '@/features/premium/premium-provider';
import {
  classifySupabaseTarget,
  describeDatabaseOwnership,
  formatTokenExpiry,
  maskSecret,
} from '@/features/settings/dev/dev-info';
import { getAptabaseInitializationError, isAptabaseConfigured } from '@/lib/analytics/aptabase';
import { trackAnalyticsEvent } from '@/lib/analytics/events';
import { deleteLocalDatabase, getDatabase } from '@/lib/db/client';
import { env } from '@/lib/env';
import { sendTestNotification } from '@/lib/notifications';
import {
  checkOffDumpIntegrity,
  forceRefreshOffDump,
  getOffDumpStatus,
  type OffDumpStatus,
  reinstallOffDumpBaseline,
} from '@/lib/off-dump/off-dump';
import {
  getPostHogClient,
  getPostHogInitializationError,
  isPostHogConfigured,
  reloadPostHogFeatureFlags,
  useFeatureFlag,
  useFeatureFlags,
} from '@/lib/posthog';
import { MAX_ATTEMPTS } from '@/lib/sync/backoff';
import { reportError } from '@/lib/telemetry';

function formatBytes(bytes: number): string {
  if (bytes <= 0) return '0 MB';
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function formatZeitpunkt(iso: string | null): string {
  if (!iso) return '—';
  const datum = new Date(iso);
  return Number.isNaN(datum.getTime()) ? iso : datum.toLocaleString('de-DE');
}

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
  return (
    <View className="dev-zeile">
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
      <ThemedText type="smallBold" themeColor={tone} numberOfLines={2} className="dev-zeile-value">
        {wert}
      </ThemedText>
    </View>
  );
}

export function DevToolsScreen() {
  const { session } = useSession();
  const queryClient = useQueryClient();
  const { activeHousehold } = useActiveHousehold();
  const { isPremium, isForced } = usePremium();
  const forcePremiumOverride = useForcePremiumOverrideStore((state) => state.override);
  const setForcePremiumOverride = useForcePremiumOverrideStore((state) => state.setOverride);
  const premiumOverrideEnabled = forcePremiumOverride ?? env.forcePremium;
  const adsEnabled = useAdsEnabled();
  const adsOverride = useAdsOverrideStore((state) => state.override);
  const setAdsOverride = useAdsOverrideStore((state) => state.setOverride);
  // Ohne Schlüssel oder geladenen Wert ist das Flag standardmäßig deaktiviert.
  const testFeatureFlag = useFeatureFlag('test-feature', false);
  const posthogFlags = useFeatureFlags();
  const posthogConfigured = isPostHogConfigured();
  const posthogInitializationError = getPostHogInitializationError();

  const [snapshot, setSnapshot] = useState<DbSnapshot | null>(null);
  const [offDump, setOffDump] = useState<OffDumpStatus | null>(null);
  const [dbError, setDbError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [posthogCheck, setPosthogCheck] = useState<
    { label: string; tone?: 'accent' | 'warning' | 'danger' } | undefined
  >();

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
        // Dieselbe Schwelle wie im Sync-Banner verwenden.
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
      back={{ label: 'Einstellungen', href: '/settings' }}
      backStyle="icon">
      <Card title="Umgebung">
        <Zeile label="Supabase" wert={ziel.label} tone={ziel.tone} />
        <Zeile label="URL" wert={env.supabaseUrl} />
        <Zeile label="Schlüssel" wert={maskSecret(env.supabaseKey)} />
        <Zeile label="Build" wert={__DEV__ ? 'Development' : 'Production'} />
        <Zeile
          label="App-Version"
          wert={`${Constants.nativeAppVersion ?? Constants.expoConfig?.version ?? '—'} (Build ${Constants.nativeBuildVersion ?? (Platform.OS === 'ios' ? Constants.expoConfig?.ios?.buildNumber : Constants.expoConfig?.android?.versionCode) ?? '—'}, ${Platform.OS} ${Platform.Version})`}
        />
        <Zeile label="Onboarding erzwungen" wert={env.forceOnboarding ? 'ja' : 'nein'} />
        <Zeile
          label="Premium"
          wert={isPremium ? (isForced ? 'ja (erzwungen)' : 'ja') : 'nein'}
          tone={isForced ? 'warning' : undefined}
        />
        <View className="dev-zeile">
          <ThemedText type="small" themeColor="textSecondary">
            Premium erzwingen (Override, überlebt Neustart)
          </ThemedText>
        </View>
        <Button
          label={`Premium erzwingen: ${premiumOverrideEnabled ? 'AN' : 'AUS'}`}
          variant={premiumOverrideEnabled ? 'primary' : 'secondary'}
          accessibilityLabel={
            premiumOverrideEnabled ? 'Premium-Override ausschalten' : 'Premium-Override einschalten'
          }
          onPress={() => setForcePremiumOverride(!premiumOverrideEnabled)}
        />
        {forcePremiumOverride !== null ? (
          <Button
            label={`Override zurücksetzen (Build-Wert: ${env.forcePremium ? 'an' : 'aus'})`}
            variant="secondary"
            onPress={() => setForcePremiumOverride(null)}
          />
        ) : null}
        <Zeile
          label="Werbung"
          wert={adsEnabled ? 'an' : 'aus'}
          tone={adsEnabled ? undefined : 'warning'}
        />
        <View className="dev-zeile">
          <ThemedText type="small" themeColor="textSecondary">
            Werbung umschalten (Override, überlebt Neustart)
          </ThemedText>
        </View>
        <Button
          label={`Werbung: ${adsEnabled ? 'AN' : 'AUS'}`}
          variant={adsEnabled ? 'primary' : 'secondary'}
          accessibilityLabel={adsEnabled ? 'Werbung ausschalten' : 'Werbung einschalten'}
          onPress={() => {
            const nextEnabled = !adsEnabled;
            setAdsOverride(nextEnabled);
            if (nextEnabled) void initMobileAds();
          }}
        />
        {adsOverride !== null ? (
          <Button
            label={`Override zurücksetzen (Build-Wert: ${env.adsEnabled ? 'an' : 'aus'})`}
            variant="secondary"
            onPress={() => setAdsOverride(null)}
          />
        ) : null}
        <Zeile
          label="PostHog"
          wert={
            posthogConfigured
              ? 'konfiguriert'
              : posthogInitializationError
                ? 'Client-Start fehlgeschlagen'
                : 'kein API-Key'
          }
          tone={posthogConfigured ? undefined : posthogInitializationError ? 'danger' : 'warning'}
        />
        <Zeile
          label="PostHog-Verbindung"
          wert={posthogCheck?.label ?? 'noch nicht geprüft'}
          tone={posthogCheck?.tone}
        />
        <Zeile
          label="Flag „test-feature“"
          wert={testFeatureFlag ? 'an' : 'aus'}
          tone={testFeatureFlag ? undefined : 'warning'}
        />
        <Zeile
          label="Aptabase"
          wert={
            isAptabaseConfigured()
              ? 'konfiguriert'
              : getAptabaseInitializationError()
                ? 'Init fehlgeschlagen'
                : 'kein App-Key'
          }
          tone={
            isAptabaseConfigured()
              ? undefined
              : getAptabaseInitializationError()
                ? 'danger'
                : 'warning'
          }
        />
      </Card>

      {/* Session-Details (Nutzer-ID, Token-Gültigkeit, aktiver Haushalt) */}
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

      {/* Lokale SQLite-Datenbank (Schema-Version, Tabellenzähler, Outbox) */}
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

        <View className="action-stack">
          <Button label="Neu einlesen" variant="secondary" onPress={ladeSnapshot} />
        </View>
      </Card>

      {/* Lokaler OpenFoodFacts-Offline-Dump Status (#223 Paket 6) */}
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

        <View className="action-stack">
          <Button
            label="Jetzt aktualisieren"
            variant="secondary"
            onPress={() =>
              mitBusy('off-dump-update', async () => {
                const db = await getDatabase();
                await forceRefreshOffDump(db);
                setOffDump(await getOffDumpStatus(db));
              })
            }
            loading={busy === 'off-dump-update'}
          />
          <Button
            label="Baseline neu installieren"
            variant="secondary"
            onPress={() =>
              Alert.alert(
                'Baseline neu installieren?',
                'Läd den vollständigen Dump neu herunter und ersetzt die lokale Datei. Bei großem Dateiumfang kann das dauern.',
                [
                  { text: 'Abbrechen', style: 'cancel' },
                  {
                    text: 'Neu installieren',
                    onPress: () =>
                      mitBusy('off-dump-baseline', async () => {
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
            label="Integrität prüfen"
            variant="secondary"
            onPress={() =>
              mitBusy('off-dump-integrity', async () => {
                const db = await getDatabase();
                const ok = await checkOffDumpIntegrity(db);
                Alert.alert('Integrität', ok ? 'Dump ist unbeschädigt.' : 'Dump ist beschädigt.');
              })
            }
            loading={busy === 'off-dump-integrity'}
          />
        </View>
      </Card>

      {/* Diagnose- & Test-Aktionen (Sentry, Push, EAS Observe, Paywall, DB-Wipe) */}
      <Card title="Aktionen">
        <View className="action-stack">
          <Button
            label="Sentry-Testfehler senden"
            variant="secondary"
            onPress={() => {
              reportError(new Error('First error'), {
                operation: 'dev_tools.error_test',
                error_code: 'dev_tools_test_error',
              });
              Alert.alert(
                'Telemetrie',
                'Testfehler ("First error") wurde an Sentry, PostHog und Aptabase gesendet.',
              );
            }}
          />
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
            label="EAS-Observe-Testevent senden"
            variant="secondary"
            onPress={() => {
              Observe.logEvent('dev_tools.test_event', {
                attributes: { source: 'dev-tools-screen', platform: Platform.OS },
              });
              Alert.alert(
                'EAS Observe',
                'Testevent ("dev_tools.test_event") wurde geloggt. Erscheint im Observe-Dashboard nach dem naechsten Flush (Debug-Builds dispatchen nur mit dispatchInDebug).',
              );
            }}
          />
          <Button
            label="PostHog-Verbindung prüfen"
            variant="secondary"
            onPress={() =>
              mitBusy('posthog-reload', async () => {
                if (!posthogConfigured) {
                  const message = posthogInitializationError
                    ? `Client konnte nicht gestartet werden: ${posthogInitializationError}`
                    : 'nicht aktiv: API-Key ist in diesem Build nicht vorhanden';
                  setPosthogCheck({
                    label: message,
                    tone: posthogInitializationError ? 'danger' : 'warning',
                  });
                  Alert.alert(
                    posthogInitializationError ? 'PostHog-Clientfehler' : 'PostHog nicht aktiv',
                    posthogInitializationError
                      ? message
                      : `${message}. Nach einer Änderung von .env muss Metro neu gestartet und der Dev-Build neu erstellt werden.`,
                  );
                  return;
                }
                try {
                  const flags = await reloadPostHogFeatureFlags();
                  const client = getPostHogClient();
                  const flagCount = Object.keys(flags ?? {}).length;
                  const distinctId = client?.getDistinctId() ?? 'unbekannt';
                  setPosthogCheck({
                    label: `erreichbar, ${flagCount} Flag(s) geladen`,
                    tone: 'accent',
                  });
                  Alert.alert(
                    'PostHog funktioniert',
                    `Host: ${env.posthogHost}\n` +
                      `Nutzer: ${distinctId}\n` +
                      `test-feature: ${String(flags?.['test-feature'] ?? 'nicht angelegt')}\n` +
                      `Flags: ${flagCount}`,
                  );
                } catch (error) {
                  const detail = error instanceof Error ? error.message : String(error);
                  setPosthogCheck({ label: `Fehler: ${detail}`, tone: 'danger' });
                  Alert.alert(
                    'PostHog nicht erreichbar',
                    `${detail}\n\nHost: ${env.posthogHost}\nPrüfe API-Key, Host und Netzwerk.`,
                  );
                }
              })
            }
            loading={busy === 'posthog-reload'}
          />
          <Button
            label="Telemetrie-Testevent senden"
            variant="secondary"
            onPress={() => {
              if (!isAptabaseConfigured() && !isPostHogConfigured()) {
                const message = getAptabaseInitializationError()
                  ? `Initialisierung fehlgeschlagen: ${getAptabaseInitializationError()}`
                  : 'nicht aktiv: Telemetrie-API-Keys sind in diesem Build nicht vorhanden';
                Alert.alert('Telemetrie nicht aktiv', message);
                return;
              }
              trackAnalyticsEvent('dev_tools.telemetry_test.completed', {
                platform: Platform.OS,
                source: 'dev-tools-screen',
                timestamp: Date.now(),
              });
              Alert.alert(
                'Telemetrie',
                'Test-Event ("dev_tools.telemetry_test.completed") wurde an PostHog und Aptabase gesendet.',
              );
            }}
          />
          <Zeile
            label="Geladene Flags"
            wert={posthogFlags ? String(Object.keys(posthogFlags).length) : 'noch keine'}
          />
          <Button
            label="Sync-Diagnose & Outbox öffnen"
            variant="secondary"
            onPress={() => router.push('/settings/sync-debug')}
          />
          <Button
            label="Liquid-Glass-Labor öffnen"
            variant="secondary"
            onPress={() => router.push('/settings/glass-lab')}
          />
          {VISION_CAMERA_LAB_ENABLED ? (
            <Button
              label="VisionCamera-Labor öffnen"
              variant="secondary"
              onPress={() => router.push('/settings/camera-lab')}
            />
          ) : null}
          <Button
            label="Paywall öffnen (Test Store)"
            variant="secondary"
            onPress={() =>
              mitBusy('paywall', async () => {
                const outcome = await presentPaywall();
                Alert.alert('Paywall-Ergebnis', outcome);
              })
            }
            loading={busy === 'paywall'}
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
