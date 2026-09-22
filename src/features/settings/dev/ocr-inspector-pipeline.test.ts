import {
  parseInspectorCustomWords,
  prepareInspectorImage,
  recognizeReceiptOcrForInspector,
} from './ocr-inspector-pipeline';

const mockRecognizeText = jest.fn();
const mockLoadImage = jest.fn();
const mockLoadNativeImage = jest.fn();
const mockLoadFromRawPixelData = jest.fn();

jest.mock('expo-ai-kit', () => ({
  recognizeText: (...args: unknown[]) => mockRecognizeText(...args),
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
});
