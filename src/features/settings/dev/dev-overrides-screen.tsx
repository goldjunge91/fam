import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Alert, View } from 'react-native';

import { Screen } from '@/components/layout/screen';
import { Card } from '@/components/ui/card';
import { getAnalyticsSettings, useAnalyticsSettingsStore } from '@/constants/analytics';
import { Button, Txt } from '@/constants/ui';
import { initMobileAds, useAdsEnabled, useAdsOverrideStore } from '@/features/ads';
import { useSession } from '@/features/auth/session-provider';
import { useActiveHousehold } from '@/features/household/active-household-provider';
import { devResetHouseholdPremium } from '@/features/premium/dev-reset-premium';
import {
  useForceAiOverrideStore,
  useForcePremiumOverrideStore,
} from '@/features/premium/force-premium-override';
import { usePremium } from '@/features/premium/premium-provider';
import { type AnalyticsToggle, analyticsToggles } from '@/features/settings/dev/analytics-controls';
import { FeatureFlagControls } from '@/features/settings/dev/feature-flag-controls';
import { LanguageOverrideControl } from '@/features/settings/dev/language-override-control';
import { TrackingMethodControls } from '@/features/settings/dev/tracking-method-controls';
import { disposeAptabase, initAptabase } from '@/lib/analytics/aptabase';
import { env } from '@/lib/config/env';
import {
  getPostHogClient,
  initPostHog,
  useFeatureFlag,
} from '@/lib/observability/providers/posthog';
import { devStyles, Zeile } from './dev-screen-shared';

export function DevOverridesScreen() {
  const queryClient = useQueryClient();
  const { session } = useSession();
  const { activeHousehold } = useActiveHousehold();
  const { refresh: refreshPremium } = usePremium();
  const forcePremiumOverride = useForcePremiumOverrideStore((state) => state.override);
  const setForcePremiumOverride = useForcePremiumOverrideStore((state) => state.setOverride);
  const premiumOverrideEnabled = forcePremiumOverride ?? env.forcePremium;
  const forceAiOverride = useForceAiOverrideStore((state) => state.override);
  const setForceAiOverride = useForceAiOverrideStore((state) => state.setOverride);
  const aiOverrideEnabled = forceAiOverride ?? false;
  const adsEnabled = useAdsEnabled();
  const adsOverride = useAdsOverrideStore((state) => state.override);
  const setAdsOverride = useAdsOverrideStore((state) => state.setOverride);
  const testFeatureFlag = useFeatureFlag('test-feature', false);
  const analyticsOverrides = useAnalyticsSettingsStore((state) => state.overrides);
  const setAnalyticsOverride = useAnalyticsSettingsStore((state) => state.setOverride);
  const resetAnalyticsOverrides = useAnalyticsSettingsStore((state) => state.resetOverrides);
  const analyticsSettings = getAnalyticsSettings();
  const [busy, setBusy] = useState<string | null>(null);

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

  async function handleResetPremium() {
    if (!activeHousehold?.id) {
      Alert.alert('Kein aktiver Haushalt', 'Es wurde kein aktiver Haushalt gefunden.');
      return;
    }
    await mitBusy('Plus & KI zurücksetzen', async () => {
      await devResetHouseholdPremium({
        householdId: activeHousehold.id,
        userId: session?.user?.id,
        queryClient,
      });
      await refreshPremium();
      Alert.alert('Erfolgreich', 'Plus und KI wurden für diesen Haushalt zurückgesetzt.');
    });
  }

  function refreshAnalyticsProviders() {
    const settings = getAnalyticsSettings();
    if (settings.enabled && settings.providers.posthog) {
      initPostHog();
      void getPostHogClient()?.optIn();
    } else {
      void getPostHogClient()?.optOut();
    }

    if (settings.enabled && settings.providers.aptabase) initAptabase();
    else disposeAptabase();
  }

  function toggleAnalyticsSetting(toggle: AnalyticsToggle) {
    setAnalyticsOverride(toggle.path, !toggle.getValue(analyticsSettings));
    refreshAnalyticsProviders();
  }

  return (
    <Screen
      title="Overrides & Feature-Konfiguration"
      subtitle="Lokale Laufzeit- und Feature-Steuerung"
      back={{ label: 'Entwickler', href: '/settings/dev' }}
      backStyle="icon">
      <Card title="App-Sprache">
        <Txt variant="caption" tone="secondary">
          Standardmäßig wird die erste unterstützte Gerätesprache verwendet.
        </Txt>
        <LanguageOverrideControl />
      </Card>

      <Card title="Plus, KI & Werbung">
        <Button
          title="Plus & KI für Haushalt zurücksetzen"
          variant="secondary"
          loading={busy === 'Plus & KI zurücksetzen'}
          accessibilityLabel="Plus und KI für aktuellen Haushalt zurücksetzen"
          onPress={handleResetPremium}
        />
        <View style={devStyles.devRow}>
          <Txt variant="caption" tone="secondary">
            Plus erzwingen (Override, überlebt Neustart)
          </Txt>
        </View>
        <Button
          title={`Plus erzwingen: ${premiumOverrideEnabled ? 'AN' : 'AUS'}`}
          variant={premiumOverrideEnabled ? 'primary' : 'secondary'}
          accessibilityLabel={
            premiumOverrideEnabled ? 'Plus-Override ausschalten' : 'Plus-Override einschalten'
          }
          onPress={() => setForcePremiumOverride(!premiumOverrideEnabled)}
        />
        {forcePremiumOverride !== null ? (
          <Button
            title={`Plus-Override zurücksetzen (Build-Wert: ${env.forcePremium ? 'an' : 'aus'})`}
            variant="secondary"
            onPress={() => setForcePremiumOverride(null)}
          />
        ) : null}
        <View style={devStyles.devRow}>
          <Txt variant="caption" tone="secondary">
            KI erzwingen (Override, überlebt Neustart)
          </Txt>
        </View>
        <Button
          title={`KI erzwingen: ${aiOverrideEnabled ? 'AN' : 'AUS'}`}
          variant={aiOverrideEnabled ? 'primary' : 'secondary'}
          accessibilityLabel={
            aiOverrideEnabled ? 'KI-Override ausschalten' : 'KI-Override einschalten'
          }
          onPress={() => setForceAiOverride(!aiOverrideEnabled)}
        />
        {forceAiOverride !== null ? (
          <Button
            title="KI-Override zurücksetzen"
            variant="secondary"
            onPress={() => setForceAiOverride(null)}
          />
        ) : null}
        <View style={devStyles.devRow}>
          <Txt variant="caption" tone="secondary">
            Werbung umschalten (Override, überlebt Neustart)
          </Txt>
        </View>
        <Button
          title={`Werbung: ${adsEnabled ? 'AN' : 'AUS'}`}
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
            title={`Override zurücksetzen (Build-Wert: ${env.adsEnabled ? 'an' : 'aus'})`}
            variant="secondary"
            onPress={() => setAdsOverride(null)}
          />
        ) : null}
      </Card>

      <Card title="Feature-Status">
        <Zeile
          label="Flag „test-feature“"
          wert={testFeatureFlag ? 'an' : 'aus'}
          tone={testFeatureFlag ? undefined : 'warning'}
        />
      </Card>

      <FeatureFlagControls />

      <Card title="Analytics-Steuerung">
        <Zeile label="Standardwerte" wert="alle an" tone="accent" />
        <Txt variant="caption" tone="secondary">
          Lokale Overrides gelten sofort und überleben einen Neustart.
        </Txt>
        {analyticsToggles.map((toggle) => {
          const enabled = toggle.getValue(analyticsSettings);
          return (
            <Button
              key={toggle.path}
              title={`${toggle.label}: ${enabled ? 'AN' : 'AUS'}`}
              variant={enabled ? 'primary' : 'secondary'}
              accessibilityLabel={`${toggle.label} ${enabled ? 'ausschalten' : 'einschalten'}`}
              onPress={() => toggleAnalyticsSetting(toggle)}
            />
          );
        })}
        {Object.keys(analyticsOverrides).length > 0 ? (
          <Button
            title="Analytics-Overrides zurücksetzen"
            variant="secondary"
            onPress={() => {
              resetAnalyticsOverrides();
              refreshAnalyticsProviders();
            }}
          />
        ) : null}
      </Card>

      <TrackingMethodControls />
    </Screen>
  );
}
