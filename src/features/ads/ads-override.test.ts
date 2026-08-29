import { getAdsEnabled, useAdsOverrideStore } from './ads-override';

const mockStorageData = new Map<string, string>();

jest.mock('@/lib/storage/device-storage', () => ({
  getDeviceStorage: () => ({
    getString: (key: string) => mockStorageData.get(key),
    remove: (key: string) => mockStorageData.delete(key),
    set: (key: string, value: string) => mockStorageData.set(key, value),
  }),
}));

describe('ads override', () => {
  const originalAdsEnabled = process.env.EXPO_PUBLIC_ADS_ENABLED;

  beforeEach(() => {
    mockStorageData.clear();
    useAdsOverrideStore.getState().setOverride(null);
  });

  afterEach(() => {
    if (originalAdsEnabled === undefined) {
      delete process.env.EXPO_PUBLIC_ADS_ENABLED;
    } else {
      process.env.EXPO_PUBLIC_ADS_ENABLED = originalAdsEnabled;
    }
  });

  it('verwendet ohne Override das Build-Flag', () => {
    process.env.EXPO_PUBLIC_ADS_ENABLED = 'false';

    expect(getAdsEnabled()).toBe(false);
  });

  it('setzt Werbung unabhaengig vom Build-Flag sofort um', () => {
    process.env.EXPO_PUBLIC_ADS_ENABLED = 'true';

    useAdsOverrideStore.getState().setOverride(false);
    expect(getAdsEnabled()).toBe(false);

    useAdsOverrideStore.getState().setOverride(true);
    expect(getAdsEnabled()).toBe(true);
  });

  it('setzt den Override zurueck auf das Build-Flag', () => {
    process.env.EXPO_PUBLIC_ADS_ENABLED = 'false';

    useAdsOverrideStore.getState().setOverride(true);
    useAdsOverrideStore.getState().setOverride(null);

    expect(getAdsEnabled()).toBe(false);
  });
});
