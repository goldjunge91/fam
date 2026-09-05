import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { Screen } from '@/components/layout/screen';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { type FeatureId, getFeature } from '@/constants/feature-registry';
import { Button } from '@/constants/ui';
import { useFeatureAccess } from '@/features/settings/use-feature-access';

type ModuleGateProps = {
  /** Die Feature-ID aus der zentralen Feature-Registry (`APP_FEATURES`). */
  feature: FeatureId;
  /** Optionaler Titel-Override des Ersatz-Screens (Standard: Titel aus Registry). */
  title?: string;
  children: ReactNode;
};

export function ModuleGate({ feature, title: customTitle, children }: ModuleGateProps) {
  const featureDef = getFeature(feature);
  const { modules, getFeatureFlagState } = useFeatureAccess();

  if (!featureDef) {
    if (__DEV__) {
      throw new Error(
        `[ModuleGate] Unbekannte FeatureId "${feature}". Bitte in APP_FEATURES (feature-registry.ts) deklarieren.`,
      );
    }
    return null;
  }

  const title = customTitle ?? featureDef.title;
  const targetModule = featureDef.moduleKey ?? featureDef.parentModule;
  const featureFlagState = getFeatureFlagState(featureDef.featureFlag);

  if (modules && targetModule && modules[targetModule] === false) {
    return (
      <Screen title={title}>
        <Card>
          <EmptyState
            symbol="eye.slash"
            title="Modul nicht aktiviert"
            hint="Du hast dieses Modul in den Einstellungen ausgeblendet. Deine Daten bleiben erhalten."
          />
          <Button
            title="In den Einstellungen aktivieren"
            onPress={() => router.push('/settings/modules')}
          />
        </Card>
      </Screen>
    );
  }

  if (featureFlagState === false) {
    return (
      <Screen title={title}>
        <Card>
          <EmptyState
            symbol="hourglass"
            title="Noch nicht verfügbar"
            hint="Dieser Bereich wird gerade schrittweise ausgerollt und ist für dich noch nicht freigeschaltet."
          />
        </Card>
      </Screen>
    );
  }

  return <>{children}</>;
}
