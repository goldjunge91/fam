import { useDevSettingsStore } from '@/constants/dev-settings';

const mockStorageData = new Map<string, string>();
const mockStorageFailures = new Set<'read' | 'remove' | 'write'>();

jest.mock('@/lib/storage/local-device-storage', () => ({
  getDeviceStorage: () => ({
    getString: (key: string) => {
      if (mockStorageFailures.has('read')) throw new Error('read failed');
      return mockStorageData.get(key);
    },
    remove: (key: string) => {
      if (mockStorageFailures.has('remove')) throw new Error('remove failed');
      mockStorageData.delete(key);
    },
    set: (key: string, value: string) => {
      if (mockStorageFailures.has('write')) throw new Error('write failed');
      mockStorageData.set(key, value);
    },
  }),
}));

jest.mock('@/lib/observability/debug-log', () => ({ debugWarn: jest.fn() }));

function loadFreshDevSettingsStore(): typeof useDevSettingsStore {
  let store: typeof useDevSettingsStore | undefined;
  jest.isolateModules(() => {
    store = (jest.requireActual('@/constants/dev-settings') as typeof import('./dev-settings'))
      .useDevSettingsStore;
  });
  if (!store) throw new Error('Dev settings store did not initialize.');
  return store;
}

describe('dev settings', () => {
  beforeEach(() => {
    mockStorageData.clear();
    mockStorageFailures.clear();
    useDevSettingsStore.getState().resetTrackingMethodOverrides();
    useDevSettingsStore.getState().resetModuleFeatureFlagOverrides();
    useDevSettingsStore.getState().resetFeatureFlagOverrides();
    useDevSettingsStore.getState().setSpeechTestProvider('native');
    useDevSettingsStore.getState().setReceiptOcrTestEnabled(false);
    useDevSettingsStore.getState().setReceiptOcrProvider('apple-vision');
    useDevSettingsStore.getState().setAiGatewayModel(null);
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

  it('entfernt einzelne Tracking- und Modul-Overrides, wenn sie auf den Standard zurückgesetzt werden', () => {
    useDevSettingsStore.getState().setTrackingMethodOverride('standard', true);
    useDevSettingsStore.getState().setTrackingMethodOverride('standard', null);
    useDevSettingsStore.getState().setModuleFeatureFlagOverride('calories', true);
    useDevSettingsStore.getState().setModuleFeatureFlagOverride('calories', null);

    expect(useDevSettingsStore.getState().trackingMethodOverrides).toEqual({});
    expect(useDevSettingsStore.getState().moduleFeatureFlagOverrides).toEqual({});
    expect(mockStorageData.has('dev.tracking_method_overrides.v1')).toBe(false);
    expect(mockStorageData.has('dev.module_feature_flag_overrides.v1')).toBe(false);
  });

  it('persistiert und entfernt Remote-Feature-Flag-Overrides', () => {
    useDevSettingsStore.getState().setFeatureFlagOverride('shopping-stt', true);
    expect(useDevSettingsStore.getState().featureFlagOverrides).toEqual({ 'shopping-stt': true });
    expect(mockStorageData.get('dev.feature_flag_overrides.v1')).toBe('{"shopping-stt":true}');

    useDevSettingsStore.getState().setFeatureFlagOverride('shopping-stt', null);
    expect(useDevSettingsStore.getState().featureFlagOverrides).toEqual({});
    expect(mockStorageData.has('dev.feature_flag_overrides.v1')).toBe(false);
  });

  it('persistiert den Speech-Testanbieter auf dem Gerät', () => {
    useDevSettingsStore.getState().setSpeechTestProvider('whisper');

    expect(useDevSettingsStore.getState().speechTestProvider).toBe('whisper');
    expect(mockStorageData.get('dev.speech_test_provider.v1')).toBe('whisper');
  });

  it('persistiert das Chef-Koch-Modell und setzt den Server-Default zurück', () => {
    useDevSettingsStore.getState().setAiGatewayModel('google/gemma-4-31b-it:free');

    expect(useDevSettingsStore.getState().aiGatewayModel).toBe('google/gemma-4-31b-it:free');
    expect(mockStorageData.get('dev.ai_gateway_model.v1')).toBe('google/gemma-4-31b-it:free');

    useDevSettingsStore.getState().setAiGatewayModel('google/gemma-4-26b-a4b-it:free');
    expect(useDevSettingsStore.getState().aiGatewayModel).toBe('google/gemma-4-26b-a4b-it:free');

    useDevSettingsStore.getState().setAiGatewayModel(null);
    expect(useDevSettingsStore.getState().aiGatewayModel).toBeNull();
    expect(mockStorageData.has('dev.ai_gateway_model.v1')).toBe(false);
  });

  it('persistiert den Receipt-OCR-Testmodus und den ausgewählten Anbieter', () => {
    useDevSettingsStore.getState().setReceiptOcrTestEnabled(true);
    useDevSettingsStore.getState().setReceiptOcrProvider('google-mlkit');

    expect(useDevSettingsStore.getState().receiptOcrTestEnabled).toBe(true);
    expect(useDevSettingsStore.getState().receiptOcrProvider).toBe('google-mlkit');
    expect(mockStorageData.get('dev.receipt_ocr_test_enabled.v1')).toBe('true');
    expect(mockStorageData.get('dev.receipt_ocr_provider.v1')).toBe('google-mlkit');
  });

  it('lädt gespeicherte gültige Overrides und ignoriert Werte außerhalb des bekannten Formats', () => {
    mockStorageData.set(
      'dev.tracking_method_overrides.v1',
      '{"standard":true,"glp1":"on","unknown":false}',
    );
    mockStorageData.set('dev.module_feature_flag_overrides.v1', '{"calories":false}');
    mockStorageData.set('dev.feature_flag_overrides.v1', '{"shopping-stt":true}');
    mockStorageData.set('dev.speech_test_provider.v1', 'whisper');
    mockStorageData.set('dev.receipt_ocr_test_enabled.v1', 'true');
    mockStorageData.set('dev.receipt_ocr_provider.v1', 'apple-vision');
    mockStorageData.set('dev.ai_gateway_model.v1', 'google/gemma-4-26b-a4b-it:free');

    const store = loadFreshDevSettingsStore();

    expect(store.getState()).toMatchObject({
      trackingMethodOverrides: { standard: true },
      moduleFeatureFlagOverrides: { calories: false },
      featureFlagOverrides: { 'shopping-stt': true },
      speechTestProvider: 'whisper',
      receiptOcrTestEnabled: true,
      receiptOcrProvider: 'apple-vision',
      aiGatewayModel: 'google/gemma-4-26b-a4b-it:free',
    });
  });

  it('uses defaults for malformed saved overrides and unavailable storage', () => {
    mockStorageData.set('dev.tracking_method_overrides.v1', 'not-json');
    mockStorageData.set('dev.module_feature_flag_overrides.v1', '[]');
    mockStorageData.set('dev.feature_flag_overrides.v1', '"invalid-shape"');
    mockStorageData.set('dev.speech_test_provider.v1', 'unknown');
    mockStorageData.set('dev.receipt_ocr_test_enabled.v1', 'TRUE');
    mockStorageData.set('dev.receipt_ocr_provider.v1', 'unknown');
    mockStorageData.set('dev.ai_gateway_model.v1', 'google/gemma-4-31b-it');

    const malformedStore = loadFreshDevSettingsStore();
    expect(malformedStore.getState()).toMatchObject({
      trackingMethodOverrides: {},
      moduleFeatureFlagOverrides: {},
      featureFlagOverrides: {},
      speechTestProvider: 'native',
      receiptOcrTestEnabled: false,
      receiptOcrProvider: 'google-mlkit',
      aiGatewayModel: null,
    });

    mockStorageFailures.add('read');
    const unavailableStore = loadFreshDevSettingsStore();
    expect(unavailableStore.getState()).toMatchObject({
      trackingMethodOverrides: {},
      moduleFeatureFlagOverrides: {},
      featureFlagOverrides: {},
      speechTestProvider: 'native',
      receiptOcrTestEnabled: false,
      receiptOcrProvider: 'google-mlkit',
      aiGatewayModel: null,
    });
  });

  it('keeps store values current when device storage rejects writes', () => {
    mockStorageFailures.add('write');
    const store = useDevSettingsStore.getState();

    store.setTrackingMethodOverride('standard', true);
    store.setModuleFeatureFlagOverride('calories', true);
    store.setFeatureFlagOverride('shopping-stt', true);
    store.setSpeechTestProvider('whisper');
    store.setReceiptOcrTestEnabled(true);
    store.setReceiptOcrProvider('apple-vision');
    store.setAiGatewayModel('google/gemma-4-31b-it:free');

    expect(useDevSettingsStore.getState()).toMatchObject({
      trackingMethodOverrides: { standard: true },
      moduleFeatureFlagOverrides: { calories: true },
      featureFlagOverrides: { 'shopping-stt': true },
      speechTestProvider: 'whisper',
      receiptOcrTestEnabled: true,
      receiptOcrProvider: 'apple-vision',
      aiGatewayModel: 'google/gemma-4-31b-it:free',
    });
  });
});
