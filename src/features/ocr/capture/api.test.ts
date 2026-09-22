import { captureReceipt, type ReceiptCaptureApiDependencies, uploadReceiptCapture } from './api';
import type { ReceiptCaptureFileAdapter, ReceiptImagePickerAdapter } from './capture/contracts';
import { createReceiptCapturePersistence } from './persistence/receipt-capture-persistence';

const CREATED_AT = '2026-09-21T10:00:00.000Z';

function imagePicker(): ReceiptImagePickerAdapter {
  return {
    getPendingResultAsync: async () => null,
    requestCameraPermissionsAsync: async () => ({ granted: true }),
    requestMediaLibraryPermissionsAsync: async () => ({ granted: true }),
    launchCameraAsync: async () => ({
      canceled: false,
      assets: [{ uri: 'file:///camera.jpg', mimeType: 'image/jpeg', fileSize: 3 }],
    }),
    launchImageLibraryAsync: async () => ({ canceled: true, assets: null }),
  };
}

function fileSystem(): ReceiptCaptureFileAdapter {
  return {
    normalizeToPersistentStorage: async ({ localAssetId }) => ({
      localUri: `file:///documents/receipt-captures/capture-api/${localAssetId}.jpg`,
      mimeType: 'image/jpeg',
      byteSize: 3,
      width: 2_400,
      height: 1_800,
    }),
    readBytes: async () => new Uint8Array([1, 2, 3]),
    deleteLocalFile: async () => undefined,
    cleanupSourceUri: async () => undefined,
  };
}

function dependencies(): ReceiptCaptureApiDependencies {
  return {
    imagePicker: imagePicker(),
    fileSystem: fileSystem(),
    assetUploader: {
      upload: async ({ assetId, storagePath }) => ({ assetId, storagePath }),
    },
    now: () => new Date(CREATED_AT),
  };
}

describe('receipt-capture API', () => {
  it('captures through injected adapters without loading native modules', async () => {
    const result = await captureReceipt(
      { captureId: 'capture-api', source: 'camera', createdAt: CREATED_AT },
      dependencies(),
    );

    expect(result.kind).toBe('captured');
  });

  it('uploads a captured draft through the injected upload adapter', async () => {
    const captured = await captureReceipt(
      { captureId: 'capture-api', source: 'camera', createdAt: CREATED_AT },
      dependencies(),
    );
    if (captured.kind !== 'captured') throw new Error('Expected capture to succeed.');

    const result = await uploadReceiptCapture(
      {
        draft: captured.draft,
        householdId: 'household-1',
        receiptId: 'receipt-1',
        createdBy: 'user-1',
      },
      dependencies(),
    );

    expect(result.draft.status).toBe('uploaded');
    expect(result.draft.uploadedAssets).toHaveLength(1);
  });

  it('persists captured and uploaded drafts through the supplied account persistence', async () => {
    const values = new Map<string, string>();
    const persistence = createReceiptCapturePersistence('user-1', {
      storage: {
        getString: (key) => values.get(key),
        set: (key, value) => values.set(key, value),
        remove: (key) => values.delete(key),
      },
    });

    const captured = await captureReceipt(
      { captureId: 'capture-persisted', source: 'camera', createdAt: CREATED_AT },
      { ...dependencies(), persistence },
    );
    if (captured.kind !== 'captured') throw new Error('Expected capture to succeed.');

    await uploadReceiptCapture(
      {
        draft: captured.draft,
        householdId: 'household-1',
        receiptId: 'receipt-1',
        createdBy: 'user-1',
      },
      { ...dependencies(), persistence },
    );

    await expect(persistence.load()).resolves.toMatchObject({
      id: 'capture-persisted',
      status: 'uploaded',
    });
  });

  it('appends another camera capture to the persisted draft without repeating a page id', async () => {
    const metadata = new Map<string, string>();
    const persistence = createReceiptCapturePersistence('user-1', {
      storage: {
        getString: (key) => metadata.get(key),
        set: (key, value) => metadata.set(key, value),
        remove: (key) => metadata.delete(key),
      },
    });

    const first = await captureReceipt(
      { captureId: 'capture-append', source: 'camera', createdAt: CREATED_AT },
      { ...dependencies(), persistence },
    );
    if (first.kind !== 'captured') throw new Error('Expected first capture to succeed.');

    const second = await captureReceipt(
      { captureId: 'capture-append', source: 'camera', appendToExisting: true },
      { ...dependencies(), persistence },
    );
    if (second.kind !== 'captured') throw new Error('Expected appended capture to succeed.');

    expect(second.draft.pages).toHaveLength(2);
    expect(new Set(second.draft.pages.map(({ id }) => id)).size).toBe(2);
    expect((await persistence.load())?.pages.map(({ id }) => id)).toEqual(
      second.draft.pages.map(({ id }) => id),
    );
  });

  it('persists an upload failure so the next worker can retry it offline', async () => {
    const values = new Map<string, string>();
    const persistence = createReceiptCapturePersistence('user-1', {
      storage: {
        getString: (key) => values.get(key),
        set: (key, value) => values.set(key, value),
        remove: (key) => values.delete(key),
      },
    });
    const captured = await captureReceipt(
      { captureId: 'capture-upload-failure', source: 'camera', createdAt: CREATED_AT },
      { ...dependencies(), persistence },
    );
    if (captured.kind !== 'captured') throw new Error('Expected capture to succeed.');

    await uploadReceiptCapture(
      {
        draft: captured.draft,
        householdId: 'household-1',
        receiptId: 'receipt-1',
        createdBy: 'user-1',
      },
      {
        ...dependencies(),
        persistence,
        assetUploader: { upload: async () => Promise.reject(new Error('offline')) },
      },
    );

    await expect(persistence.load()).resolves.toMatchObject({
      status: 'failed',
      phase: 'normalized',
      failure: { code: 'upload_failed' },
    });
  });
});
