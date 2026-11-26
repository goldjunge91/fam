import { Observe } from 'expo-observe';
import { Redirect } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Platform, View } from 'react-native';

import { Screen } from '@/components/layout/screen';
import { ContentCard } from '@/components/ui/content-card';
import { Button } from '@/constants/ui';
import { useDevToolsAccess } from '@/hooks/use-dev-tools-access';
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
  const { t } = useTranslation();
  const hasAccess = useDevToolsAccess();
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
      Alert.alert(t('dev.states.failed'), error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(null);
    }
  }

  if (!hasAccess) {
    return <Redirect href="/settings" />;
  }

  return (
    <Screen
      title={t('dev.telemetry.title')}
      subtitle={t('dev.telemetry.subtitle')}
      back={{ label: t('dev.tools.title'), href: '/settings/dev' }}
      backStyle="icon">
      <ContentCard title={t('dev.telemetry.signals')}>
        <Zeile
          label={t('dev.telemetry.connection')}
          wert={posthogCheck?.label ?? t('dev.telemetry.notChecked')}
          tone={posthogCheck?.tone}
        />
        <Zeile
          label={t('dev.telemetry.flags')}
          wert={
            posthogFlags ? String(Object.keys(posthogFlags).length) : t('dev.telemetry.noneLoaded')
          }
        />
        <View style={devStyles.actionStack}>
          <Button
            title={t('dev.telemetry.sendSentry')}
            variant="secondary"
            onPress={() => {
              reportError(new Error('First error'), {
                operation: 'dev_tools.error_test',
                error_code: 'dev_tools_test_error',
              });
              Alert.alert(t('dev.telemetry.telemetry'), t('dev.telemetry.testErrorSent'));
            }}
          />
          <Button
            title={t('dev.telemetry.sendNotification')}
            variant="secondary"
            onPress={() =>
              void mitBusy('notify', async () => {
                const result = await sendTestNotification();
                Alert.alert(
                  result.success ? t('dev.states.success') : t('dev.states.notice'),
                  result.message,
                );
              })
            }
            loading={busy === 'notify'}
          />
          <Button
            title={t('dev.telemetry.sendObserve')}
            variant="secondary"
            onPress={() => {
              Observe.logEvent('dev_tools.test_event', {
                attributes: { source: 'dev-tools-screen', platform: Platform.OS },
              });
              Alert.alert(t('dev.telemetry.observe'), t('dev.telemetry.observeSent'));
            }}
          />
          <Button
            title={t('dev.telemetry.checkPosthog')}
            variant="secondary"
            onPress={() =>
              void mitBusy('posthog-reload', async () => {
                if (!posthogConfigured) {
                  const message = posthogInitializationError
                    ? t('dev.telemetry.clientUnavailable', { error: posthogInitializationError })
                    : t('dev.telemetry.apiKeyMissing');
                  setPosthogCheck({
                    label: message,
                    tone: posthogInitializationError ? 'danger' : 'warning',
                  });
                  Alert.alert(
                    posthogInitializationError
                      ? t('dev.telemetry.posthogClientError')
                      : t('dev.telemetry.posthogInactive'),
                    posthogInitializationError
                      ? message
                      : t('dev.telemetry.reloadHint', { message }),
                  );
                  return;
                }

                try {
                  const flags = await reloadPostHogFeatureFlags();
                  const client = getPostHogClient();
                  const flagCount = Object.keys(flags ?? {}).length;
                  const distinctId = client?.getDistinctId() ?? t('dev.telemetry.unknownUser');
                  setPosthogCheck({
                    label: t('dev.telemetry.flagsLoaded', { count: flagCount }),
                    tone: 'accent',
                  });
                  Alert.alert(
                    t('dev.telemetry.posthogWorks'),
                    [
                      t('dev.telemetry.host', { host: env.posthogHost }),
                      t('dev.telemetry.user', { user: distinctId }),
                      t('dev.telemetry.testFeatureValue', {
                        value: String(
                          flags?.['test-feature'] ?? t('dev.telemetry.testFeatureMissing'),
                        ),
                      }),
                      t('dev.telemetry.flagsValue', { count: flagCount }),
                    ].join('\n'),
                  );
                } catch (error) {
                  const detail = error instanceof Error ? error.message : String(error);
                  setPosthogCheck({
                    label: `${t('dev.states.failed')}: ${detail}`,
                    tone: 'danger',
                  });
                  Alert.alert(
                    t('dev.telemetry.posthogUnreachable'),
                    t('dev.telemetry.posthogNetworkHint', { detail, host: env.posthogHost }),
                  );
                }
              })
            }
            loading={busy === 'posthog-reload'}
          />
          <Button
            title={t('dev.telemetry.sendTelemetry')}
            variant="secondary"
            onPress={() => {
              if (!isAptabaseConfigured() && !isPostHogConfigured()) {
                const message = getAptabaseInitializationError()
                  ? t('dev.telemetry.telemetryInitFailed', {
                      error: getAptabaseInitializationError(),
                    })
                  : t('dev.telemetry.telemetryMissing');
                Alert.alert(t('dev.telemetry.telemetryInactive'), message);
                return;
              }
              trackAnalyticsEvent('dev_tools.telemetry_test.completed', {
                platform: Platform.OS,
                source: 'dev-tools-screen',
                timestamp: Date.now(),
              });
              Alert.alert(t('dev.telemetry.telemetry'), t('dev.telemetry.telemetrySent'));
            }}
          />
        </View>
      </ContentCard>
    </Screen>
  );
}
