import { Observe } from 'expo-observe';
import { useState } from 'react';
import { Alert, Platform, View } from 'react-native';

import { Screen } from '@/components/layout/screen';
import { Card } from '@/components/ui/card';
import { Button } from '@/constants/ui';
import { getAptabaseInitializationError, isAptabaseConfigured } from '@/lib/analytics/aptabase';
import { trackAnalyticsEvent } from '@/lib/analytics/events';
import { env } from '@/lib/config/env';
import {
  getPostHogClient,
  getPostHogInitializationError,
  isPostHogConfigured,
  reloadPostHogFeatureFlags,
  useFeatureFlags,
} from '@/lib/observability/providers/posthog';
import { sendTestNotification } from '@/lib/platform/notifications';
import { reportError } from '@/lib/telemetry';
import { devStyles, Zeile } from './dev-screen-shared';

export function DevTelemetryScreen() {
  const posthogFlags = useFeatureFlags();
  const posthogConfigured = isPostHogConfigured();
  const posthogInitializationError = getPostHogInitializationError();
  const [busy, setBusy] = useState<string | null>(null);
  const [posthogCheck, setPosthogCheck] = useState<
    { label: string; tone?: 'accent' | 'warning' | 'danger' } | undefined
  >();

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

  return (
    <Screen
      title="Telemetrie & Plattformtests"
      subtitle="Testsignale, Benachrichtigungen und Logs"
      back={{ label: 'Entwickler', href: '/settings/dev' }}
      backStyle="icon">
      <Card title="Testsignale">
        <Zeile
          label="PostHog-Verbindung"
          wert={posthogCheck?.label ?? 'noch nicht geprüft'}
          tone={posthogCheck?.tone}
        />
        <Zeile
          label="Geladene Flags"
          wert={posthogFlags ? String(Object.keys(posthogFlags).length) : 'noch keine'}
        />
        <View style={devStyles.actionStack}>
          <Button
            title="Sentry-Testfehler senden"
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
            title="Test-Benachrichtigung senden"
            variant="secondary"
            onPress={() =>
              void mitBusy('notify', async () => {
                const result = await sendTestNotification();
                Alert.alert(result.success ? 'Erfolg' : 'Hinweis', result.message);
              })
            }
            loading={busy === 'notify'}
          />
          <Button
            title="EAS-Observe-Testevent senden"
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
            title="PostHog-Verbindung prüfen"
            variant="secondary"
            onPress={() =>
              void mitBusy('posthog-reload', async () => {
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
            title="Telemetrie-Testevent senden"
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
        </View>
      </Card>
    </Screen>
  );
}
