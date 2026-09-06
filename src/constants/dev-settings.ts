import { create } from 'zustand';

import type { TrackingMethod } from '@/features/calorie-tracking/api';
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
    if (__DEV__) console.warn('[DevSettings] Overrides konnten nicht gespeichert werden:', error);
  }
}

export type DevSettings = {
  trackingMethodOverrides: TrackingMethodOverrides;
};

type DevSettingsStore = DevSettings & {
  setTrackingMethodOverride: (method: TrackingMethod, value: boolean | null) => void;
  resetTrackingMethodOverrides: () => void;
};

export const useDevSettingsStore = create<DevSettingsStore>((set) => ({
  trackingMethodOverrides: readStoredTrackingMethodOverrides(),
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
}));
