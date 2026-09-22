import { createReceiptCaptureDraft } from '../domain/actions';
import type { ReceiptCaptureDraft } from '../domain/types';
import {
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
