import { Platform } from 'react-native';
import { createExpoFileSystemAdapter } from './native-adapters';

type MockFileRecord = { exists: boolean; size?: number; bytes?: Uint8Array };

const mockFiles = new Map<string, MockFileRecord>();
const mockMakeFile = jest.fn();
const mockMakeDirectory = jest.fn();
const mockManipulateAsync = jest.fn();
const mockRectifyReceiptImage = jest.fn();
const mockDebugLogEvent = jest.fn();

jest.mock('expo-file-system', () => ({
  Directory: jest.fn((...args: unknown[]) => mockMakeDirectory(...args)),
  File: jest.fn((...args: unknown[]) => mockMakeFile(...args)),
  Paths: {
    cache: { uri: 'file:///cache/' },
    document: { uri: 'file:///documents/' },
  },
}));

jest.mock('expo-image-manipulator', () => ({
  manipulateAsync: (...args: unknown[]) => mockManipulateAsync(...args),
}));
jest.mock('./receipt-image-rectifier', () => ({
  rectifyReceiptImage: (...args: unknown[]) => mockRectifyReceiptImage(...args),
}));
jest.mock('@/lib/observability/debug-log', () => ({
  debugLogEvent: (...args: unknown[]) => mockDebugLogEvent(...args),
}));

const originalPlatform = Platform.OS;

function fileRecord(uri: string) {
  return {
    uri,
    info: () => {
      const record = mockFiles.get(uri);
      return record ? { exists: record.exists, size: record.size } : { exists: false };
    },
    delete: () => {
      const record = mockFiles.get(uri);
      if (record) record.exists = false;
    },
    copy: async (destination: { uri: string }) => {
      const record = mockFiles.get(uri);
      mockFiles.set(destination.uri, { exists: true, size: record?.size ?? 0 });
    },
    bytes: async () => mockFiles.get(uri)?.bytes ?? new Uint8Array(),
  };
}

mockMakeFile.mockImplementation((location: string | { uri: string }, name?: string) => {
  const uri = typeof location === 'string' ? location : `${location.uri}${name ?? ''}`;
  return fileRecord(uri);
});
mockMakeDirectory.mockImplementation((root: { uri: string }, ...segments: string[]) => ({
  uri: `${root.uri}${segments.join('/')}/`,
  create: jest.fn(),
}));

function manipulation(uri: string, width: number, height: number, size: number) {
  mockFiles.set(uri, { exists: true, size });
  return { uri, width, height };
}

function useManipulationResults(results: ReturnType<typeof manipulation>[]) {
  mockManipulateAsync.mockImplementation(async () => results.shift());
}

describe('Expo FileSystem receipt adapter', () => {
  beforeEach(() => {
    mockFiles.clear();
    mockMakeFile.mockClear();
    mockMakeDirectory.mockClear();
    mockManipulateAsync.mockReset();
    mockRectifyReceiptImage.mockReset().mockResolvedValue(null);
    mockDebugLogEvent.mockReset();
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'android' });
  });

  afterAll(() => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: originalPlatform });
  });

  it('normalizes to an account-local JPEG and deletes temporary images', async () => {
    useManipulationResults([
      manipulation('file:///cache/oriented.jpg', 2_400, 1_800, 20_000),
      manipulation('file:///cache/normalized.jpg', 2_400, 1_800, 10_000),
    ]);
    const adapter = createExpoFileSystemAdapter();

    await expect(
      adapter.normalizeToPersistentStorage({
        sourceUri: 'content://picked/receipt',
        captureId: 'capture one',
        pageIndex: 0,
        localAssetId: 'page-1',
        mimeType: 'image/jpeg',
        maxBytes: 1_000_000,
        maxLongEdge: 4_032,
        jpegQuality: 0.85,
      }),
    ).resolves.toEqual({
      localUri: 'file:///documents/receipt-captures/capture%20one/page-1.jpg',
      mimeType: 'image/jpeg',
      byteSize: 10_000,
      width: 2_400,
      height: 1_800,
    });

    expect(mockManipulateAsync).toHaveBeenCalledTimes(2);
    expect(mockRectifyReceiptImage).toHaveBeenCalledWith('file:///cache/oriented.jpg');
    expect(mockFiles.get('file:///cache/normalized.jpg')?.exists).toBe(false);
    expect(mockFiles.get('file:///cache/oriented.jpg')?.exists).toBe(false);
  });

  it('retries with lower quality when the first normalized file is too large', async () => {
    useManipulationResults([
      manipulation('file:///cache/oriented.jpg', 2_400, 1_800, 20_000),
      manipulation('file:///cache/large.jpg', 2_400, 1_800, 2_000_000),
      manipulation('file:///cache/smaller.jpg', 2_200, 1_650, 800_000),
    ]);
    const adapter = createExpoFileSystemAdapter();

    await expect(
      adapter.normalizeToPersistentStorage({
        sourceUri: 'file:///picked.jpg',
        captureId: 'retry',
        pageIndex: 0,
        localAssetId: 'page-1',
        mimeType: 'image/jpeg',
        maxBytes: 1_000_000,
        maxLongEdge: 4_032,
        jpegQuality: 0.85,
      }),
    ).resolves.toMatchObject({ byteSize: 800_000, width: 2_200, height: 1_650 });

    expect(mockManipulateAsync).toHaveBeenCalledTimes(3);
    expect(mockFiles.get('file:///cache/large.jpg')?.exists).toBe(false);
  });

  it('fails immediately for invalid output dimensions and removes the destination', async () => {
    useManipulationResults([
      manipulation('file:///cache/oriented.jpg', 2_400, 1_800, 20_000),
      manipulation('file:///cache/invalid.jpg', 0, 1_800, 10_000),
    ]);
    const adapter = createExpoFileSystemAdapter();

    await expect(
      adapter.normalizeToPersistentStorage({
        sourceUri: 'file:///picked.jpg',
        captureId: 'invalid',
        pageIndex: 0,
        localAssetId: 'page-1',
        mimeType: 'image/jpeg',
        maxBytes: 1_000_000,
        maxLongEdge: 4_032,
        jpegQuality: 0.85,
      }),
    ).rejects.toMatchObject({ code: 'invalid_dimensions' });
    expect(mockManipulateAsync).toHaveBeenCalledTimes(2);
  });

  it('reports a local-file requirement when the manipulator returns a remote URI', async () => {
    useManipulationResults([
      manipulation('file:///cache/oriented.jpg', 2_400, 1_800, 20_000),
      manipulation('https://example.test/image.jpg', 2_400, 1_800, 10_000),
    ]);
    const adapter = createExpoFileSystemAdapter();

    await expect(
      adapter.normalizeToPersistentStorage({
        sourceUri: 'file:///picked.jpg',
        captureId: 'remote',
        pageIndex: 0,
        localAssetId: 'page-1',
        mimeType: 'image/jpeg',
        maxBytes: 1_000_000,
        maxLongEdge: 4_032,
        jpegQuality: 0.85,
      }),
    ).rejects.toMatchObject({ code: 'non_local_asset' });
  });

  it('reads bytes and only removes source files owned by the cache directory', async () => {
    mockFiles.set('file:///documents/page.jpg', {
      exists: true,
      size: 3,
      bytes: new Uint8Array([4, 5]),
    });
    mockFiles.set('file:///cache/picked.jpg', { exists: true, size: 3 });
    mockFiles.set('file:///external/picked.jpg', { exists: true, size: 3 });
    const adapter = createExpoFileSystemAdapter();

    await expect(adapter.readBytes('file:///documents/page.jpg')).resolves.toEqual(
      new Uint8Array([4, 5]),
    );
    await adapter.cleanupSourceUri('file:///external/picked.jpg');
    expect(mockFiles.get('file:///external/picked.jpg')?.exists).toBe(true);
    await adapter.cleanupSourceUri('file:///cache/picked.jpg');
    expect(mockFiles.get('file:///cache/picked.jpg')?.exists).toBe(false);
    await adapter.deleteLocalFile('file:///documents/page.jpg');
    expect(mockFiles.get('file:///documents/page.jpg')?.exists).toBe(false);
  });
});
