import { rectifyReceiptImage } from './receipt-image-rectifier';

const mockDetectReceiptSection = jest.fn();
const mockNeedsCorrection = jest.fn();
const mockLoadImage = jest.fn();
const mockLoadFromRawPixels = jest.fn();
const mockTensor = jest.fn();
const mockRectifyQuad = jest.fn();

jest.mock('./receipt-edges', () => ({
  detectReceiptSection: (...args: unknown[]) => mockDetectReceiptSection(...args),
  needsReceiptPerspectiveCorrection: (...args: unknown[]) => mockNeedsCorrection(...args),
}));

jest.mock('react-native-nitro-image', () => ({
  Images: { loadFromRawPixelDataAsync: (...args: unknown[]) => mockLoadFromRawPixels(...args) },
  loadImage: (...args: unknown[]) => mockLoadImage(...args),
}));

jest.mock('react-native-executorch', () => ({
  cv: { rectifyQuad: (...args: unknown[]) => mockRectifyQuad(...args) },
  tensor: (...args: unknown[]) => mockTensor(...args),
}));

const quad = [
  { x: 20, y: 30 },
  { x: 230, y: 40 },
  { x: 220, y: 480 },
  { x: 10, y: 470 },
] as const;

type MockImage = {
  width: number;
  height: number;
  resizeAsync: jest.Mock<Promise<MockImage>, [number, number]>;
  cropAsync: jest.Mock<Promise<MockImage>, []>;
  toRawPixelDataAsync: jest.Mock<
    Promise<{ buffer: ArrayBuffer; width: number; height: number; pixelFormat: 'rgba' }>,
    []
  >;
  saveToTemporaryFileAsync: jest.Mock<Promise<string>, []>;
};

function image(width: number, height: number): MockImage {
  return {
    width,
    height,
    resizeAsync: jest.fn(async (nextWidth: number, nextHeight: number) =>
      image(nextWidth, nextHeight),
    ),
    cropAsync: jest.fn(async () => image(1_000, 2_300)),
    toRawPixelDataAsync: jest.fn(async () => ({
      buffer: new ArrayBuffer(width * height * 4),
      width,
      height,
      pixelFormat: 'rgba' as const,
    })),
    saveToTemporaryFileAsync: jest.fn(async () => '/cache/rectified.png'),
  };
}

describe('rectifyReceiptImage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    const preview = image(250, 500);
    const source = image(1_200, 2_400);
    source.resizeAsync.mockResolvedValue(preview);
    mockLoadImage.mockResolvedValue(source);
    mockDetectReceiptSection.mockReturnValue({ topEdge: 'observed', quad });
    mockNeedsCorrection.mockReturnValue(true);
    mockTensor.mockImplementation((_dtype, _shape, data) => ({
      dispose: jest.fn(),
      getData: (destination: Uint8Array) => destination,
      inputData: data,
    }));
    mockLoadFromRawPixels.mockResolvedValue(image(210, 440));
  });

  it('ignores non-local URIs and does not load native image modules', async () => {
    await expect(rectifyReceiptImage('https://example.test/receipt.jpg')).resolves.toBeNull();
    expect(mockLoadImage).not.toHaveBeenCalled();
  });

  it('leaves an image unchanged when no reliable top edge was found', async () => {
    mockDetectReceiptSection.mockReturnValue({ topEdge: 'inferred', quad });

    await expect(rectifyReceiptImage('file:///receipt.jpg')).resolves.toBeNull();
    expect(mockNeedsCorrection).not.toHaveBeenCalled();
  });

  it('does not rectify a sufficiently straight receipt', async () => {
    mockNeedsCorrection.mockReturnValue(false);

    await expect(rectifyReceiptImage('file:///receipt.jpg')).resolves.toBeNull();
    expect(mockNeedsCorrection).toHaveBeenCalledWith(quad, 250, 500);
  });

  it('maps preview corners into the source crop before returning a local PNG', async () => {
    await expect(rectifyReceiptImage('file:///receipt.jpg')).resolves.toBe(
      'file:///cache/rectified.png',
    );

    expect(mockLoadImage).toHaveBeenCalledWith({ filePath: '/receipt.jpg' });
    expect(mockTensor).toHaveBeenCalledTimes(2);
    expect(mockRectifyQuad).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      [
        { x: 56, y: 8 },
        { x: 1_064, y: 56 },
        { x: 1_016, y: 2_168 },
        { x: 8, y: 2_120 },
      ],
      { contentWidth: 1_009, padValue: 255 },
    );
    expect(mockLoadFromRawPixels).toHaveBeenCalledWith(
      expect.objectContaining({ width: 1_009, height: 2_113, pixelFormat: 'rgba' }),
    );
  });

  it('rejects a crop that cannot contain a useful receipt region', async () => {
    mockDetectReceiptSection.mockReturnValue({
      topEdge: 'observed',
      quad: [
        { x: 20, y: 30 },
        { x: 35, y: 30 },
        { x: 35, y: 480 },
        { x: 20, y: 480 },
      ],
    });

    await expect(rectifyReceiptImage('file:///receipt.jpg')).resolves.toBeNull();
    expect(mockTensor).not.toHaveBeenCalled();
  });
});
