const mockStorageData = new Map<string, string>();

jest.mock('@/lib/storage/device-storage', () => ({
  getDeviceStorage: () => ({
    getString: (key: string) => mockStorageData.get(key),
    remove: (key: string) => mockStorageData.delete(key),
    set: (key: string, value: string) => mockStorageData.set(key, value),
  }),
}));

import {
  analyticsConfig,
  getAnalyticsSettings,
  useAnalyticsSettingsStore,
} from '@/constants/analytics';

describe('analytics settings', () => {
  beforeEach(() => {
    mockStorageData.clear();
    useAnalyticsSettingsStore.getState().resetOverrides();
  });

  it('liefert standardmaessig alle Schalter aktiviert', () => {
    expect(analyticsConfig).toEqual({
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
    });
    expect(getAnalyticsSettings()).toEqual(analyticsConfig);
  });

  it('wendet einen Override sofort an und persistiert ihn', () => {
    useAnalyticsSettingsStore.getState().setOverride('providers.posthog', false);

    expect(getAnalyticsSettings().providers.posthog).toBe(false);
    expect(mockStorageData.get('dev.analytics_overrides.v1')).toBe(
      JSON.stringify({ providers: { posthog: false } }),
    );
  });

  it('kann einzelne Overrides zuruecksetzen, ohne andere zu verlieren', () => {
    const store = useAnalyticsSettingsStore.getState();
    store.setOverride('providers.posthog', false);
    store.setOverride('features.recipes', false);
    store.setOverride('providers.posthog', null);

    expect(getAnalyticsSettings()).toEqual({
      ...analyticsConfig,
      features: { ...analyticsConfig.features, recipes: false },
    });
  });

  it('setzt alle Overrides auf die Build-Defaults zurueck', () => {
    const store = useAnalyticsSettingsStore.getState();
    store.setOverride('enabled', false);
    store.setOverride('channels.diagnostics', false);
    store.resetOverrides();

    expect(getAnalyticsSettings()).toEqual(analyticsConfig);
    expect(mockStorageData.has('dev.analytics_overrides.v1')).toBe(false);
  });

  it('liest gespeicherte Overrides beim naechsten Modulstart wieder ein', () => {
    mockStorageData.set(
      'dev.analytics_overrides.v1',
      JSON.stringify({ channels: { diagnostics: false }, features: { recipes: false } }),
    );

    jest.isolateModules(() => {
      const isolatedAnalytics = require('@/constants/analytics') as typeof import('./analytics');
      expect(isolatedAnalytics.getAnalyticsSettings().channels.diagnostics).toBe(false);
      expect(isolatedAnalytics.getAnalyticsSettings().features.recipes).toBe(false);
      expect(isolatedAnalytics.getAnalyticsSettings().features.household).toBe(true);
    });
  });
});
