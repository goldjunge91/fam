import type { TFunction } from 'i18next';
import { Fragment } from 'react';
import { useTranslation } from 'react-i18next';

import { ContentCard } from '@/components/ui/content-card';
import { useDevSettingsStore } from '@/constants/dev-settings';
import { getFeature, getSettingsModules } from '@/constants/feature-registry';
import { Button, Txt } from '@/constants/ui';
import { useFeatureAccess } from '@/features/settings/use-feature-access';
import { useFeatureFlags } from '@/lib/observability/providers/posthog';

const SETTINGS_MODULES = getSettingsModules();
const SHOPPING_STT_FEATURE = getFeature('shoppingStt');

function describeFlag(value: boolean | string | undefined, t: TFunction): string {
  if (value === true) return t('dev.states.onLower');
  if (value === false) return t('dev.states.offLower');
  if (value === undefined) return t('dev.states.notLoaded');
  return t('dev.featureFlags.variant', { value });
}

/** Lokale Entwickler-Overrides für Remote-Feature-Flags und Top-Level-Module. */
export function FeatureFlagControls() {
  const { t } = useTranslation();
  const flags = useFeatureFlags();
  const { getFeatureFlagState } = useFeatureAccess();
  const overrides = useDevSettingsStore((state) => state.moduleFeatureFlagOverrides);
  const setOverride = useDevSettingsStore((state) => state.setModuleFeatureFlagOverride);
  const resetOverrides = useDevSettingsStore((state) => state.resetModuleFeatureFlagOverrides);
  const featureOverrides = useDevSettingsStore((state) => state.featureFlagOverrides);
  const setFeatureOverride = useDevSettingsStore((state) => state.setFeatureFlagOverride);
  const resetFeatureOverrides = useDevSettingsStore((state) => state.resetFeatureFlagOverrides);

  const shoppingSttFlag = SHOPPING_STT_FEATURE?.featureFlag;
  const shoppingSttOverride = shoppingSttFlag ? featureOverrides[shoppingSttFlag] : undefined;
  const shoppingSttEnabled =
    shoppingSttOverride ??
    (shoppingSttFlag ? getFeatureFlagState(shoppingSttFlag) === true : false);

  return (
    <ContentCard title={t('dev.featureFlags.title')}>
      <Txt variant="caption" tone="secondary">
        {t('dev.featureFlags.hint')}
      </Txt>
      {SETTINGS_MODULES.map((row) => {
        const override = overrides[row.key];
        const enabled =
          override ?? (row.featureFlag ? getFeatureFlagState(row.featureFlag) === true : true);
        const label = row.key === 'calories' ? t('common.modules.calories.title') : t(row.title);

        return (
          <Fragment key={row.key}>
            {row.featureFlag ? (
              <Txt variant="caption" tone="secondary">
                {t('dev.featureFlags.remote', {
                  flag: row.featureFlag,
                  value: describeFlag(flags?.[row.featureFlag], t),
                })}
              </Txt>
            ) : null}
            <Button
              title={`${label}: ${enabled ? t('dev.states.on') : t('dev.states.off')}`}
              variant={enabled ? 'primary' : 'secondary'}
              accessibilityLabel={`${label} ${enabled ? t('dev.featureFlags.turnOff') : t('dev.featureFlags.turnOn')}`}
              onPress={() => setOverride(row.key, !enabled)}
            />
          </Fragment>
        );
      })}
      {shoppingSttFlag ? (
        <Fragment>
          <Txt variant="caption" tone="secondary">
            {t('dev.featureFlags.remote', {
              flag: shoppingSttFlag,
              value: describeFlag(flags?.[shoppingSttFlag], t),
            })}
          </Txt>
          <Button
            title={`${t('dev.featureFlags.shoppingSpeech')}: ${shoppingSttEnabled ? t('dev.states.on') : t('dev.states.off')}`}
            variant={shoppingSttEnabled ? 'primary' : 'secondary'}
            accessibilityLabel={`${t('dev.featureFlags.shoppingSpeech')} ${shoppingSttEnabled ? t('dev.featureFlags.turnOff') : t('dev.featureFlags.turnOn')}`}
            onPress={() => setFeatureOverride(shoppingSttFlag, !shoppingSttEnabled)}
          />
        </Fragment>
      ) : null}
      {Object.keys(overrides).length > 0 || Object.keys(featureOverrides).length > 0 ? (
        <Button
          title={t('dev.featureFlags.reset')}
          variant="secondary"
          onPress={() => {
            resetOverrides();
            resetFeatureOverrides();
          }}
        />
      ) : null}
    </ContentCard>
  );
}
