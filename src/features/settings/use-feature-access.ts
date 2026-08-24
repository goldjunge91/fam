import { useCallback } from 'react';
import { type FeatureDefinition, type FeatureId, getFeature } from '@/constants/feature-registry';
import { useSession } from '@/features/auth/session-provider';
import {
  DEFAULT_MODULE_PREFERENCES,
  useModulePreferences,
} from '@/features/settings/module-preferences';
import { type FeatureFlagKey, useFeatureFlags } from '@/lib/posthog';

export function useFeatureAccess() {
  const { session } = useSession();
  const { data: rawModules, isLoading } = useModulePreferences(session?.user.id);
  const modules = rawModules ?? DEFAULT_MODULE_PREFERENCES;
  const posthogFlags = useFeatureFlags();

  /**
   * Liefert den genauen Tri-State-Zustand eines Feature-Flags:
   * - `undefined`: Flag noch nicht bestätigt (Cold Start / Offline) oder nicht konfiguriert.
   * - `true`: Flag serverseitig aktiv.
   * - `false`: Flag serverseitig inaktiv.
   */
  const getFeatureFlagState = useCallback(
    (featureFlag?: FeatureFlagKey): boolean | undefined => {
      if (featureFlag === undefined) return undefined;
      if (posthogFlags === undefined) return undefined;
      const value = posthogFlags[featureFlag];
      if (value === true) return true;
      if (value === false) return false;
      return undefined;
    },
    [posthogFlags],
  );

  /**
   * Prüft, ob ein Modul per Remote-Feature-Flag gesperrt ist.
   * Module mit Remote-Gate sind standardmäßig gesperrt und werden nur bei einem
   * expliziten `true` freigeschaltet. Module ohne Remote-Gate bleiben freigeschaltet.
   */
  const isModuleLocked = useCallback(
    (featureFlag?: FeatureFlagKey): boolean => {
      if (featureFlag === undefined) return false;
      if (posthogFlags === undefined) return true;
      return posthogFlags[featureFlag] !== true;
    },
    [posthogFlags],
  );

  /**
   * Prüft, ob ein Feature (Top-Level Modul oder Sub-Feature) aktiv ist:
   * 1. Falls `moduleKey` gesetzt ist -> prüft `modules[moduleKey] !== false`.
   * 2. Falls `parentModule` gesetzt ist -> prüft `modules[parentModule] !== false`.
   * 3. Falls `featureFlag` gesetzt ist -> prüft `posthogFlags?.[featureFlag] === true`.
   */
  const isFeatureEnabled = useCallback(
    (featureOrId: FeatureDefinition | FeatureId): boolean => {
      const feature = typeof featureOrId === 'string' ? getFeature(featureOrId) : featureOrId;
      if (!feature) return false;

      const targetModule = feature.moduleKey ?? feature.parentModule;
      if (targetModule && modules[targetModule] === false) {
        return false;
      }
      if (feature.featureFlag) {
        if (!posthogFlags) return false;
        return posthogFlags[feature.featureFlag] === true;
      }
      return true;
    },
    [modules, posthogFlags],
  );

  return {
    isFeatureEnabled,
    isModuleLocked,
    getFeatureFlagState,
    modules,
    flags: posthogFlags ?? {},
    isLoading,
  };
}
