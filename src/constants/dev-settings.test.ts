import { useDevSettingsStore } from '@/constants/dev-settings';

const mockStorageData = new Map<string, string>();

jest.mock('@/lib/storage/device-storage', () => ({
  getDeviceStorage: () => ({
    getString: (key: string) => mockStorageData.get(key),
    remove: (key: string) => mockStorageData.delete(key),
    set: (key: string, value: string) => mockStorageData.set(key, value),
  }),
}));

describe('dev settings', () => {
  beforeEach(() => {
    mockStorageData.clear();
    useDevSettingsStore.getState().resetTrackingMethodOverrides();
  });

  it('persistiert Tracking-Methoden-Overrides wie die Analytics-Overrides', () => {
    useDevSettingsStore.getState().setTrackingMethodOverride('volumetrics', true);
    useDevSettingsStore.getState().setTrackingMethodOverride('standard', false);

    expect(useDevSettingsStore.getState().trackingMethodOverrides).toEqual({
      volumetrics: true,
      standard: false,
    });
    expect(mockStorageData.get('dev.tracking_method_overrides.v1')).toBe(
      JSON.stringify({ volumetrics: true, standard: false }),
    );
  });

  it('setzt Tracking-Methoden-Overrides vollständig zurück', () => {
    useDevSettingsStore.getState().setTrackingMethodOverride('volumetrics', true);
    useDevSettingsStore.getState().resetTrackingMethodOverrides();

    expect(useDevSettingsStore.getState().trackingMethodOverrides).toEqual({});
    expect(mockStorageData.has('dev.tracking_method_overrides.v1')).toBe(false);
  });
});
