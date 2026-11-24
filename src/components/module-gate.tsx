import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Screen } from '@/components/layout/screen';
import { ContentCard } from '@/components/ui/content-card';
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
  const { t } = useTranslation();
  const featureDef = getFeature(feature);
  const { modules, getFeatureFlagState, getModuleFeatureFlagOverride } = useFeatureAccess();

  if (!featureDef) {
    if (__DEV__) {
      throw new Error(
        `[ModuleGate] Unbekannte FeatureId "${feature}". Bitte in APP_FEATURES (feature-registry.ts) deklarieren.`,
      );
    }
    return null;
  }

  const title = customTitle ?? t(featureDef.title);
  const targetModule = featureDef.moduleKey ?? featureDef.parentModule;
  const featureFlagState = getFeatureFlagState(featureDef.featureFlag);
  const moduleFeatureFlagOverride = targetModule
    ? getModuleFeatureFlagOverride(targetModule)
    : undefined;

  if (modules && targetModule && modules[targetModule] === false) {
    return (
      <Screen title={title}>
        <ContentCard>
          <EmptyState
            symbol="eye.slash"
            title={t('common.moduleGate.disabledTitle')}
            hint={t('common.moduleGate.disabledHint')}
          />
          <Button
            title={t('common.moduleGate.enableButton')}
            onPress={() => router.push('/settings/modules')}
          />
        </ContentCard>
      </Screen>
    );
  }

  if (featureFlagState === false || moduleFeatureFlagOverride === false) {
    return (
      <Screen title={title}>
        <ContentCard>
          <EmptyState
            symbol="hourglass"
            title={t('common.moduleGate.unavailableTitle')}
            hint={t('common.moduleGate.unavailableHint')}
          />
        </ContentCard>
      </Screen>
    );
  }

  return <>{children}</>;
}
