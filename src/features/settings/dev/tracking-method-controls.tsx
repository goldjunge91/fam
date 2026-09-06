import { Card } from '@/components/ui/card';
import { Button, Txt } from '@/constants/ui';
import {
  getTrackingMethodSettings,
  TRACKING_METHODS,
  useTrackingMethodOverridesStore,
} from '@/features/profile/tracking-methods';
import { useFeatureFlags } from '@/lib/posthog';

/** Lokale Freischaltung von Tracking-Methoden für Dev-Builds und TestFlight. */
export function TrackingMethodControls() {
  const featureFlags = useFeatureFlags();
  const overrides = useTrackingMethodOverridesStore((state) => state.overrides);
  const setOverride = useTrackingMethodOverridesStore((state) => state.setOverride);
  const resetOverrides = useTrackingMethodOverridesStore((state) => state.resetOverrides);
  const settings = getTrackingMethodSettings(featureFlags, overrides);

  return (
    <Card title="Tracking-Methoden-Steuerung">
      <Txt variant="caption" tone="secondary">
        Standardmäßig sind Klassisch (CICO) und GLP-1 aktiv. Lokale Overrides gelten sofort und
        überleben einen Neustart.
      </Txt>
      {TRACKING_METHODS.map((method) => {
        const enabled = settings[method.id];
        return (
          <Button
            key={method.id}
            title={`${method.label}: ${enabled ? 'AN' : 'AUS'}`}
            variant={enabled ? 'primary' : 'secondary'}
            accessibilityLabel={`${method.label} ${enabled ? 'ausschalten' : 'einschalten'}`}
            onPress={() => setOverride(method.id, !enabled)}
          />
        );
      })}
      {Object.keys(overrides).length > 0 ? (
        <Button
          title="Tracking-Methoden-Overrides zurücksetzen"
          variant="secondary"
          onPress={resetOverrides}
        />
      ) : null}
    </Card>
  );
}
