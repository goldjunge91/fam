import { Fragment } from 'react';

import { Card } from '@/components/ui/card';
import { useDevSettingsStore } from '@/constants/dev-settings';
import { getSettingsModules } from '@/constants/feature-registry';
import { Button, Txt } from '@/constants/ui';
import { useFeatureAccess } from '@/features/settings/use-feature-access';
import { useFeatureFlags } from '@/lib/observability/providers/posthog';

const SETTINGS_MODULES = getSettingsModules();

function describeFlag(value: boolean | string | undefined): string {
  if (value === true) return 'an';
  if (value === false) return 'aus';
  if (value === undefined) return 'nicht geladen';
  return `Variante „${value}“`;
}

/** Lokale Entwickler-Overrides für die Top-Level-Modul-Feature-Flags. */
export function FeatureFlagControls() {
  const flags = useFeatureFlags();
  const { getFeatureFlagState } = useFeatureAccess();
  const overrides = useDevSettingsStore((state) => state.moduleFeatureFlagOverrides);
  const setOverride = useDevSettingsStore((state) => state.setModuleFeatureFlagOverride);
  const resetOverrides = useDevSettingsStore((state) => state.resetModuleFeatureFlagOverrides);

  return (
    <Card title="Feature-Flags">
      <Txt variant="caption" tone="secondary">
        Lokale Overrides gelten nur mit aktivierten Entwickler-Werkzeugen und unabhängig von der
        Umschaltung unter „Module“.
      </Txt>
      {SETTINGS_MODULES.map((row) => {
        const override = overrides[row.key];
        const enabled =
          override ?? (row.featureFlag ? getFeatureFlagState(row.featureFlag) === true : true);
        const label = row.key === 'calories' ? 'Kalorien Tracking' : row.title;

        return (
          <Fragment key={row.key}>
            {row.featureFlag ? (
              <Txt variant="caption" tone="secondary">
                Remote-Flag {row.featureFlag}: {describeFlag(flags?.[row.featureFlag])}
              </Txt>
            ) : null}
            <Button
              title={`${label}: ${enabled ? 'AN' : 'AUS'}`}
              variant={enabled ? 'primary' : 'secondary'}
              accessibilityLabel={`${label} ${enabled ? 'ausschalten' : 'einschalten'}`}
              onPress={() => setOverride(row.key, !enabled)}
            />
          </Fragment>
        );
      })}
      {Object.keys(overrides).length > 0 ? (
        <Button
          title="Feature-Flag-Overrides zurücksetzen"
          variant="secondary"
          onPress={resetOverrides}
        />
      ) : null}
    </Card>
  );
}
