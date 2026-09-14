import { create } from 'zustand';

import { getSettingsModules } from '@/constants/feature-registry';
import type { TrackingMethod } from '@/features/calorie-tracking/api';
import type { ModulePreferences } from '@/features/settings/module-preferences';
import { debugWarn } from '@/lib/observability/debug-log';
import { getDeviceStorage } from '@/lib/storage/device-storage';

export type TrackingMethodOverrides = Partial<Record<TrackingMethod, boolean>>;

const TRACKING_METHOD_IDS: readonly TrackingMethod[] = [
  'standard',
  'glp1',
  'fasting',
  'low_carb',
  'keto',
  'workouts',
  'cgm',
  'volumetrics',
];

const TRACKING_METHOD_OVERRIDES_STORAGE_KEY = 'dev.tracking_method_overrides.v1';
const MODULE_FEATURE_FLAG_OVERRIDES_STORAGE_KEY = 'dev.module_feature_flag_overrides.v1';
const MODULE_FEATURE_KEYS = getSettingsModules().map(({ key }) => key);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readStoredTrackingMethodOverrides(): TrackingMethodOverrides {
  try {
    const raw = getDeviceStorage().getString(TRACKING_METHOD_OVERRIDES_STORAGE_KEY);
    if (!raw) return {};

    const value: unknown = JSON.parse(raw);
    if (!isRecord(value)) return {};

    const overrides: TrackingMethodOverrides = {};
    for (const method of TRACKING_METHOD_IDS) {
      const candidate = value[method];
      if (typeof candidate === 'boolean') overrides[method] = candidate;
    }
    return overrides;
  } catch {
    return {};
  }
}

function persistTrackingMethodOverrides(overrides: TrackingMethodOverrides): void {
  try {
    const storage = getDeviceStorage();
    if (Object.keys(overrides).length === 0) {
      storage.remove(TRACKING_METHOD_OVERRIDES_STORAGE_KEY);
      return;
    }
    storage.set(TRACKING_METHOD_OVERRIDES_STORAGE_KEY, JSON.stringify(overrides));
  } catch (error) {
    debugWarn('[DevSettings] Overrides konnten nicht gespeichert werden:', error);
  }
}

type ModuleFeatureFlagOverrides = Partial<Record<keyof ModulePreferences, boolean>>;

function readStoredModuleFeatureFlagOverrides(): ModuleFeatureFlagOverrides {
  try {
    const raw = getDeviceStorage().getString(MODULE_FEATURE_FLAG_OVERRIDES_STORAGE_KEY);
    if (!raw) return {};

    const value: unknown = JSON.parse(raw);
    if (!isRecord(value)) return {};

    const overrides: ModuleFeatureFlagOverrides = {};
    for (const key of MODULE_FEATURE_KEYS) {
      const candidate = value[key];
      if (typeof candidate === 'boolean') overrides[key] = candidate;
    }
    return overrides;
  } catch {
    return {};
  }
}

function persistModuleFeatureFlagOverrides(overrides: ModuleFeatureFlagOverrides): void {
  try {
    const storage = getDeviceStorage();
    if (Object.keys(overrides).length === 0) {
      storage.remove(MODULE_FEATURE_FLAG_OVERRIDES_STORAGE_KEY);
      return;
    }
    storage.set(MODULE_FEATURE_FLAG_OVERRIDES_STORAGE_KEY, JSON.stringify(overrides));
  } catch (error) {
    debugWarn(
      '[DevSettings] Modul-Feature-Flag-Overrides konnten nicht gespeichert werden:',
      error,
    );
  }
}

export type DevSettings = {
  trackingMethodOverrides: TrackingMethodOverrides;
  moduleFeatureFlagOverrides: ModuleFeatureFlagOverrides;
};

type DevSettingsStore = DevSettings & {
  setTrackingMethodOverride: (method: TrackingMethod, value: boolean | null) => void;
  resetTrackingMethodOverrides: () => void;
  setModuleFeatureFlagOverride: (module: keyof ModulePreferences, value: boolean | null) => void;
  resetModuleFeatureFlagOverrides: () => void;
};

export const useDevSettingsStore = create<DevSettingsStore>((set) => ({
  trackingMethodOverrides: readStoredTrackingMethodOverrides(),
  moduleFeatureFlagOverrides: readStoredModuleFeatureFlagOverrides(),
  setTrackingMethodOverride: (method, value) =>
    set((state) => {
      const trackingMethodOverrides = { ...state.trackingMethodOverrides };
      if (value === null) delete trackingMethodOverrides[method];
      else trackingMethodOverrides[method] = value;
      persistTrackingMethodOverrides(trackingMethodOverrides);
      return { trackingMethodOverrides };
    }),
  resetTrackingMethodOverrides: () => {
    persistTrackingMethodOverrides({});
    set({ trackingMethodOverrides: {} });
  },
  setModuleFeatureFlagOverride: (module, value) =>
    set((state) => {
      const moduleFeatureFlagOverrides = { ...state.moduleFeatureFlagOverrides };
      if (value === null) delete moduleFeatureFlagOverrides[module];
      else moduleFeatureFlagOverrides[module] = value;
      persistModuleFeatureFlagOverrides(moduleFeatureFlagOverrides);
      return { moduleFeatureFlagOverrides };
    }),
  resetModuleFeatureFlagOverrides: () => {
    persistModuleFeatureFlagOverrides({});
    set({ moduleFeatureFlagOverrides: {} });
  },
}));
