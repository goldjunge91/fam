import { Platform } from 'react-native';
import type { ReceiptOcrLine, ReceiptOcrResult } from './native';
import { recognizeReceiptPageSections } from './receipt-page-sections';

const mockRecognizeReceiptOcr = jest.fn();
const mockLoadImage = jest.fn();
const mockFileDelete = jest.fn();

jest.mock('./native', () => {
  class MockReceiptOcrError extends Error {
    code: string;

    constructor(code: string) {
      super(code);
      this.code = code;
    }
  }
  return {
    ReceiptOcrError: MockReceiptOcrError,
    recognizeReceiptOcr: (...args: unknown[]) => mockRecognizeReceiptOcr(...args),
    validateReceiptOcrUri: (uri: string) => uri,
  };
});

jest.mock('react-native-nitro-image', () => ({
  Images: { loadFromRawPixelDataAsync: jest.fn() },
  loadImage: (...args: unknown[]) => mockLoadImage(...args),
}));

jest.mock('expo-file-system', () => ({
  File: jest.fn(() => ({ info: () => ({ exists: true }), delete: mockFileDelete })),
}));

const originalPlatform = Platform.OS;

function line(text: string, y = 0.2): ReceiptOcrLine {
  return {
    text,
    confidence: 0.9,
    boundingBox: { x: 0.7, y, width: 0.2, height: 0.04 },
  };
}

function result(lines: ReceiptOcrLine[] = []): ReceiptOcrResult {
  return { imageSize: { width: 400, height: 900 }, lines };
}

function image() {
  return {
    width: 400,
    height: 900,
    cropAsync: jest.fn(async () => ({
      width: 400,
      height: 323,
      resizeAsync: jest.fn(async () => ({
        saveToTemporaryFileAsync: jest.fn(async () => '/cache/receipt-section.png'),
      })),
      saveToTemporaryFileAsync: jest.fn(async () => '/cache/receipt-section.png'),
      toRawPixelDataAsync: jest.fn(async () => ({
        buffer: new ArrayBuffer(400 * 323 * 4),
        width: 400,
        height: 323,
        pixelFormat: 'rgba',
      })),
    })),
  };
}

describe('receipt OCR section runtime', () => {
  beforeEach(() => {
    mockRecognizeReceiptOcr.mockReset();
    mockLoadImage.mockReset().mockResolvedValue(image());
    mockFileDelete.mockReset();
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'android' });
  });

  afterAll(() => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: originalPlatform });
  });

  it('combines whole-image OCR with lines recognized from all three sections', async () => {
    mockRecognizeReceiptOcr
      .mockResolvedValueOnce(result([line('Kassenzettel')]))
      .mockResolvedValueOnce(result([line('1,29', 0.2)]))
      .mockResolvedValueOnce(result([line('2,49', 0.5)]))
      .mockResolvedValueOnce(result([line('12,99', 0.5)]));

    const recognized = await recognizeReceiptPageSections('file:///receipt.jpg');

    expect(mockRecognizeReceiptOcr).toHaveBeenCalledTimes(4);
    expect(recognized.lines.map(({ text }) => text)).toEqual(
      expect.arrayContaining(['Kassenzettel', '1,29', '2,49', '12,99']),
    );
    expect(mockFileDelete).toHaveBeenCalledTimes(3);
  });

  it('uses section results when the whole-image recognizer finds no text', async () => {
    const noText = new (
      jest.requireMock('./native').ReceiptOcrError as new (
        code: string,
      ) => Error
    )('NO_TEXT');
    mockRecognizeReceiptOcr
      .mockRejectedValueOnce(noText)
      .mockResolvedValueOnce(result([line('Milch')]))
      .mockResolvedValueOnce(result())
      .mockResolvedValueOnce(result());

    const recognized = await recognizeReceiptPageSections('file:///receipt.jpg');

    expect(recognized.imageSize).toEqual({ width: 400, height: 900 });
    expect(recognized.lines.map(({ text }) => text)).toEqual(['Milch']);
    expect(mockFileDelete).toHaveBeenCalledTimes(3);
  });

  it('falls back to the whole-image result when loading a section image fails', async () => {
    const whole = result([line('Vollständiger Bon')]);
    mockRecognizeReceiptOcr.mockResolvedValueOnce(whole);
    mockLoadImage.mockRejectedValueOnce(new Error('Image module unavailable'));

    await expect(recognizeReceiptPageSections('file:///receipt.jpg')).resolves.toBe(whole);
    expect(mockRecognizeReceiptOcr).toHaveBeenCalledTimes(1);
  });

  it('retries whole-image OCR when loading fails before any whole-image result exists', async () => {
    const noText = new (
      jest.requireMock('./native').ReceiptOcrError as new (
        code: string,
      ) => Error
    )('NO_TEXT');
    const fallback = result([line('Wiederholt')]);
    mockRecognizeReceiptOcr.mockRejectedValueOnce(noText).mockResolvedValueOnce(fallback);
    mockLoadImage.mockRejectedValueOnce(new Error('Image module unavailable'));

    await expect(recognizeReceiptPageSections('file:///receipt.jpg')).resolves.toBe(fallback);
    expect(mockRecognizeReceiptOcr).toHaveBeenCalledTimes(2);
  });

  it('skips unusable short images and keeps the complete first pass', async () => {
    const whole = result([line('Bon')]);
    mockRecognizeReceiptOcr.mockResolvedValueOnce(whole);
    mockLoadImage.mockResolvedValueOnce({ width: 400, height: 2 });

    await expect(recognizeReceiptPageSections('file:///receipt.jpg')).resolves.toBe(whole);
    expect(mockRecognizeReceiptOcr).toHaveBeenCalledTimes(1);
  });
});
