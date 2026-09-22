import {
  appendReceiptCapturePages,
  createReceiptCaptureDraft,
  markReceiptCaptureFailed,
  markReceiptCaptureUploaded,
  retryReceiptCapture,
  setReceiptCapturePhase,
} from './actions';
import type {
  ReceiptCaptureDraft,
  ReceiptCaptureLocalAssetInput,
  ReceiptCaptureUploadedAsset,
} from './types';

const CREATED_AT = '2026-09-21T10:00:00.000Z';
const UPDATED_AT = '2026-09-21T10:05:00.000Z';

function localAsset(
  id: string,
  localUri = `file:///receipts/${id}.jpg`,
): ReceiptCaptureLocalAssetInput {
  return {
    id,
    localUri,
    mimeType: 'image/jpeg',
    byteSize: 120_000,
  };
}

function cameraDraft(): ReceiptCaptureDraft {
  return createReceiptCaptureDraft({
    id: 'capture-1',
    source: 'camera',
    pages: [localAsset('page-1'), localAsset('page-2')],
    createdAt: CREATED_AT,
  });
}

describe('receipt-capture domain actions', () => {
  it('creates a local camera draft with ordered pages and pending status', () => {
    const draft = cameraDraft();

    expect(draft).toMatchObject({
      id: 'capture-1',
      source: 'camera',
      status: 'pending',
      createdAt: CREATED_AT,
      updatedAt: CREATED_AT,
      failure: null,
      uploadedAssets: [],
    });
    expect(draft.pages.map(({ id }) => id)).toEqual(['page-1', 'page-2']);
    expect(draft.pages[0]?.localUri).toBe('file:///receipts/page-1.jpg');
    expect(draft).not.toHaveProperty('ocrText');
    expect(draft).not.toHaveProperty('parsedReceipt');
  });

  it('keeps gallery as a distinct capture source', () => {
    const draft = createReceiptCaptureDraft({
      id: 'capture-gallery',
      source: 'gallery',
      pages: [localAsset('gallery-page')],
      createdAt: CREATED_AT,
    });

    expect(draft.source).toBe('gallery');
  });

  it('rejects a draft without at least one local page', () => {
    expect(() =>
      createReceiptCaptureDraft({
        id: 'empty-capture',
        source: 'camera',
        pages: [],
        createdAt: CREATED_AT,
      }),
    ).toThrow('at least one page');
  });

  it('appends pages without changing the existing order', () => {
    const draft = appendReceiptCapturePages(cameraDraft(), {
      pages: [localAsset('page-3')],
      updatedAt: UPDATED_AT,
    });

    expect(draft.pages.map(({ id }) => id)).toEqual(['page-1', 'page-2', 'page-3']);
    expect(draft.status).toBe('pending');
    expect(draft.updatedAt).toBe(UPDATED_AT);
  });

  it('marks every page uploaded and preserves the local draft metadata', () => {
    const uploadedAssets: readonly ReceiptCaptureUploadedAsset[] = [
      { localAssetId: 'page-1', assetId: 'asset-1' },
      { localAssetId: 'page-2', assetId: 'asset-2' },
    ];

    const uploaded = markReceiptCaptureUploaded(cameraDraft(), {
      uploadedAssets,
      updatedAt: UPDATED_AT,
    });

    expect(uploaded.status).toBe('uploaded');
    expect(uploaded.uploadedAssets).toEqual(uploadedAssets);
    expect(uploaded.pages).toHaveLength(2);
    expect(uploaded.failure).toBeNull();
  });

  it('retains all local pages when upload fails and retries without data loss', () => {
    const failed = markReceiptCaptureFailed(cameraDraft(), {
      failure: { code: 'network_unavailable', message: 'Network unavailable.' },
      updatedAt: UPDATED_AT,
    });

    expect(failed.status).toBe('failed');
    expect(failed.failure).toEqual({
      code: 'network_unavailable',
      message: 'Network unavailable.',
    });
    expect(failed.pages.map(({ id }) => id)).toEqual(['page-1', 'page-2']);

    const retried = retryReceiptCapture(failed, { updatedAt: CREATED_AT });
    expect(retried.status).toBe('pending');
    expect(retried.failure).toBeNull();
    expect(retried.pages.map(({ id }) => id)).toEqual(['page-1', 'page-2']);
  });

  it('makes processing phases explicit and preserves the failed phase on retry', () => {
    const processing = setReceiptCapturePhase(cameraDraft(), {
      phase: 'processing',
      updatedAt: UPDATED_AT,
    });
    const failed = markReceiptCaptureFailed(processing, {
      failure: { code: 'ocr_failed', message: 'OCR failed.', phase: 'processing' },
      updatedAt: UPDATED_AT,
    });

    expect(failed).toMatchObject({ status: 'failed', phase: 'processing' });
    expect(failed.failure).toMatchObject({ code: 'ocr_failed', phase: 'processing' });
    expect(retryReceiptCapture(failed, { updatedAt: CREATED_AT })).toMatchObject({
      status: 'pending',
      phase: 'processing',
      failure: null,
    });
  });

  it('rejects incomplete upload mappings and mutations after upload', () => {
    expect(() =>
      markReceiptCaptureUploaded(cameraDraft(), {
        uploadedAssets: [{ localAssetId: 'page-1', assetId: 'asset-1' }],
        updatedAt: UPDATED_AT,
      }),
    ).toThrow('one uploaded asset for each page');

    const uploaded = markReceiptCaptureUploaded(cameraDraft(), {
      uploadedAssets: [
        { localAssetId: 'page-1', assetId: 'asset-1' },
        { localAssetId: 'page-2', assetId: 'asset-2' },
      ],
      updatedAt: UPDATED_AT,
    });

    expect(() => retryReceiptCapture(uploaded, { updatedAt: CREATED_AT })).toThrow(
      'Only failed captures',
    );
  });
});
