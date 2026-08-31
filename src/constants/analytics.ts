import { create } from 'zustand';

import { getDeviceStorage } from '@/lib/storage/device-storage';

export const analyticsConfig = {
  enabled: true,
  providers: { aptabase: true, posthog: true },
  channels: { productEvents: true, errorReports: true, diagnostics: true },
  features: {
    onboarding: true,
    household: true,
    inventory: true,
    shoppingList: true,
    recipes: true,
    mealPlanner: true,
    productSearch: true,
    premium: true,
    sync: true,
  },
} as const;

type Mutable<T> = T extends boolean
  ? boolean
  : T extends object
    ? { -readonly [K in keyof T]: Mutable<T[K]> }
    : T;

export type AnalyticsSettings = Mutable<typeof analyticsConfig>;
export type AnalyticsOverrides = {
  enabled?: boolean;
  providers?: Partial<AnalyticsSettings['providers']>;
  channels?: Partial<AnalyticsSettings['channels']>;
  features?: Partial<AnalyticsSettings['features']>;
};

export type AnalyticsSettingPath =
  | 'enabled'
  | `providers.${keyof AnalyticsSettings['providers']}`
  | `channels.${keyof AnalyticsSettings['channels']}`
  | `features.${keyof AnalyticsSettings['features']}`;

const STORAGE_KEY = 'dev.analytics_overrides.v1';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readBooleanProperties<T extends Record<string, boolean>>(
  value: unknown,
  defaults: T,
): Partial<T> {
  if (!isRecord(value)) return {};

  const result: Partial<T> = {};
  for (const key of Object.keys(defaults) as Array<keyof T>) {
    const candidate = value[String(key)];
    if (typeof candidate === 'boolean') result[key] = candidate as T[typeof key];
  }
  return result;
}

function readStoredOverrides(): AnalyticsOverrides {
  try {
    const raw = getDeviceStorage().getString(STORAGE_KEY);
    if (!raw) return {};

    const value: unknown = JSON.parse(raw);
    if (!isRecord(value)) return {};

    return {
      ...(typeof value.enabled === 'boolean' ? { enabled: value.enabled } : {}),
      providers: readBooleanProperties(value.providers, analyticsConfig.providers),
      channels: readBooleanProperties(value.channels, analyticsConfig.channels),
      features: readBooleanProperties(value.features, analyticsConfig.features),
    };
  } catch {
    return {};
  }
}

function persistOverrides(overrides: AnalyticsOverrides): void {
  try {
    const storage = getDeviceStorage();
    if (Object.keys(overrides).length === 0) {
      storage.remove(STORAGE_KEY);
      return;
    }
    storage.set(STORAGE_KEY, JSON.stringify(overrides));
  } catch (error) {
    if (__DEV__) console.warn('[Analytics] Overrides konnten nicht gespeichert werden:', error);
  }
}

function mergeAnalyticsSettings(overrides: AnalyticsOverrides): AnalyticsSettings {
  return {
    enabled: overrides.enabled ?? analyticsConfig.enabled,
    providers: { ...analyticsConfig.providers, ...overrides.providers },
    channels: { ...analyticsConfig.channels, ...overrides.channels },
    features: { ...analyticsConfig.features, ...overrides.features },
  };
}

function updateOverride(
  overrides: AnalyticsOverrides,
  path: AnalyticsSettingPath,
  value: boolean | null,
): AnalyticsOverrides {
  const next = {
    ...overrides,
    providers: overrides.providers ? { ...overrides.providers } : undefined,
    channels: overrides.channels ? { ...overrides.channels } : undefined,
    features: overrides.features ? { ...overrides.features } : undefined,
  };

  if (path === 'enabled') {
    if (value === null) delete next.enabled;
    else next.enabled = value;
    return next;
  }

  const [section, key] = path.split('.') as ['providers' | 'channels' | 'features', string];

  if (section === 'providers') {
    const providers = { ...next.providers };
    const provider = key as keyof AnalyticsSettings['providers'];
    if (value === null) delete providers[provider];
    else providers[provider] = value;
    if (Object.keys(providers).length === 0) delete next.providers;
    else next.providers = providers;
  } else if (section === 'channels') {
    const channels = { ...next.channels };
    const channel = key as keyof AnalyticsSettings['channels'];
    if (value === null) delete channels[channel];
    else channels[channel] = value;
    if (Object.keys(channels).length === 0) delete next.channels;
    else next.channels = channels;
  } else {
    const features = { ...next.features };
    const feature = key as keyof AnalyticsSettings['features'];
    if (value === null) delete features[feature];
    else features[feature] = value;
    if (Object.keys(features).length === 0) delete next.features;
    else next.features = features;
  }
  return next;
}

interface AnalyticsSettingsStore {
  overrides: AnalyticsOverrides;
  setOverride: (path: AnalyticsSettingPath, value: boolean | null) => void;
  resetOverrides: () => void;
}

export const useAnalyticsSettingsStore = create<AnalyticsSettingsStore>((set) => ({
  overrides: readStoredOverrides(),
  setOverride: (path, value) =>
    set((state) => {
      const overrides = updateOverride(state.overrides, path, value);
      persistOverrides(overrides);
      return { overrides };
    }),
  resetOverrides: () => {
    persistOverrides({});
    set({ overrides: {} });
  },
}));

export function getAnalyticsSettings(): AnalyticsSettings {
  return mergeAnalyticsSettings(useAnalyticsSettingsStore.getState().overrides);
}

export function isAnalyticsFeatureEnabled(feature: keyof AnalyticsSettings['features']): boolean {
  return getAnalyticsSettings().features[feature];
}
