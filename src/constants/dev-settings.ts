import { create } from 'zustand';

import { getSettingsModules } from '@/constants/feature-registry';
import type { TrackingMethod } from '@/features/calorie-tracking/api';
import type { ModulePreferences } from '@/features/settings/module-preferences';
import { debugWarn } from '@/lib/observability/debug-log';
import type { FeatureFlagKey } from '@/lib/observability/providers/posthog';
import { getDeviceStorage } from '@/lib/storage/device-storage';

/**
 * Technischer Speicher fuer lokale Entwickler-Overrides.
 * Diese Datei rendert keine UI; die Setter werden vom Dev-Menue aufgerufen.
 */
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
const FEATURE_FLAG_OVERRIDES_STORAGE_KEY = 'dev.feature_flag_overrides.v1';
const SPEECH_TEST_PROVIDER_STORAGE_KEY = 'dev.speech_test_provider.v1';
const MODULE_FEATURE_KEYS = getSettingsModules().map(({ key }) => key);
const FEATURE_FLAG_OVERRIDE_KEYS: readonly FeatureFlagKey[] = ['shopping-stt'];

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

export type FeatureFlagOverrides = Partial<Record<FeatureFlagKey, boolean>>;

export type SpeechTestProvider = 'native' | 'whisper';

function readSpeechTestProvider(): SpeechTestProvider {
  try {
    const value = getDeviceStorage().getString(SPEECH_TEST_PROVIDER_STORAGE_KEY);
    return value === 'whisper' ? 'whisper' : 'native';
  } catch {
    return 'native';
  }
}

function persistSpeechTestProvider(provider: SpeechTestProvider): void {
  try {
    getDeviceStorage().set(SPEECH_TEST_PROVIDER_STORAGE_KEY, provider);
  } catch (error) {
    debugWarn('[DevSettings] Speech-Testanbieter konnte nicht gespeichert werden:', error);
  }
}

function readFeatureFlagOverrides(): FeatureFlagOverrides {
  try {
    const raw = getDeviceStorage().getString(FEATURE_FLAG_OVERRIDES_STORAGE_KEY);
    if (!raw) return {};

    const value: unknown = JSON.parse(raw);
    if (!isRecord(value)) return {};

    const overrides: FeatureFlagOverrides = {};
    for (const key of FEATURE_FLAG_OVERRIDE_KEYS) {
      const candidate = value[key];
      if (typeof candidate === 'boolean') overrides[key] = candidate;
    }
    return overrides;
  } catch {
    return {};
  }
}

function persistFeatureFlagOverrides(overrides: FeatureFlagOverrides): void {
  try {
    const storage = getDeviceStorage();
    if (Object.keys(overrides).length === 0) {
      storage.remove(FEATURE_FLAG_OVERRIDES_STORAGE_KEY);
      return;
    }
    storage.set(FEATURE_FLAG_OVERRIDES_STORAGE_KEY, JSON.stringify(overrides));
  } catch (error) {
    debugWarn('[DevSettings] Feature-Flag-Overrides konnten nicht gespeichert werden:', error);
  }
}

export type DevSettings = {
  trackingMethodOverrides: TrackingMethodOverrides;
  moduleFeatureFlagOverrides: ModuleFeatureFlagOverrides;
  featureFlagOverrides: FeatureFlagOverrides;
  speechTestProvider: SpeechTestProvider;
};

type DevSettingsStore = DevSettings & {
  setTrackingMethodOverride: (method: TrackingMethod, value: boolean | null) => void;
  resetTrackingMethodOverrides: () => void;
  setModuleFeatureFlagOverride: (module: keyof ModulePreferences, value: boolean | null) => void;
  resetModuleFeatureFlagOverrides: () => void;
  setFeatureFlagOverride: (featureFlag: FeatureFlagKey, value: boolean | null) => void;
  resetFeatureFlagOverrides: () => void;
  setSpeechTestProvider: (provider: SpeechTestProvider) => void;
};

export const useDevSettingsStore = create<DevSettingsStore>((set) => ({
  trackingMethodOverrides: readStoredTrackingMethodOverrides(),
  moduleFeatureFlagOverrides: readStoredModuleFeatureFlagOverrides(),
  featureFlagOverrides: readFeatureFlagOverrides(),
  speechTestProvider: readSpeechTestProvider(),
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
  setFeatureFlagOverride: (featureFlag, value) =>
    set((state) => {
      const featureFlagOverrides = { ...state.featureFlagOverrides };
      if (value === null) delete featureFlagOverrides[featureFlag];
      else featureFlagOverrides[featureFlag] = value;
      persistFeatureFlagOverrides(featureFlagOverrides);
      return { featureFlagOverrides };
    }),
  resetFeatureFlagOverrides: () => {
    persistFeatureFlagOverrides({});
    set({ featureFlagOverrides: {} });
  },
  setSpeechTestProvider: (provider) => {
    persistSpeechTestProvider(provider);
    set({ speechTestProvider: provider });
  },
}));
