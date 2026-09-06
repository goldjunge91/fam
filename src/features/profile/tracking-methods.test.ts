import {
  getTrackingMethodSettings,
  useTrackingMethodOverridesStore,
} from '@/features/profile/tracking-methods';

const mockStorageData = new Map<string, string>();

jest.mock('@/lib/storage/device-storage', () => ({
  getDeviceStorage: () => ({
    getString: (key: string) => mockStorageData.get(key),
    remove: (key: string) => mockStorageData.delete(key),
    set: (key: string, value: string) => mockStorageData.set(key, value),
  }),
}));

describe('tracking method overrides', () => {
  beforeEach(() => {
    mockStorageData.clear();
    useTrackingMethodOverridesStore.getState().resetOverrides();
  });

  it('aktiviert ohne Override nur CICO und GLP-1 standardmäßig', () => {
    const settings = getTrackingMethodSettings(undefined, {});

    expect(settings.standard).toBe(true);
    expect(settings.glp1).toBe(true);
    expect(settings.fasting).toBe(false);
    expect(settings.volumetrics).toBe(false);
  });

  it('wertet PostHog-Flags aus', () => {
    const settings = getTrackingMethodSettings(
      { 'tracking-method-volumetrics': true, 'tracking-method-cgm': false },
      {},
    );

    expect(settings.volumetrics).toBe(true);
    expect(settings.cgm).toBe(false);
  });

  it('setzt lokale Overrides vor PostHog und persistiert sie', () => {
    useTrackingMethodOverridesStore.getState().setOverride('volumetrics', true);
    useTrackingMethodOverridesStore.getState().setOverride('standard', false);

    const settings = getTrackingMethodSettings(
      {},
      useTrackingMethodOverridesStore.getState().overrides,
    );

    expect(settings.volumetrics).toBe(true);
    expect(settings.standard).toBe(false);
    expect(mockStorageData.get('dev.tracking_method_overrides.v1')).toBe(
      JSON.stringify({ volumetrics: true, standard: false }),
    );
  });

  it('setzt Overrides zurück und stellt die Defaults wieder her', () => {
    useTrackingMethodOverridesStore.getState().setOverride('volumetrics', true);
    useTrackingMethodOverridesStore.getState().resetOverrides();

    expect(useTrackingMethodOverridesStore.getState().overrides).toEqual({});
    expect(getTrackingMethodSettings(undefined, {}).volumetrics).toBe(false);
    expect(mockStorageData.has('dev.tracking_method_overrides.v1')).toBe(false);
  });
});
