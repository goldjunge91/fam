const mockRequireOptionalNativeModule = jest.fn();

jest.mock('expo-modules-core', () => ({
  requireOptionalNativeModule: (...args: unknown[]) => mockRequireOptionalNativeModule(...args),
}));

describe('iOS Google ML Kit adapter', () => {
  let adapter: typeof import('./mlkit.ios');

  function loadAdapter() {
    jest.isolateModules(() => {
      adapter = require('./mlkit.ios') as typeof import('./mlkit.ios');
    });
  }

  beforeEach(() => {
    mockRequireOptionalNativeModule.mockReset();
  });

  it('reports unavailable and throws a clear error when the native module is absent', async () => {
    mockRequireOptionalNativeModule.mockReturnValue(null);
    loadAdapter();

    expect(adapter.isGoogleMlKitAvailable()).toBe(false);
    await expect(adapter.recognizeWithGoogleMlKit('file:///receipt.jpg')).rejects.toThrow(
      'MLKIT_NOT_ENABLED: This iOS build does not include Google ML Kit OCR.',
    );
  });

  it('treats native availability errors as unavailable', () => {
    mockRequireOptionalNativeModule.mockReturnValue({
      isSupported: () => {
        throw new Error('Native bridge not ready');
      },
      recognizeText: jest.fn(),
    });
    loadAdapter();

    expect(adapter.isGoogleMlKitAvailable()).toBe(false);
  });

  it('recognizes the requested image when the native module is supported', async () => {
    const result = { text: 'Receipt', blocks: [] };
    const recognizeText = jest.fn().mockResolvedValue(result);
    mockRequireOptionalNativeModule.mockReturnValue({
      isSupported: () => true,
      recognizeText,
    });
    loadAdapter();

    expect(adapter.isGoogleMlKitAvailable()).toBe(true);
    await expect(adapter.recognizeWithGoogleMlKit('file:///receipt.jpg')).resolves.toBe(result);
    expect(recognizeText).toHaveBeenCalledWith('file:///receipt.jpg');
  });
});
