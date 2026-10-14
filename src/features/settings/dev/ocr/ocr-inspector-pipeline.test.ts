import {
  parseInspectorCustomWords,
  prepareInspectorImage,
  recognizeReceiptOcrForInspector,
} from './ocr-inspector-pipeline';

const mockRecognizeText = jest.fn();
const mockRecognizeWithGoogleMlKit = jest.fn();
const mockLoadImage = jest.fn();
const mockLoadNativeImage = jest.fn();
const mockLoadFromRawPixelData = jest.fn();

jest.mock('expo-ai-kit', () => ({
  recognizeText: (...args: unknown[]) => mockRecognizeText(...args),
}));

jest.mock('@/features/ocr/processing/mlkit', () => ({
  recognizeWithGoogleMlKit: (...args: unknown[]) => mockRecognizeWithGoogleMlKit(...args),
}));

jest.mock('expo-image', () => ({
  Image: {
    loadAsync: (...args: unknown[]) => mockLoadImage(...args),
  },
}));

jest.mock('react-native-nitro-image', () => ({
  Images: {
    loadFromRawPixelDataAsync: (...args: unknown[]) => mockLoadFromRawPixelData(...args),
  },
  loadImage: (...args: unknown[]) => mockLoadNativeImage(...args),
}));

describe('ocr-inspector-pipeline', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('parses custom words from comma, semicolon and newline separated input', () => {
    expect(parseInspectorCustomWords(' EDEKA, Milch\nEDEKA; 1,99 ')).toEqual([
      'EDEKA',
      'Milch',
      '1',
      '99',
    ]);
  });

  it('passes inspector-only native OCR options through and preserves provider confidence', async () => {
    mockLoadImage.mockResolvedValue({ width: 1_000, height: 2_000, scale: 1 });
    mockRecognizeText.mockResolvedValue({
      blocks: [
        {
          lines: [
            {
              text: 'EDEKA',
              confidence: 0.77,
              bounds: { x: 0.1, y: 0.2, width: 0.3, height: 0.04 },
            },
          ],
        },
      ],
    });

    await expect(
      recognizeReceiptOcrForInspector('file:///tmp/receipt.jpg', {
        iosProvider: 'apple-vision',
        languages: ['de-DE'],
        recognitionLevel: 'fast',
        usesLanguageCorrection: false,
        customWords: ['EDEKA'],
      }),
    ).resolves.toMatchObject({
      imageSize: { width: 1_000, height: 2_000 },
      lines: [
        {
          text: 'EDEKA',
          confidence: 0.77,
          boundingBox: { x: 0.1, y: 0.2, width: 0.3, height: 0.04 },
        },
      ],
    });

    expect(mockRecognizeText).toHaveBeenCalledWith(
      { uri: 'file:///tmp/receipt.jpg' },
      {
        languages: ['de-DE'],
        recognitionLevel: 'fast',
        usesLanguageCorrection: false,
        customWords: ['EDEKA'],
      },
    );
  });

  it('uses the iOS ML Kit module without inventing confidence', async () => {
    mockLoadImage.mockResolvedValue({ width: 1_000, height: 2_000, scale: 1 });
    mockRecognizeWithGoogleMlKit.mockResolvedValue({
      blocks: [
        {
          lines: [
            {
              text: 'EDEKA',
              boundingBox: { x: 100, y: 400, width: 300, height: 80 },
            },
          ],
        },
      ],
    });

    await expect(
      recognizeReceiptOcrForInspector('file:///tmp/receipt.jpg', {
        iosProvider: 'google-mlkit',
        languages: ['de-DE'],
        recognitionLevel: 'accurate',
        usesLanguageCorrection: true,
        customWords: [],
      }),
    ).resolves.toMatchObject({
      lines: [
        {
          text: 'EDEKA',
          confidence: null,
          boundingBox: { x: 0.1, y: 0.2, width: 0.3, height: 0.04 },
        },
      ],
    });
    expect(mockRecognizeWithGoogleMlKit).toHaveBeenCalledWith('file:///tmp/receipt.jpg');
    expect(mockRecognizeText).not.toHaveBeenCalled();
  });

  it('defaults a missing image scale and missing Vision confidence', async () => {
    mockLoadImage.mockResolvedValue({ width: 250, height: 1_000 });
    mockRecognizeText.mockResolvedValue({
      blocks: [
        {
          lines: [
            {
              text: 'Kasse',
              bounds: { x: 0, y: 0, width: 0.5, height: 0.1 },
            },
          ],
        },
      ],
    });

    await expect(
      recognizeReceiptOcrForInspector('receipt.jpg', {
        iosProvider: 'apple-vision',
        languages: [],
        recognitionLevel: 'accurate',
        usesLanguageCorrection: true,
        customWords: [],
      }),
    ).resolves.toMatchObject({
      imageSize: { width: 250, height: 1_000 },
      lines: [{ text: 'Kasse', confidence: null }],
    });
  });

  it('returns the source URI unchanged when no image preparation is selected', async () => {
    const result = await prepareInspectorImage(
      'file:///tmp/receipt.jpg',
      {
        resize: 'source',
        crop: 'none',
        colorMode: 'color',
        contrast: 'none',
        sharpen: 'off',
        quality: 'source',
        brightness: 'none',
        threshold: 'off',
      },
      { readBytes: jest.fn() },
    );

    expect(result).toEqual({
      localUri: 'file:///tmp/receipt.jpg',
      width: 0,
      height: 0,
      byteSize: 0,
      ownsFile: false,
    });
    expect(mockLoadNativeImage).not.toHaveBeenCalled();
  });

  it('uses the zero-cost fallback for tooling without a platform image processor', async () => {
    const fallback = jest.requireActual<typeof import('./ocr-inspector-pipeline')>(
      './ocr-inspector-pipeline.ts',
    );
    const readBytes = jest.fn();

    await expect(
      fallback.prepareInspectorImage(
        'file:///receipt.jpg',
        {
          resize: 'source',
          crop: 'none',
          colorMode: 'color',
          contrast: 'none',
          sharpen: 'off',
          quality: 'source',
          brightness: 'none',
          threshold: 'off',
        },
        { readBytes },
      ),
    ).resolves.toEqual({
      localUri: 'file:///receipt.jpg',
      width: 0,
      height: 0,
      byteSize: 0,
      ownsFile: false,
    });
    expect(readBytes).not.toHaveBeenCalled();
  });

  it('rejects web-only image settings instead of silently ignoring preprocessing', async () => {
    const webPipeline = jest.requireActual<typeof import('./ocr-inspector-pipeline.web')>(
      './ocr-inspector-pipeline.web.ts',
    );
    const settings = {
      resize: 'source',
      crop: 'none',
      colorMode: 'color',
      contrast: 'none',
      sharpen: 'off',
      quality: 'source',
      brightness: 'none',
      threshold: 'off',
    } as const;

    await expect(
      webPipeline.prepareInspectorImage('file:///receipt.jpg', settings, {
        readBytes: jest.fn(),
      }),
    ).resolves.toMatchObject({ localUri: 'file:///receipt.jpg', ownsFile: false });

    const changes = [
      { resize: '1600' },
      { crop: 'edges-2' },
      { colorMode: 'grayscale' },
      { contrast: 'low' },
      { sharpen: 'medium' },
      { quality: 'low' },
    ] as const;

    for (const change of changes) {
      await expect(
        webPipeline.prepareInspectorImage(
          'file:///receipt.jpg',
          { ...settings, ...change },
          {
            readBytes: jest.fn(),
          },
        ),
      ).rejects.toThrow('Die OCR-Bildvorverarbeitung ist im Web-Inspector nicht verfügbar.');
    }
  });

  it('creates a temporary filtered image variant without changing the source URI', async () => {
    const sourceImage = {
      width: 100,
      height: 200,
      cropAsync: jest.fn(),
      resizeAsync: jest.fn(),
    };
    const croppedImage = {
      width: 96,
      height: 192,
      toRawPixelDataAsync: jest.fn().mockResolvedValue({
        width: 96,
        height: 192,
        pixelFormat: 'RGBA',
        buffer: new ArrayBuffer(96 * 192 * 4),
      }),
    };
    const filteredImage = {
      width: 96,
      height: 192,
      saveToTemporaryFileAsync: jest.fn().mockResolvedValue('/cache/ocr-inspector.jpg'),
    };
    sourceImage.cropAsync.mockResolvedValue(croppedImage);
    mockLoadNativeImage.mockResolvedValue(sourceImage);
    mockLoadFromRawPixelData.mockResolvedValue(filteredImage);
    const readBytes = jest.fn().mockResolvedValue(new Uint8Array(42));

    const result = await prepareInspectorImage(
      'file:///tmp/receipt.jpg',
      {
        resize: 'source',
        crop: 'edges-2',
        colorMode: 'grayscale',
        contrast: 'low',
        sharpen: 'medium',
        quality: 'low',
        brightness: 'none',
        threshold: 'off',
      },
      { readBytes },
    );

    expect(sourceImage.cropAsync).toHaveBeenCalledWith(2, 4, 98, 196);
    expect(mockLoadFromRawPixelData).toHaveBeenCalled();
    expect(filteredImage.saveToTemporaryFileAsync).toHaveBeenCalledWith('jpg', 55);
    expect(readBytes).toHaveBeenCalledWith('file:///cache/ocr-inspector.jpg');
    expect(result).toEqual({
      localUri: 'file:///cache/ocr-inspector.jpg',
      width: 96,
      height: 192,
      byteSize: 42,
      ownsFile: true,
    });
  });

  it.each(['RGBA', 'BGRA', 'ARGB', 'ABGR', 'RGB', 'BGR', 'XRGB', 'BGRX', 'XBGR', 'RGBX'])(
    'processes %s pixels while preserving the source image',
    async (pixelFormat) => {
      const bytes = pixelFormat.length === 3 ? [60, 80, 100] : [60, 80, 100, 255];
      const image = {
        width: 1,
        height: 1,
        toRawPixelDataAsync: jest.fn().mockResolvedValue({
          width: 1,
          height: 1,
          pixelFormat,
          buffer: new Uint8Array(bytes).buffer,
        }),
      };
      const output = {
        width: 1,
        height: 1,
        saveToTemporaryFileAsync: jest.fn().mockResolvedValue('/cache/filtered.jpg'),
      };
      mockLoadNativeImage.mockResolvedValue(image);
      mockLoadFromRawPixelData.mockResolvedValue(output);

      const result = await prepareInspectorImage(
        'receipt.jpg',
        {
          resize: 'source',
          crop: 'none',
          colorMode: 'grayscale',
          contrast: 'low',
          sharpen: 'off',
          quality: 'source',
          brightness: 'low',
          threshold: 'off',
        },
        { readBytes: jest.fn().mockResolvedValue(new Uint8Array(8)) },
      );

      expect(result).toMatchObject({ localUri: 'file:///cache/filtered.jpg', ownsFile: true });
      expect(mockLoadNativeImage).toHaveBeenCalledWith({ filePath: 'receipt.jpg' });
      expect(mockLoadFromRawPixelData).toHaveBeenCalledTimes(1);
    },
  );

  it('crops and resizes before saving, and treats file-size metadata as optional', async () => {
    const sourceImage = {
      width: 2_000,
      height: 1_000,
      cropAsync: jest.fn(),
    };
    const croppedImage = {
      width: 1_900,
      height: 950,
      resizeAsync: jest.fn(),
    };
    const resizedImage = {
      width: 1_600,
      height: 800,
      saveToTemporaryFileAsync: jest.fn().mockResolvedValue('file:///cache/resized.jpg'),
    };
    sourceImage.cropAsync.mockResolvedValue(croppedImage);
    croppedImage.resizeAsync.mockResolvedValue(resizedImage);
    mockLoadNativeImage.mockResolvedValue(sourceImage);
    mockLoadFromRawPixelData.mockResolvedValue(resizedImage);
    const readBytes = jest.fn().mockResolvedValue(new Uint8Array(12));

    const result = await prepareInspectorImage(
      'file:///receipt.jpg',
      {
        resize: '1600',
        crop: 'edges-5',
        colorMode: 'color',
        contrast: 'none',
        sharpen: 'off',
        quality: 'standard',
        brightness: 'none',
        threshold: 'off',
      },
      { readBytes },
    );

    expect(sourceImage.cropAsync).toHaveBeenCalledWith(100, 50, 1_900, 950);
    expect(croppedImage.resizeAsync).toHaveBeenCalledWith(1_600, 800);
    expect(resizedImage.saveToTemporaryFileAsync).toHaveBeenCalledWith('jpg', 82);
    expect(readBytes).toHaveBeenCalledWith('file:///cache/resized.jpg');
    expect(result).toEqual({
      localUri: 'file:///cache/resized.jpg',
      width: 1_600,
      height: 800,
      byteSize: 12,
      ownsFile: true,
    });
  });

  it('skips an already-sized resize and keeps processing when file metadata is unavailable', async () => {
    const image = {
      width: 1_600,
      height: 900,
      resizeAsync: jest.fn(),
      saveToTemporaryFileAsync: jest.fn().mockResolvedValue('/cache/exact-size.jpg'),
    };
    mockLoadNativeImage.mockResolvedValue(image);
    const readBytes = jest.fn().mockRejectedValue(new Error('metadata unavailable'));

    await expect(
      prepareInspectorImage(
        'receipt.jpg',
        {
          resize: '1600',
          crop: 'none',
          colorMode: 'color',
          contrast: 'none',
          sharpen: 'off',
          quality: 'source',
          brightness: 'none',
          threshold: 'off',
        },
        { readBytes },
      ),
    ).resolves.toEqual({
      localUri: 'file:///cache/exact-size.jpg',
      width: 1_600,
      height: 900,
      byteSize: 0,
      ownsFile: true,
    });
    expect(image.resizeAsync).not.toHaveBeenCalled();
    expect(image.saveToTemporaryFileAsync).toHaveBeenCalledWith('jpg', 100);
  });

  it('applies color, contrast, brightness, automatic threshold, and sharpening', async () => {
    const image = {
      width: 3,
      height: 3,
      toRawPixelDataAsync: jest.fn().mockResolvedValue({
        width: 3,
        height: 3,
        pixelFormat: 'RGBA',
        buffer: new Uint8Array(36).fill(200).buffer,
      }),
    };
    const output = {
      width: 3,
      height: 3,
      saveToTemporaryFileAsync: jest.fn().mockResolvedValue('/cache/processed.jpg'),
    };
    mockLoadNativeImage.mockResolvedValue(image);
    mockLoadFromRawPixelData.mockResolvedValue(output);

    await prepareInspectorImage(
      'file:///receipt.jpg',
      {
        resize: 'source',
        crop: 'none',
        colorMode: 'color',
        contrast: 'high',
        sharpen: 'medium',
        quality: 'max',
        brightness: 'high',
        threshold: 'auto',
      },
      { readBytes: jest.fn() },
    );

    expect(mockLoadFromRawPixelData).toHaveBeenCalledTimes(1);
    const processed = mockLoadFromRawPixelData.mock.calls[0]?.[0].buffer as ArrayBuffer;
    const outputPixels = new Uint8Array(processed);
    for (let pixel = 0; pixel < 9; pixel += 1) {
      expect([...outputPixels.slice(pixel * 4, pixel * 4 + 4)]).toEqual([255, 255, 255, 200]);
    }
    expect(output.saveToTemporaryFileAsync).toHaveBeenCalledWith('jpg', 100);
  });

  it.each([
    ['unsupported pixel format', 'RGBA?', new Uint8Array(4), /Nicht unterstütztes Pixel-Format/u],
    ['short pixel buffer', 'RGBA', new Uint8Array(3), /kürzer als die gemeldete Bildgröße/u],
  ] as const)(
    'rejects a %s rather than writing a partial image',
    async (_label, pixelFormat, pixels, error) => {
      mockLoadNativeImage.mockResolvedValue({
        width: 1,
        height: 1,
        toRawPixelDataAsync: jest.fn().mockResolvedValue({
          width: 1,
          height: 1,
          pixelFormat,
          buffer: pixels.buffer,
        }),
      });

      await expect(
        prepareInspectorImage(
          'receipt.jpg',
          {
            resize: 'source',
            crop: 'none',
            colorMode: 'grayscale',
            contrast: 'none',
            sharpen: 'off',
            quality: 'source',
            brightness: 'none',
            threshold: 'off',
          },
          { readBytes: jest.fn() },
        ),
      ).rejects.toThrow(error);
    },
  );
});
