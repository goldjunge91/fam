import { create } from 'zustand';

import type { TrackingMethod } from '@/features/calorie-tracking/api';
import type { FeatureFlagKey, FeatureFlagValues } from '@/lib/posthog';
import { getDeviceStorage } from '@/lib/storage/device-storage';

export type TrackingMethodOption = {
  id: TrackingMethod;
  label: string;
  icon: string;
  desc: string;
  featureFlag: FeatureFlagKey | true;
};

export const TRACKING_METHODS: readonly TrackingMethodOption[] = [
  {
    id: 'standard',
    label: 'Klassisch (CICO)',
    icon: '🎯',
    desc: 'Kalorien- & Makronährstoff-Tracking ohne Spezialregeln',
    featureFlag: true,
  },
  {
    id: 'glp1',
    label: 'GLP-1 & Medikation',
    icon: '💉',
    desc: 'Injektionsintervalle, Dosierungen & Symptome erfassen',
    featureFlag: true,
  },
  {
    id: 'fasting',
    label: 'Intervallfasten',
    icon: '⏱️',
    desc: 'Fastenphasen-Timer & individuelle Essensfenster',
    featureFlag: 'tracking-method-fasting',
  },
  {
    id: 'low_carb',
    label: 'Low-Carb',
    icon: '🥗',
    desc: 'Netto-Kohlenhydrate & Ballaststoffe fokussieren',
    featureFlag: 'low-carb-tracking',
  },
  {
    id: 'keto',
    label: 'Keto (Ketogen)',
    icon: '🥑',
    desc: 'Ketose-Ernährung (<20–50g Carbs) & Keton-Logs',
    featureFlag: 'tracking-method-keto',
  },
  {
    id: 'workouts',
    label: 'Kraftsport',
    icon: '🏋️',
    desc: 'Übungen, Sätze, Wiederholungen & Gewichte dokumentieren',
    featureFlag: 'workout-log',
  },
  {
    id: 'cgm',
    label: 'Blutzucker & CGM',
    icon: '🩸',
    desc: 'Glukosemessungen vor & nach den Mahlzeiten loggen',
    featureFlag: 'tracking-method-cgm',
  },
  {
    id: 'volumetrics',
    label: 'Volumetrics',
    icon: '🥗',
    desc: 'Energiedichte-Ampel & Sättigungs-Scoring nutzen',
    featureFlag: 'tracking-method-volumetrics',
  },
];

export type TrackingMethodOverrides = Partial<Record<TrackingMethod, boolean>>;

const STORAGE_KEY = 'dev.tracking_method_overrides.v1';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readStoredOverrides(): TrackingMethodOverrides {
  try {
    const raw = getDeviceStorage().getString(STORAGE_KEY);
    if (!raw) return {};

    const value: unknown = JSON.parse(raw);
    if (!isRecord(value)) return {};

    const overrides: TrackingMethodOverrides = {};
    for (const method of TRACKING_METHODS) {
      const candidate = value[method.id];
      if (typeof candidate === 'boolean') overrides[method.id] = candidate;
    }
    return overrides;
  } catch {
    return {};
  }
}

function persistOverrides(overrides: TrackingMethodOverrides): void {
  try {
    const storage = getDeviceStorage();
    if (Object.keys(overrides).length === 0) {
      storage.remove(STORAGE_KEY);
      return;
    }
    storage.set(STORAGE_KEY, JSON.stringify(overrides));
  } catch (error) {
    if (__DEV__) console.warn('[Tracking] Overrides konnten nicht gespeichert werden:', error);
  }
}

interface TrackingMethodOverridesStore {
  overrides: TrackingMethodOverrides;
  setOverride: (method: TrackingMethod, value: boolean | null) => void;
  resetOverrides: () => void;
}

export const useTrackingMethodOverridesStore = create<TrackingMethodOverridesStore>((set) => ({
  overrides: readStoredOverrides(),
  setOverride: (method, value) =>
    set((state) => {
      const overrides = { ...state.overrides };
      if (value === null) delete overrides[method];
      else overrides[method] = value;
      persistOverrides(overrides);
      return { overrides };
    }),
  resetOverrides: () => {
    persistOverrides({});
    set({ overrides: {} });
  },
}));

export function isTrackingMethodEnabled(
  method: TrackingMethod,
  featureFlags: FeatureFlagValues,
  overrides: TrackingMethodOverrides,
): boolean {
  const override = overrides[method];
  if (override !== undefined) return override;

  const option = TRACKING_METHODS.find((candidate) => candidate.id === method);
  if (!option) return false;
  if (option.featureFlag === true) return true;
  return featureFlags?.[option.featureFlag] === true;
}

export function getTrackingMethodSettings(
  featureFlags: FeatureFlagValues,
  overrides: TrackingMethodOverrides,
): Record<TrackingMethod, boolean> {
  return {
    standard: isTrackingMethodEnabled('standard', featureFlags, overrides),
    glp1: isTrackingMethodEnabled('glp1', featureFlags, overrides),
    fasting: isTrackingMethodEnabled('fasting', featureFlags, overrides),
    low_carb: isTrackingMethodEnabled('low_carb', featureFlags, overrides),
    keto: isTrackingMethodEnabled('keto', featureFlags, overrides),
    workouts: isTrackingMethodEnabled('workouts', featureFlags, overrides),
    cgm: isTrackingMethodEnabled('cgm', featureFlags, overrides),
    volumetrics: isTrackingMethodEnabled('volumetrics', featureFlags, overrides),
  };
}
