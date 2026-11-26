import { useQueryClient } from '@tanstack/react-query';
import { Redirect } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, View } from 'react-native';

import { Screen } from '@/components/layout/screen';
import { ContentCard } from '@/components/ui/content-card';
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
import { useDevToolsAccess } from '@/hooks/use-dev-tools-access';
import { disposeAptabase, initAptabase } from '@/lib/analytics/aptabase';
import { env } from '@/lib/config/env';
import {
  getPostHogClient,
  initPostHog,
  useFeatureFlag,
} from '@/lib/observability/providers/posthog';
import { devStyles, Zeile } from './dev-screen-shared';

export function DevOverridesScreen() {
  const { t } = useTranslation();
  const hasAccess = useDevToolsAccess();
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
      Alert.alert(t('dev.states.failed'), error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(null);
    }
  }

  async function handleResetPremium() {
    if (!activeHousehold?.id) {
      Alert.alert(
        t('dev.overrides.activeHouseholdMissing'),
        t('dev.overrides.activeHouseholdMissingMessage'),
      );
      return;
    }
    await mitBusy('premium', async () => {
      await devResetHouseholdPremium({
        householdId: activeHousehold.id,
        userId: session?.user?.id,
        queryClient,
      });
      await refreshPremium();
      Alert.alert(t('dev.states.success'), t('dev.overrides.premiumResetSuccess'));
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

  if (!hasAccess) {
    return <Redirect href="/settings" />;
  }

  return (
    <Screen
      title={t('dev.overrides.title')}
      subtitle={t('dev.overrides.subtitle')}
      back={{ label: t('dev.tools.title'), href: '/settings/dev' }}
      backStyle="icon">
      <ContentCard title={t('dev.overrides.language')}>
        <Txt variant="caption" tone="secondary">
          {t('dev.overrides.languageHint')}
        </Txt>
        <LanguageOverrideControl />
      </ContentCard>

      <ContentCard title={t('dev.overrides.premium')}>
        <Button
          title={t('dev.overrides.resetPremium')}
          variant="secondary"
          loading={busy === 'premium'}
          accessibilityLabel={t('dev.overrides.resetPremiumAccessibility')}
          onPress={handleResetPremium}
        />
        <View style={devStyles.devRow}>
          <Txt variant="caption" tone="secondary">
            {t('dev.overrides.plusHint')}
          </Txt>
        </View>
        <Button
          title={t('dev.overrides.forcePlus', {
            state: premiumOverrideEnabled ? t('dev.states.on') : t('dev.states.off'),
          })}
          variant={premiumOverrideEnabled ? 'primary' : 'secondary'}
          accessibilityLabel={
            premiumOverrideEnabled
              ? t('dev.overrides.plusAccessibilityOn')
              : t('dev.overrides.plusAccessibilityOff')
          }
          onPress={() => setForcePremiumOverride(!premiumOverrideEnabled)}
        />
        {forcePremiumOverride !== null ? (
          <Button
            title={t('dev.overrides.resetOverrideWithBuild', {
              state: env.forcePremium ? t('dev.states.onLower') : t('dev.states.offLower'),
            })}
            variant="secondary"
            onPress={() => setForcePremiumOverride(null)}
          />
        ) : null}
        <View style={devStyles.devRow}>
          <Txt variant="caption" tone="secondary">
            {t('dev.overrides.aiHint')}
          </Txt>
        </View>
        <Button
          title={t('dev.overrides.forceAi', {
            state: aiOverrideEnabled ? t('dev.states.on') : t('dev.states.off'),
          })}
          variant={aiOverrideEnabled ? 'primary' : 'secondary'}
          accessibilityLabel={
            aiOverrideEnabled
              ? t('dev.overrides.aiAccessibilityOn')
              : t('dev.overrides.aiAccessibilityOff')
          }
          onPress={() => setForceAiOverride(!aiOverrideEnabled)}
        />
        {forceAiOverride !== null ? (
          <Button
            title={t('dev.overrides.resetAi')}
            variant="secondary"
            onPress={() => setForceAiOverride(null)}
          />
        ) : null}
        <View style={devStyles.devRow}>
          <Txt variant="caption" tone="secondary">
            {t('dev.overrides.adsHint')}
          </Txt>
        </View>
        <Button
          title={t('dev.overrides.ads', {
            state: adsEnabled ? t('dev.states.on') : t('dev.states.off'),
          })}
          variant={adsEnabled ? 'primary' : 'secondary'}
          accessibilityLabel={
            adsEnabled
              ? t('dev.overrides.adsAccessibilityOn')
              : t('dev.overrides.adsAccessibilityOff')
          }
          onPress={() => {
            const nextEnabled = !adsEnabled;
            setAdsOverride(nextEnabled);
            if (nextEnabled) void initMobileAds();
          }}
        />
        {adsOverride !== null ? (
          <Button
            title={t('dev.overrides.resetOverrideWithBuild', {
              state: env.adsEnabled ? t('dev.states.onLower') : t('dev.states.offLower'),
            })}
            variant="secondary"
            onPress={() => setAdsOverride(null)}
          />
        ) : null}
      </ContentCard>

      <ContentCard title={t('dev.overrides.featureStatus')}>
        <Zeile
          label={t('dev.overrides.testFeature')}
          wert={testFeatureFlag ? t('dev.states.onLower') : t('dev.states.offLower')}
          tone={testFeatureFlag ? undefined : 'warning'}
        />
      </ContentCard>

      <FeatureFlagControls />

      <ContentCard title={t('dev.overrides.analytics.title')}>
        <Zeile
          label={t('dev.overrides.defaults')}
          wert={t('dev.overrides.defaultsValue')}
          tone="accent"
        />
        <Txt variant="caption" tone="secondary">
          {t('dev.overrides.localOverrideHint')}
        </Txt>
        {analyticsToggles.map((toggle) => {
          const enabled = toggle.getValue(analyticsSettings);
          const label = t(toggle.labelKey);
          return (
            <Button
              key={toggle.path}
              title={`${label}: ${enabled ? t('dev.states.on') : t('dev.states.off')}`}
              variant={enabled ? 'primary' : 'secondary'}
              accessibilityLabel={`${label} ${enabled ? t('dev.featureFlags.turnOff') : t('dev.featureFlags.turnOn')}`}
              onPress={() => toggleAnalyticsSetting(toggle)}
            />
          );
        })}
        {Object.keys(analyticsOverrides).length > 0 ? (
          <Button
            title={t('dev.overrides.resetAnalytics')}
            variant="secondary"
            onPress={() => {
              resetAnalyticsOverrides();
              refreshAnalyticsProviders();
            }}
          />
        ) : null}
      </ContentCard>

      <TrackingMethodControls />
    </Screen>
  );
}
