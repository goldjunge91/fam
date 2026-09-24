import { useDevSettingsStore } from '@/constants/dev-settings';

const mockStorageData = new Map<string, string>();

jest.mock('@/lib/storage/local-device-storage', () => ({
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
    useDevSettingsStore.getState().resetModuleFeatureFlagOverrides();
    useDevSettingsStore.getState().setSpeechTestProvider('native');
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

  it('persistiert Modul-Feature-Flag-Overrides', () => {
    useDevSettingsStore.getState().setModuleFeatureFlagOverride('calories', true);
    useDevSettingsStore.getState().setModuleFeatureFlagOverride('fridge', false);

    expect(useDevSettingsStore.getState().moduleFeatureFlagOverrides).toEqual({
      calories: true,
      fridge: false,
    });
    expect(mockStorageData.get('dev.module_feature_flag_overrides.v1')).toBe(
      JSON.stringify({ calories: true, fridge: false }),
    );
  });

  it('setzt Modul-Feature-Flag-Overrides zurück', () => {
    useDevSettingsStore.getState().setModuleFeatureFlagOverride('calories', false);
    useDevSettingsStore.getState().resetModuleFeatureFlagOverrides();

    expect(useDevSettingsStore.getState().moduleFeatureFlagOverrides).toEqual({});
    expect(mockStorageData.has('dev.module_feature_flag_overrides.v1')).toBe(false);
  });

  it('persistiert den Speech-Testanbieter auf dem Gerät', () => {
    useDevSettingsStore.getState().setSpeechTestProvider('whisper');

    expect(useDevSettingsStore.getState().speechTestProvider).toBe('whisper');
    expect(mockStorageData.get('dev.speech_test_provider.v1')).toBe('whisper');
  });

  it('kann zwischen den Speech-Testanbietern wechseln', () => {
    useDevSettingsStore.getState().setSpeechTestProvider('whisper');
    useDevSettingsStore.getState().setSpeechTestProvider('native');

    expect(useDevSettingsStore.getState().speechTestProvider).toBe('native');
  });
});
