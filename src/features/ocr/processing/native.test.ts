const mockGetVisionAvailability = jest.fn();
const mockPrepareVision = jest.fn();
const mockRecognizeText = jest.fn();
const mockLoadImage = jest.fn();

jest.mock('expo-ai-kit', () => ({
  getVisionAvailability: (...args: unknown[]) => mockGetVisionAvailability(...args),
  prepareVision: (...args: unknown[]) => mockPrepareVision(...args),
  recognizeText: (...args: unknown[]) => mockRecognizeText(...args),
}));

jest.mock('expo-image', () => ({
  Image: {
    loadAsync: (...args: unknown[]) => mockLoadImage(...args),
  },
}));

import {
  getReceiptOcrAvailability,
  normalizeReceiptOcrResult,
  prepareReceiptOcr,
  recognizeReceiptOcr,
} from './native';

describe('receipt OCR native adapter', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('keeps missing provider confidence unknown', () => {
    const result = normalizeReceiptOcrResult({
      imageSize: { width: 1600, height: 1200 },
      lines: [
        {
          text: 'EDEKA',
          boundingBox: { x: 0.1, y: 0.2, width: 0.3, height: 0.04 },
        },
      ],
    });

    expect(result.lines[0]).toEqual({
      text: 'EDEKA',
      confidence: null,
      boundingBox: { x: 0.1, y: 0.2, width: 0.3, height: 0.04 },
    });
  });

  it('preserves pixel-space boxes from an older native client instead of collapsing them', () => {
    const result = normalizeReceiptOcrResult({
      imageSize: { width: 1600, height: 1200 },
      lines: [
        {
          text: 'EINKAUFSTASCHE',
          confidence: 0.9,
          boundingBox: { x: 160, y: 240, width: 480, height: 48 },
        },
        {
          text: 'MORE CHUNKY FLAVOI',
          confidence: 0.9,
          boundingBox: { x: 160, y: 320, width: 480, height: 48 },
        },
      ],
    });

    expect(result.lines.map(({ boundingBox }) => boundingBox)).toEqual([
      { x: 0.1, y: 0.2, width: 0.3, height: 0.04 },
      { x: 0.1, y: 0.266667, width: 0.3, height: 0.04 },
    ]);
  });

  it.each([
    { status: 'available' },
    { status: 'downloadable' },
    { status: 'downloading' },
    { status: 'unavailable', reason: 'device' },
  ])('preserves the provider readiness status: %p', async (status) => {
    mockGetVisionAvailability.mockResolvedValue({ textRecognition: status });

    await expect(getReceiptOcrAvailability()).resolves.toEqual(status);
  });

  it('prepares only the text-recognition model and confirms readiness afterwards', async () => {
    const onProgress = jest.fn();
    mockGetVisionAvailability
      .mockResolvedValueOnce({ textRecognition: { status: 'downloadable' } })
      .mockResolvedValueOnce({ textRecognition: { status: 'available' } });
    mockPrepareVision.mockResolvedValue(undefined);

    await expect(prepareReceiptOcr({ languages: ['de-DE'], onProgress })).resolves.toEqual({
      status: 'available',
    });

    expect(mockPrepareVision).toHaveBeenCalledWith({
      features: ['text-recognition'],
      languages: ['de-DE'],
      onProgress,
    });
  });

  it('keeps a failed model download retryable and typed', async () => {
    mockGetVisionAvailability.mockResolvedValue({
      textRecognition: { status: 'downloadable' },
    });
    mockPrepareVision.mockRejectedValue({
      code: 'DOWNLOAD_FAILED',
      message: 'network unavailable',
    });

    await expect(prepareReceiptOcr()).rejects.toMatchObject({
      code: 'DOWNLOAD_FAILED',
      retryable: true,
    });
  });

  it('does not fabricate dimensions when the local image cannot be decoded', async () => {
    mockGetVisionAvailability.mockResolvedValue({
      textRecognition: { status: 'available' },
    });
    mockLoadImage.mockRejectedValue(new Error('decode failed'));

    await expect(recognizeReceiptOcr('file:///tmp/receipt.jpg')).rejects.toMatchObject({
      code: 'IMAGE_DECODE_FAILED',
      retryable: false,
    });
    expect(mockRecognizeText).not.toHaveBeenCalled();
  });

  // This is an adapter-contract test only; it is not native runtime evidence.
  it('maps the provider response without inventing confidence or image dimensions', async () => {
    mockGetVisionAvailability.mockResolvedValue({
      textRecognition: { status: 'available' },
    });
    mockLoadImage.mockResolvedValue({ width: 1600, height: 1200, scale: 1 });
    mockRecognizeText.mockResolvedValue({
      text: 'EDEKA',
      blocks: [
        {
          text: 'EDEKA',
          bounds: { x: 0.1, y: 0.2, width: 0.3, height: 0.04 },
          lines: [
            {
              text: 'EDEKA',
              bounds: { x: 0.1, y: 0.2, width: 0.3, height: 0.04 },
            },
          ],
        },
      ],
    });

    await expect(
      recognizeReceiptOcr('file:///tmp/receipt.jpg', { languages: ['de-DE'] }),
    ).resolves.toEqual({
      imageSize: { width: 1600, height: 1200 },
      lines: [
        {
          text: 'EDEKA',
          confidence: null,
          boundingBox: { x: 0.1, y: 0.2, width: 0.3, height: 0.04 },
        },
      ],
    });

    expect(mockPrepareVision).not.toHaveBeenCalled();
    expect(mockLoadImage).toHaveBeenCalledWith({ uri: 'file:///tmp/receipt.jpg' });
    expect(mockRecognizeText).toHaveBeenCalledWith(
      { uri: 'file:///tmp/receipt.jpg' },
      expect.objectContaining({
        languages: ['de-DE'],
        recognitionLevel: 'accurate',
        usesLanguageCorrection: true,
      }),
    );
  });
});
