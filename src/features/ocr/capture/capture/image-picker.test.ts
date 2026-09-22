import type {
  ReceiptCaptureFileAdapter,
  ReceiptImagePickerAdapter,
  ReceiptImagePickerOptions,
} from './contracts';
import { receiptCaptureAssetId } from './ids';
import { captureReceiptPages } from './image-picker';

const CREATED_AT = '2026-09-21T10:00:00.000Z';

function pickerAdapter(
  result: Awaited<ReturnType<ReceiptImagePickerAdapter['launchImageLibraryAsync']>>,
  pendingResult: Awaited<ReturnType<ReceiptImagePickerAdapter['getPendingResultAsync']>> = null,
): ReceiptImagePickerAdapter {
  return {
    getPendingResultAsync: async () => pendingResult,
    requestCameraPermissionsAsync: async () => ({ granted: true }),
    requestMediaLibraryPermissionsAsync: async () => ({ granted: true }),
    launchCameraAsync: async () => result,
    launchImageLibraryAsync: async () => result,
  };
}

function fileAdapter(sizes: readonly number[]): ReceiptCaptureFileAdapter {
  let copyCount = 0;
  return {
    normalizeToPersistentStorage: async ({ localAssetId }) => ({
      localUri: `file:///documents/receipts/${localAssetId}.jpg`,
      byteSize: sizes[copyCount++] ?? 120_000,
      mimeType: 'image/jpeg',
      width: 2_400,
      height: 1_800,
    }),
    readBytes: async () => new Uint8Array([1, 2, 3]),
    deleteLocalFile: async () => undefined,
    cleanupSourceUri: async () => undefined,
  };
}

describe('receipt image capture', () => {
  it('creates an ordered pending draft from multiple picker assets with stable local IDs', async () => {
    const result = await captureReceiptPages(
      {
        captureId: 'capture-1',
        source: 'gallery',
        createdAt: CREATED_AT,
      },
      {
        imagePicker: pickerAdapter({
          canceled: false,
          assets: [
            { uri: 'content://first', mimeType: 'image/jpeg', fileSize: 120_000 },
            { uri: 'content://second', mimeType: 'image/jpeg', fileSize: 130_000 },
          ],
        }),
        fileSystem: fileAdapter([120_000, 130_000]),
      },
    );

    expect(result.kind).toBe('captured');
    if (result.kind !== 'captured') throw new Error('Expected capture to succeed.');

    expect(result.draft).toMatchObject({
      id: 'capture-1',
      source: 'gallery',
      status: 'pending',
      failure: null,
      uploadedAssets: [],
    });
    expect(result.draft.pages.map(({ id }) => id)).toEqual([
      receiptCaptureAssetId('capture-1', 0),
      receiptCaptureAssetId('capture-1', 1),
    ]);
    expect(result.draft.pages.map(({ byteSize }) => byteSize)).toEqual([120_000, 130_000]);
  });

  it('requests lossless ordered picker assets with EXIF metadata and no base64 copy', async () => {
    const launchImageLibraryAsync = jest.fn(async (options: ReceiptImagePickerOptions) => {
      expect(options).toMatchObject({
        allowsEditing: false,
        allowsMultipleSelection: true,
        base64: false,
        exif: true,
        orderedSelection: true,
        quality: 1,
      });
      return {
        canceled: false as const,
        assets: [{ uri: 'content://receipt.heic', mimeType: 'image/heic' }],
      };
    });

    const result = await captureReceiptPages(
      { captureId: 'picker-options', source: 'gallery', createdAt: CREATED_AT },
      {
        imagePicker: {
          ...pickerAdapter({ canceled: true, assets: null }),
          launchImageLibraryAsync,
        },
        fileSystem: fileAdapter([100_000]),
      },
    );

    expect(result.kind).toBe('captured');
    expect(launchImageLibraryAsync).toHaveBeenCalledTimes(1);
  });

  it('uses an Android pending result before opening a new picker', async () => {
    const result = await captureReceiptPages(
      {
        captureId: 'recovered-capture',
        source: 'camera',
        createdAt: CREATED_AT,
      },
      {
        imagePicker: pickerAdapter(
          { canceled: false, assets: [{ uri: 'file:///new-photo.jpg', mimeType: 'image/jpeg' }] },
          {
            canceled: false,
            assets: [{ uri: 'file:///recovered-photo.jpg', mimeType: 'image/jpeg' }],
          },
        ),
        fileSystem: {
          normalizeToPersistentStorage: async ({ localAssetId }) => ({
            localUri: `file:///documents/${localAssetId}.jpg`,
            byteSize: 90_000,
            mimeType: 'image/jpeg',
            width: 2_400,
            height: 1_800,
          }),
          readBytes: async () => new Uint8Array([1]),
          deleteLocalFile: async () => undefined,
          cleanupSourceUri: async () => undefined,
        },
      },
    );

    expect(result.kind).toBe('captured');
    if (result.kind !== 'captured') throw new Error('Expected recovered capture to succeed.');
    expect(result.draft.pages[0]?.localUri).toContain('documents');
  });

  it('returns a safe cancellation result without creating a draft', async () => {
    const result = await captureReceiptPages(
      { captureId: 'cancelled', source: 'gallery', createdAt: CREATED_AT },
      {
        imagePicker: pickerAdapter({ canceled: true, assets: null }),
        fileSystem: fileAdapter([]),
      },
    );

    expect(result).toEqual({ kind: 'cancelled', source: 'gallery' });
  });

  it('returns a permission result without opening the picker', async () => {
    const result = await captureReceiptPages(
      { captureId: 'denied', source: 'camera', createdAt: CREATED_AT },
      {
        imagePicker: {
          ...pickerAdapter({ canceled: true, assets: null }),
          requestCameraPermissionsAsync: async () => ({ granted: false }),
        },
        fileSystem: fileAdapter([]),
      },
    );

    expect(result).toEqual({ kind: 'permission_denied', source: 'camera' });
  });

  it('accepts HEIC input and stores only a canonical JPEG page', async () => {
    const normalized = await captureReceiptPages(
      { captureId: 'heic', source: 'gallery', createdAt: CREATED_AT },
      {
        imagePicker: pickerAdapter({
          canceled: false,
          assets: [{ uri: 'file:///receipt.HEIC', mimeType: 'image/heic', fileSize: 100_000 }],
        }),
        fileSystem: fileAdapter([100_000]),
      },
    );

    expect(normalized).toMatchObject({ kind: 'captured' });
    if (normalized.kind !== 'captured') throw new Error('Expected HEIC capture to succeed.');
    expect(normalized.draft.pages[0]).toMatchObject({ mimeType: 'image/jpeg' });
  });

  it('rejects unsupported formats and normalized pages larger than the receipt limit', async () => {
    const unsupported = await captureReceiptPages(
      { captureId: 'unsupported', source: 'gallery', createdAt: CREATED_AT },
      {
        imagePicker: pickerAdapter({
          canceled: false,
          assets: [{ uri: 'file:///receipt.bmp', mimeType: 'image/bmp', fileSize: 100_000 }],
        }),
        fileSystem: fileAdapter([100_000]),
      },
    );
    const tooLarge = await captureReceiptPages(
      { captureId: 'too-large', source: 'gallery', createdAt: CREATED_AT },
      {
        imagePicker: pickerAdapter({
          canceled: false,
          assets: [{ uri: 'file:///receipt.jpg', mimeType: 'image/jpeg', fileSize: 5_242_881 }],
        }),
        fileSystem: fileAdapter([5_242_881]),
      },
    );

    expect(unsupported).toMatchObject({ kind: 'failed', failure: { code: 'unsupported_format' } });
    expect(tooLarge).toMatchObject({ kind: 'failed', failure: { code: 'asset_too_large' } });
  });

  it('cleans persistent pages and owned picker sources when a later page fails', async () => {
    const deleteLocalFile = jest.fn(async () => undefined);
    const cleanupSourceUri = jest.fn(async () => undefined);
    let normalizeCount = 0;
    const result = await captureReceiptPages(
      { captureId: 'cleanup', source: 'gallery', createdAt: CREATED_AT },
      {
        imagePicker: pickerAdapter({
          canceled: false,
          assets: [
            { uri: 'file:///cache/first.heic', mimeType: 'image/heic', fileSize: 100 },
            { uri: 'file:///cache/second.heic', mimeType: 'image/heic', fileSize: 100 },
          ],
        }),
        fileSystem: {
          normalizeToPersistentStorage: async ({ localAssetId }) => {
            normalizeCount += 1;
            return {
              localUri: `file:///documents/${localAssetId}.jpg`,
              mimeType: 'image/jpeg',
              byteSize: normalizeCount === 1 ? 100 : 6 * 1024 * 1024,
              width: 2_400,
              height: 1_800,
            };
          },
          readBytes: async () => new Uint8Array([1]),
          deleteLocalFile,
          cleanupSourceUri,
        },
      },
    );

    expect(result).toMatchObject({ kind: 'failed', failure: { code: 'asset_too_large' } });
    expect(deleteLocalFile).toHaveBeenCalledTimes(1);
    expect(cleanupSourceUri).toHaveBeenCalledTimes(2);
  });

  it('does not add OCR or parser data to a captured draft', async () => {
    const result = await captureReceiptPages(
      { captureId: 'image-only', source: 'camera', createdAt: CREATED_AT },
      {
        imagePicker: pickerAdapter({
          canceled: false,
          assets: [{ uri: 'file:///receipt.jpg', mimeType: 'image/jpeg', fileSize: 100_000 }],
        }),
        fileSystem: fileAdapter([100_000]),
      },
    );

    expect(result.kind).toBe('captured');
    if (result.kind !== 'captured') throw new Error('Expected capture to succeed.');
    expect(result.draft).not.toHaveProperty('ocrText');
    expect(result.draft).not.toHaveProperty('parsedReceipt');
  });
});
