import { useTranslation } from 'react-i18next';

import { ContentCard } from '@/components/ui/content-card';
import { useDevSettingsStore } from '@/constants/dev-settings';
import { Button, Txt } from '@/constants/ui';
import {
  getTrackingMethodLabel,
  getTrackingMethodSettings,
  TRACKING_METHODS,
} from '@/features/profile/tracking-methods';
import { useFeatureFlags } from '@/lib/observability/providers/posthog';

/** Lokale Freischaltung von Tracking-Methoden für Dev-Builds und TestFlight. */
export function TrackingMethodControls() {
  const { t } = useTranslation();
  const featureFlags = useFeatureFlags();
  const overrides = useDevSettingsStore((state) => state.trackingMethodOverrides);
  const setOverride = useDevSettingsStore((state) => state.setTrackingMethodOverride);
  const resetOverrides = useDevSettingsStore((state) => state.resetTrackingMethodOverrides);
  const settings = getTrackingMethodSettings(featureFlags, overrides);

  return (
    <ContentCard title={t('dev.tracking.title')}>
      <Txt variant="caption" tone="secondary">
        {t('dev.tracking.hint')}
      </Txt>
      {TRACKING_METHODS.map((method) => {
        const enabled = settings[method.id];
        const label = getTrackingMethodLabel(t, method.id);
        return (
          <Button
            key={method.id}
            title={`${label}: ${enabled ? t('dev.states.on') : t('dev.states.off')}`}
            variant={enabled ? 'primary' : 'secondary'}
            accessibilityLabel={`${label} ${enabled ? t('dev.featureFlags.turnOff') : t('dev.featureFlags.turnOn')}`}
            onPress={() => setOverride(method.id, !enabled)}
          />
        );
      })}
      {Object.keys(overrides).length > 0 ? (
        <Button title={t('dev.tracking.reset')} variant="secondary" onPress={resetOverrides} />
      ) : null}
    </ContentCard>
  );
}
