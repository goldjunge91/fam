import { createReceiptCaptureDraft } from '../domain/actions';
import type { ReceiptCaptureDraft } from '../domain/types';
import {
  isReceiptAssetUploadFailureCode,
  type ReceiptAssetUploadAdapter,
  type ReceiptCaptureFileAdapter,
  retryReceiptCaptureUpload,
  uploadReceiptCapture,
} from './upload-queue';

const CREATED_AT = '2026-09-21T10:00:00.000Z';
const UPDATED_AT = '2026-09-21T10:05:00.000Z';

function draft(mimeType = 'image/jpeg'): ReceiptCaptureDraft {
  return createReceiptCaptureDraft({
    id: 'capture-1',
    source: 'gallery',
    pages: [
      {
        id: '00000000-0000-5000-8000-000000000001',
        localUri: 'file:///documents/page-1.jpg',
        mimeType,
        byteSize: 3,
      },
      {
        id: '00000000-0000-5000-8000-000000000002',
        localUri: 'file:///documents/page-2.jpg',
        mimeType,
        byteSize: 3,
      },
    ],
    createdAt: CREATED_AT,
  });
}

function files(): ReceiptCaptureFileAdapter {
  return {
    normalizeToPersistentStorage: async () => ({
      localUri: 'file:///documents/unused.jpg',
      byteSize: 3,
      mimeType: 'image/jpeg',
      width: 2_400,
      height: 1_800,
    }),
    readBytes: async () => new Uint8Array([1, 2, 3]),
    deleteLocalFile: async () => undefined,
    cleanupSourceUri: async () => undefined,
  };
}

function uploader(upload: ReceiptAssetUploadAdapter['upload']): ReceiptAssetUploadAdapter {
  return { upload };
}

describe('receipt asset upload queue', () => {
  it.each([
    'upload_failed',
    'receipt_asset_storage_upload_failed',
    'receipt_asset_metadata_upsert_failed',
  ])('recognizes %s as an asset retry failure', (code) => {
    expect(isReceiptAssetUploadFailureCode(code)).toBe(true);
  });

  it('does not classify authority failures as asset retry failures', () => {
    expect(isReceiptAssetUploadFailureCode('authority_save_failed')).toBe(false);
  });

  it('uploads pages in page order and marks the whole draft uploaded', async () => {
    const result = await uploadReceiptCapture(
      {
        draft: draft(),
        householdId: 'household-1',
        receiptId: 'receipt-1',
        createdBy: 'user-1',
      },
      {
        fileSystem: files(),
        assetUploader: uploader(async ({ localAssetId }) => ({
          assetId: `server-${localAssetId.slice(-1)}`,
          storagePath: `household-1/receipt-1/${localAssetId}.jpg`,
        })),
        now: () => new Date(UPDATED_AT),
      },
    );

    expect(result.draft.status).toBe('uploaded');
    expect(result.draft.uploadedAssets).toEqual([
      { localAssetId: '00000000-0000-5000-8000-000000000001', assetId: 'server-1' },
      { localAssetId: '00000000-0000-5000-8000-000000000002', assetId: 'server-2' },
    ]);
    expect(result.draft.failure).toBeNull();
  });

  it('keeps all pages and returns a retryable failed capture when one page upload fails', async () => {
    let attempts = 0;
    const failed = await uploadReceiptCapture(
      {
        draft: draft(),
        householdId: 'household-1',
        receiptId: 'receipt-1',
        createdBy: 'user-1',
      },
      {
        fileSystem: files(),
        assetUploader: uploader(async ({ localAssetId }) => {
          attempts += 1;
          if (attempts === 2) throw new Error('offline');
          return { assetId: localAssetId, storagePath: `${localAssetId}.jpg` };
        }),
        now: () => new Date(UPDATED_AT),
      },
    );

    expect(failed.draft.status).toBe('failed');
    expect(failed.draft.failure).toEqual({ code: 'upload_failed', message: 'offline' });
    expect(failed.draft.pages.map(({ id }) => id)).toEqual([
      '00000000-0000-5000-8000-000000000001',
      '00000000-0000-5000-8000-000000000002',
    ]);

    const retried = await retryReceiptCaptureUpload(
      {
        draft: failed.draft,
        householdId: 'household-1',
        receiptId: 'receipt-1',
        createdBy: 'user-1',
      },
      {
        fileSystem: files(),
        assetUploader: uploader(async ({ localAssetId }) => ({
          assetId: localAssetId,
          storagePath: `${localAssetId}.jpg`,
        })),
        now: () => new Date(UPDATED_AT),
      },
    );

    expect(retried.draft.status).toBe('uploaded');
    expect(retried.draft.pages).toHaveLength(2);
  });

  it('keeps a transient storage failure retryable without retrying it in the upload queue', async () => {
    let attempts = 0;
    const result = await uploadReceiptCapture(
      {
        draft: draft(),
        householdId: 'household-1',
        receiptId: 'receipt-1',
        createdBy: 'user-1',
      },
      {
        fileSystem: files(),
        assetUploader: uploader(async () => {
          attempts += 1;
          throw Object.assign(new Error('Network request failed'), {
            code: 'receipt_asset_storage_upload_failed',
            providerCode: 'network_request_failed',
          });
        }),
        now: () => new Date(UPDATED_AT),
      },
    );

    expect(result.draft.status).toBe('failed');
    expect(result.draft.failure).toEqual({
      code: 'receipt_asset_storage_upload_failed',
      message: 'Network request failed',
    });
    expect(attempts).toBe(1);
  });

  it('does not read or upload the first capture until its sync finishes', async () => {
    const events: string[] = [];
    let finishSync: (() => void) | undefined;
    const sync = new Promise<void>((resolve) => {
      finishSync = resolve;
    });
    const pending = uploadReceiptCapture(
      { draft: draft(), householdId: 'household-1', receiptId: 'receipt-1', createdBy: 'user-1' },
      {
        fileSystem: {
          ...files(),
          readBytes: async (uri) => {
            events.push(`read:${uri}`);
            return new Uint8Array([1, 2, 3]);
          },
        },
        waitForParentSync: async () => {
          events.push('sync');
          await sync;
          events.push('synced');
        },
        assetUploader: uploader(async ({ localAssetId }) => {
          events.push(`upload:${localAssetId}`);
          return { assetId: localAssetId, storagePath: `${localAssetId}.jpg` };
        }),
      },
    );
    await Promise.resolve();
    expect(events).toEqual(['sync']);
    finishSync?.();
    expect((await pending).draft.status).toBe('uploaded');
    expect(events).toEqual([
      'sync',
      'synced',
      'read:file:///documents/page-1.jpg',
      'upload:00000000-0000-5000-8000-000000000001',
      'read:file:///documents/page-2.jpg',
      'upload:00000000-0000-5000-8000-000000000002',
    ]);
  });

  it('waits once before uploading any page, including on retry after a sync failure', async () => {
    const input = {
      draft: draft(),
      householdId: 'household-1',
      receiptId: 'receipt-1',
      createdBy: 'user-1',
    };
    const upload = jest.fn(
      async ({ localAssetId }: Parameters<ReceiptAssetUploadAdapter['upload']>[0]) => ({
        assetId: localAssetId,
        storagePath: `${localAssetId}.jpg`,
      }),
    );
    const failed = await uploadReceiptCapture(input, {
      fileSystem: files(),
      assetUploader: uploader(upload),
      waitForParentSync: async () => {
        throw new Error('offline');
      },
    });
    expect(upload).not.toHaveBeenCalled();
    expect(failed.draft.status).toBe('failed');
    expect(failed.draft.pages).toEqual(input.draft.pages);

    let finishSync: (() => void) | undefined;
    const sync = new Promise<void>((resolve) => {
      finishSync = resolve;
    });
    const waitForParentSync = jest.fn(() => sync);
    const pending = retryReceiptCaptureUpload(
      { ...input, draft: failed.draft },
      {
        fileSystem: files(),
        assetUploader: uploader(upload),
        waitForParentSync,
      },
    );
    await Promise.resolve();
    expect(waitForParentSync).toHaveBeenCalledWith({
      householdId: 'household-1',
      receiptId: 'receipt-1',
    });
    expect(upload).not.toHaveBeenCalled();
    finishSync?.();
    expect((await pending).draft.status).toBe('uploaded');
    expect(waitForParentSync).toHaveBeenCalledTimes(1);
    expect(upload).toHaveBeenCalledTimes(2);
  });

  it('does not retry a parent-pending upload when no parent sync waiter is provided', async () => {
    const upload = jest
      .fn<
        ReturnType<ReceiptAssetUploadAdapter['upload']>,
        Parameters<ReceiptAssetUploadAdapter['upload']>
      >()
      .mockRejectedValue(
        Object.assign(new Error('Receipt parent is not available on the server yet.'), {
          code: 'receipt_asset_storage_upload_failed',
          providerCode: 'receipt_asset_parent_pending',
        }),
      );

    const result = await uploadReceiptCapture(
      {
        draft: draft(),
        householdId: 'household-1',
        receiptId: 'receipt-1',
        createdBy: 'user-1',
      },
      {
        fileSystem: files(),
        assetUploader: uploader(upload),
        now: () => new Date(UPDATED_AT),
      },
    );

    expect(result.draft.status).toBe('failed');
    expect(upload).toHaveBeenCalledTimes(1);
  });

  it('leaves a pending draft untouched when it is not uploaded yet', () => {
    expect(draft().status).toBe('pending');
  });

  it('rejects a non-canonical local page before it can reach upload storage', async () => {
    const upload = jest.fn(async () => ({ assetId: 'server-1', storagePath: 'unused.jpg' }));

    const result = await uploadReceiptCapture(
      {
        draft: draft('image/png'),
        householdId: 'household-1',
        receiptId: 'receipt-1',
        createdBy: 'user-1',
      },
      {
        fileSystem: files(),
        assetUploader: uploader(upload),
        now: () => new Date(UPDATED_AT),
      },
    );

    expect(result.draft.failure).toEqual({
      code: 'non_canonical_image',
      message: 'Receipt uploads require the normalized JPEG working file.',
    });
    expect(upload).not.toHaveBeenCalled();
  });
});
