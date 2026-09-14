import { useCallback } from 'react';
import { useDevSettingsStore } from '@/constants/dev-settings';
import {
  type FeatureDefinition,
  type FeatureId,
  getFeature,
  getFeatureByFlag,
} from '@/constants/feature-registry';
import { useSession } from '@/features/auth/session-provider';
import {
  DEFAULT_MODULE_PREFERENCES,
  type ModulePreferences,
  useModulePreferences,
} from '@/features/settings/module-preferences';
import { env } from '@/lib/config/env';
import { type FeatureFlagKey, useFeatureFlags } from '@/lib/observability/providers/posthog';

export function useFeatureAccess() {
  const { session } = useSession();
  const { data: rawModules, isLoading } = useModulePreferences(session?.user.id);
  const modules = rawModules ?? DEFAULT_MODULE_PREFERENCES;
  const posthogFlags = useFeatureFlags();
  const moduleFeatureFlagOverrides = useDevSettingsStore(
    (state) => state.moduleFeatureFlagOverrides,
  );

  const getModuleFeatureFlagOverride = useCallback(
    (module: keyof ModulePreferences): boolean | undefined => {
      if (!env.devTools) return undefined;
      return moduleFeatureFlagOverrides[module];
    },
    [moduleFeatureFlagOverrides],
  );

  const getFeatureFlagState = useCallback(
    (featureFlag?: FeatureFlagKey): boolean | undefined => {
      if (featureFlag === undefined) return undefined;
      const flaggedFeature = getFeatureByFlag(featureFlag);
      if (flaggedFeature?.moduleKey) {
        const override = getModuleFeatureFlagOverride(flaggedFeature.moduleKey);
        if (override !== undefined) return override;
      }
      if (posthogFlags === undefined) return undefined;
      const value = posthogFlags[featureFlag];
      if (value === true) return true;
      if (value === false) return false;
      return undefined;
    },
    [getModuleFeatureFlagOverride, posthogFlags],
  );

  const isModuleLocked = useCallback(
    (featureFlag?: FeatureFlagKey): boolean => {
      if (featureFlag === undefined) return false;
      return getFeatureFlagState(featureFlag) !== true;
    },
    [getFeatureFlagState],
  );

  const isFeatureEnabled = useCallback(
    (featureOrId: FeatureDefinition | FeatureId): boolean => {
      const feature = typeof featureOrId === 'string' ? getFeature(featureOrId) : featureOrId;
      if (!feature) return false;

      const targetModule = feature.moduleKey ?? feature.parentModule;
      if (targetModule && getModuleFeatureFlagOverride(targetModule) === false) {
        return false;
      }
      if (targetModule && modules[targetModule] === false) {
        return false;
      }
      if (feature.featureFlag) {
        return getFeatureFlagState(feature.featureFlag) === true;
      }
      return true;
    },
    [getFeatureFlagState, getModuleFeatureFlagOverride, modules],
  );

  return {
    isFeatureEnabled,
    isModuleLocked,
    getFeatureFlagState,
    getModuleFeatureFlagOverride,
    modules,
    flags: posthogFlags ?? {},
    isLoading,
  };
}
