import { detectInspectorReceiptGeometry } from './ocr-inspector-geometry.native';

const mockDetectReceiptSection = jest.fn();
const mockLoadImage = jest.fn();

jest.mock('@/features/ocr/capture/capture/receipt-edges', () => ({
  detectReceiptSection: (...args: unknown[]) => mockDetectReceiptSection(...args),
}));

jest.mock('react-native-nitro-image', () => ({
  loadImage: (...args: unknown[]) => mockLoadImage(...args),
}));

describe('fallback receipt geometry', () => {
  it('does not invent geometry when the active platform has no detector', async () => {
    const fallback = jest.requireActual<typeof import('./ocr-inspector-geometry')>(
      './ocr-inspector-geometry.ts',
    );

    await expect(
      fallback.detectInspectorReceiptGeometry('file:///receipt.jpg'),
    ).resolves.toBeNull();
  });
});

describe('native receipt geometry', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLoadImage.mockReset();
  });

  it('resizes large images and clamps detected points to the normalized preview', async () => {
    const rawPixels = new Uint8Array([1, 2, 3]);
    const preview = {
      width: 500,
      height: 250,
      toRawPixelDataAsync: jest.fn().mockResolvedValue(rawPixels),
    };
    const source = {
      width: 2_000,
      height: 1_000,
      resizeAsync: jest.fn().mockResolvedValue(preview),
    };
    mockLoadImage.mockResolvedValue(source);
    mockDetectReceiptSection.mockReturnValue({
      topEdge: 'observed',
      quad: [
        { x: -10, y: -2 },
        { x: 550, y: 25 },
        { x: 500, y: 300 },
        { x: 10, y: 280 },
      ],
    });

    await expect(detectInspectorReceiptGeometry('file:///receipt.jpg')).resolves.toEqual({
      method: 'side-fallback',
      topEdge: 'observed',
      quad: [
        { x: 0, y: 0 },
        { x: 1, y: 0.1 },
        { x: 1, y: 1 },
        { x: 0.02, y: 1 },
      ],
    });

    expect(source.resizeAsync).toHaveBeenCalledWith(500, 250);
    expect(preview.toRawPixelDataAsync).toHaveBeenCalledTimes(1);
    expect(mockDetectReceiptSection).toHaveBeenCalledWith(rawPixels);
  });

  it('keeps a small non-file URI unchanged and returns null when no receipt is found', async () => {
    const preview = {
      width: 400,
      height: 250,
      resizeAsync: jest.fn(),
      toRawPixelDataAsync: jest.fn().mockResolvedValue({ pixels: true }),
    };
    mockLoadImage.mockResolvedValue(preview);
    mockDetectReceiptSection.mockReturnValue(null);

    await expect(detectInspectorReceiptGeometry('content://receipt')).resolves.toBeNull();

    expect(mockLoadImage).toHaveBeenCalledWith({ filePath: 'content://receipt' });
    expect(preview.resizeAsync).not.toHaveBeenCalled();
  });

  it('returns null for a malformed quadrilateral or unavailable image processing', async () => {
    const preview = {
      width: 300,
      height: 300,
      toRawPixelDataAsync: jest.fn().mockResolvedValue({ pixels: true }),
    };
    mockLoadImage.mockResolvedValue(preview);
    mockDetectReceiptSection.mockReturnValue({ topEdge: 'estimated', quad: [{ x: 1, y: 1 }] });
    await expect(detectInspectorReceiptGeometry('file:///bad-quad.jpg')).resolves.toBeNull();

    mockLoadImage.mockRejectedValue(new Error('missing'));
    await expect(detectInspectorReceiptGeometry('file:///unavailable.jpg')).resolves.toBeNull();
  });
});
