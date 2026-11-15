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
    useDevSettingsStore.setState({
      aiProvider: 'openrouter',
      aiModel: 'z-ai/glm-5.3-flash',
      aiModels: {
        openrouter: 'z-ai/glm-5.3-flash',
        groq: 'qwen/qwen3.8-27b',
      },
    });
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

  it('kann zwischen den Speech-Testanbietern wechseln', () => {
    useDevSettingsStore.getState().setSpeechTestProvider('whisper');
    useDevSettingsStore.getState().setSpeechTestProvider('native');

    expect(useDevSettingsStore.getState().speechTestProvider).toBe('native');
  });

  it('persistiert den Receipt-OCR-Testmodus und den ausgewählten Anbieter', () => {
    useDevSettingsStore.getState().setReceiptOcrTestEnabled(true);
    useDevSettingsStore.getState().setReceiptOcrProvider('google-mlkit');

    expect(useDevSettingsStore.getState().receiptOcrTestEnabled).toBe(true);
    expect(useDevSettingsStore.getState().receiptOcrProvider).toBe('google-mlkit');
    expect(mockStorageData.get('dev.receipt_ocr_test_enabled.v1')).toBe('true');
    expect(mockStorageData.get('dev.receipt_ocr_provider.v1')).toBe('google-mlkit');
  });

  it('speichert Provider- und Modellauswahl für lokale KI-Tests', () => {
    useDevSettingsStore.getState().setAiProvider('groq');
    useDevSettingsStore.getState().setAiModel('openai/gpt-oss-120b');

    expect(useDevSettingsStore.getState()).toMatchObject({
      aiProvider: 'groq',
      aiModel: 'openai/gpt-oss-120b',
    });
    expect(mockStorageData.get('dev.ai_provider.v1')).toBe('groq');
    expect(mockStorageData.get('dev.ai_model.v1')).toBe('openai/gpt-oss-120b');
  });

  it('speichert die Modell-ID getrennt pro Provider und stellt sie beim Wechsel wieder her', () => {
    useDevSettingsStore.getState().setAiModel('anthropic/claude-sonnet-4');
    useDevSettingsStore.getState().setAiProvider('groq');
    useDevSettingsStore.getState().setAiModel('openai/gpt-oss-120b');
    useDevSettingsStore.getState().setAiProvider('openrouter');

    expect(useDevSettingsStore.getState()).toMatchObject({
      aiProvider: 'openrouter',
      aiModel: 'anthropic/claude-sonnet-4',
      aiModels: {
        openrouter: 'anthropic/claude-sonnet-4',
        groq: 'openai/gpt-oss-120b',
      },
    });
    expect(mockStorageData.get('dev.ai_models.v1')).toBe(
      JSON.stringify({
        openrouter: 'anthropic/claude-sonnet-4',
        groq: 'openai/gpt-oss-120b',
      }),
    );
  });

  it('setzt beim Wechsel zu einem Provider ein dazu passendes Standardmodell', () => {
    useDevSettingsStore.getState().setAiProvider('groq');

    expect(useDevSettingsStore.getState().aiModel).toBe('qwen/qwen3.8-27b');
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
    mockStorageData.set('dev.ai_provider.v1', 'groq');
    mockStorageData.set('dev.ai_model.v1', 'openai/gpt-oss-20b');

    const store = loadFreshDevSettingsStore();

    expect(store.getState()).toMatchObject({
      trackingMethodOverrides: { standard: true },
      moduleFeatureFlagOverrides: { calories: false },
      featureFlagOverrides: { 'shopping-stt': true },
      speechTestProvider: 'whisper',
      receiptOcrTestEnabled: true,
      receiptOcrProvider: 'apple-vision',
      aiProvider: 'groq',
      aiModel: 'openai/gpt-oss-20b',
    });
  });

  it('lädt die pro Provider gespeicherten Modell-IDs', () => {
    mockStorageData.set('dev.ai_provider.v1', 'groq');
    mockStorageData.set(
      'dev.ai_models.v1',
      JSON.stringify({
        openrouter: 'anthropic/claude-sonnet-4',
        groq: 'openai/gpt-oss-120b',
      }),
    );

    const store = loadFreshDevSettingsStore();

    expect(store.getState()).toMatchObject({
      aiProvider: 'groq',
      aiModel: 'openai/gpt-oss-120b',
      aiModels: {
        openrouter: 'anthropic/claude-sonnet-4',
        groq: 'openai/gpt-oss-120b',
      },
    });
  });

  it('uses defaults for malformed saved overrides and unavailable storage', () => {
    mockStorageData.set('dev.tracking_method_overrides.v1', 'not-json');
    mockStorageData.set('dev.module_feature_flag_overrides.v1', '[]');
    mockStorageData.set('dev.feature_flag_overrides.v1', '"invalid-shape"');
    mockStorageData.set('dev.speech_test_provider.v1', 'unknown');
    mockStorageData.set('dev.receipt_ocr_test_enabled.v1', 'TRUE');
    mockStorageData.set('dev.receipt_ocr_provider.v1', 'unknown');
    mockStorageData.set('dev.ai_provider.v1', 'unknown');
    mockStorageData.set('dev.ai_model.v1', 'not a model id');

    const malformedStore = loadFreshDevSettingsStore();
    expect(malformedStore.getState()).toMatchObject({
      trackingMethodOverrides: {},
      moduleFeatureFlagOverrides: {},
      featureFlagOverrides: {},
      speechTestProvider: 'native',
      receiptOcrTestEnabled: false,
      receiptOcrProvider: 'google-mlkit',
      aiProvider: 'openrouter',
      aiModel: 'z-ai/glm-5.3-flash',
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
      aiProvider: 'openrouter',
      aiModel: 'z-ai/glm-5.3-flash',
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
    store.setAiProvider('groq');
    store.setAiModel('openai/gpt-oss-20b');

    expect(useDevSettingsStore.getState()).toMatchObject({
      trackingMethodOverrides: { standard: true },
      moduleFeatureFlagOverrides: { calories: true },
      featureFlagOverrides: { 'shopping-stt': true },
      speechTestProvider: 'whisper',
      receiptOcrTestEnabled: true,
      receiptOcrProvider: 'apple-vision',
      aiProvider: 'groq',
      aiModel: 'openai/gpt-oss-20b',
    });
  });
});
