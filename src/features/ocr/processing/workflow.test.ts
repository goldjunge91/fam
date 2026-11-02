import {
  createReceiptCaptureDraft,
  markReceiptCaptureUploaded,
} from '@/features/ocr/capture/domain/actions';
import type { ReceiptCaptureDraft } from '@/features/ocr/capture/domain/types';
import { REWE_RECEIPT_LINES } from './domain/fixtures/german-receipts';
import { parseGermanReceipt } from './domain/parser';
import * as receiptNative from './native';
import * as receiptSections from './receipt-page-sections';
import {
  addReceiptReviewItem,
  applyReceiptReviewState,
  createReceiptReviewState,
  removeReceiptReviewItem,
  updateReceiptReviewItem,
} from './review/model';
import {
  finalizeReceiptReview,
  processReceiptCapture,
  type ReceiptAuthorityWriter,
} from './workflow';

function capture(): ReceiptCaptureDraft {
  return createReceiptCaptureDraft({
    id: 'capture-1',
    source: 'camera',
    pages: [
      {
        id: 'page-1',
        localUri: 'file:///documents/receipt-captures/capture-1/page-1.jpg',
        mimeType: 'image/jpeg',
      },
    ],
    createdAt: '2026-09-21T10:00:00.000Z',
  });
}

function authority() {
  const calls: string[] = [];
  const createdReceipts: unknown[] = [];
  const createdItems: unknown[] = [];
  const writer: ReceiptAuthorityWriter = {
    createReceipt: async (input) => {
      calls.push('createReceipt');
      createdReceipts.push(input);
    },
    createReceiptItem: async (input) => {
      calls.push('createReceiptItem');
      createdItems.push(input);
    },
    confirmReceiptItem: async () => {
      calls.push('confirmReceiptItem');
    },
    confirmReceipt: async () => {
      calls.push('confirmReceipt');
    },
  };
  return { writer, calls, createdReceipts, createdItems };
}

describe('finalizeReceiptReview', () => {
  it('persists the exact reviewed values and keeps an asset failure retryable', async () => {
    const source = parseGermanReceipt(REWE_RECEIPT_LINES);
    let review = createReceiptReviewState(source, 'store-1');
    review = updateReceiptReviewItem(review, 0, {
      name: 'Bio Milch',
      quantity: '2',
      lineTotalCents: '2,78',
    });
    review = removeReceiptReviewItem(review, review.items[1]?.id ?? '');
    review = addReceiptReviewItem(review, {
      name: 'Brot',
      quantity: '1',
      lineTotalCents: '2,49',
    });
    const reviewed = applyReceiptReviewState(source, review);
    const testAuthority = authority();

    const result = await finalizeReceiptReview(
      {
        capture: capture(),
        draft: reviewed,
        householdId: 'household-1',
        createdBy: 'user-1',
        storeId: 'store-1',
        existingStoreIds: ['store-1'],
      },
      {
        authority: testAuthority.writer,
        uploadAssets: async ({ capture: localCapture }) => ({
          draft: {
            ...localCapture,
            status: 'failed',
            phase: 'saving',
            failure: {
              code: 'offline',
              message: 'Offline',
              phase: 'saving',
            },
          },
        }),
      },
    );

    expect(result.kind).toBe('saved_with_pending_assets');
    expect(result.receiptId).toBe('capture-1');
    expect(testAuthority.createdReceipts[0]).toMatchObject({
      storeId: 'store-1',
      purchaseDate: reviewed.purchaseDate.value,
      totalCents: reviewed.totalCents.value,
    });
    expect(testAuthority.createdItems).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'Bio Milch',
          quantity: 2,
          lineTotalCents: 278,
          position: 0,
        }),
        expect.objectContaining({ name: 'Brot', quantity: 1, lineTotalCents: 249, position: 2 }),
      ]),
    );
    expect(testAuthority.calls.at(-1)).toBe('confirmReceipt');
  });

  it('rejects confirmation without an explicit existing store before any authority write', async () => {
    const testAuthority = authority();

    await expect(
      finalizeReceiptReview(
        {
          capture: capture(),
          draft: parseGermanReceipt(REWE_RECEIPT_LINES),
          householdId: 'household-1',
          createdBy: 'user-1',
          existingStoreIds: ['store-1'],
        },
        { authority: testAuthority.writer },
      ),
    ).rejects.toThrow('store');

    expect(testAuthority.calls).toEqual([]);
  });

  it('keeps an uploader exception pending after the structured save', async () => {
    const testAuthority = authority();

    const result = await finalizeReceiptReview(
      {
        capture: capture(),
        draft: parseGermanReceipt(REWE_RECEIPT_LINES),
        householdId: 'household-1',
        createdBy: 'user-1',
        storeId: 'store-1',
        existingStoreIds: ['store-1'],
      },
      {
        authority: testAuthority.writer,
        uploadAssets: async () => {
          throw new Error('Network unavailable');
        },
      },
    );

    expect(result).toMatchObject({
      kind: 'saved_with_pending_assets',
      receiptId: 'capture-1',
      assets: { kind: 'failed', message: 'Network unavailable' },
    });
    expect(testAuthority.calls).toContain('confirmReceipt');
  });

  it('returns a durable pending upload without waiting for the asset uploader', async () => {
    const testAuthority = authority();
    const uploadAssets = jest.fn(async () => {
      throw new Error('The upload should be deferred until household sync completes.');
    });

    const result = await finalizeReceiptReview(
      {
        capture: capture(),
        draft: parseGermanReceipt(REWE_RECEIPT_LINES),
        householdId: 'household-1',
        createdBy: 'user-1',
        storeId: 'store-1',
        existingStoreIds: ['store-1'],
      },
      {
        authority: testAuthority.writer,
        uploadAssets,
        deferAssetUpload: true,
      },
    );

    expect(result).toMatchObject({
      kind: 'saved_with_pending_assets',
      receiptId: 'capture-1',
      assets: {
        kind: 'failed',
        draft: {
          status: 'failed',
          phase: 'saving',
          failure: { code: 'receipt_asset_pending_sync' },
        },
      },
    });
    expect(uploadAssets).not.toHaveBeenCalled();
    expect(testAuthority.calls).toContain('confirmReceipt');
  });

  it('uses the atomic review writer when available', async () => {
    const testAuthority = authority();
    const saveReceiptReview = jest.fn(async () => undefined);

    const result = await finalizeReceiptReview(
      {
        capture: capture(),
        draft: parseGermanReceipt(REWE_RECEIPT_LINES),
        householdId: 'household-1',
        createdBy: 'user-1',
        storeId: 'store-1',
        existingStoreIds: ['store-1'],
      },
      {
        authority: { ...testAuthority.writer, saveReceiptReview },
      },
    );

    expect(result).toMatchObject({ kind: 'saved', assets: { kind: 'skipped' } });
    expect(saveReceiptReview).toHaveBeenCalledWith(
      expect.objectContaining({ receipt: expect.objectContaining({ id: 'capture-1' }) }),
      undefined,
    );
    expect(testAuthority.calls).toEqual([]);
  });

  it('reports successful image upload and retains the uploaded capture draft', async () => {
    const uploadedDraft = markReceiptCaptureUploaded(capture(), {
      uploadedAssets: [{ localAssetId: 'page-1', assetId: 'asset-1' }],
      updatedAt: '2026-09-21T10:01:00.000Z',
    });

    const result = await finalizeReceiptReview(
      {
        capture: capture(),
        draft: parseGermanReceipt(REWE_RECEIPT_LINES),
        householdId: 'household-1',
        createdBy: 'user-1',
        storeId: 'store-1',
        existingStoreIds: ['store-1'],
      },
      {
        authority: authority().writer,
        uploadAssets: async () => ({ draft: uploadedDraft }),
      },
    );

    expect(result).toMatchObject({ kind: 'saved', assets: { kind: 'uploaded' } });
    if (result.kind !== 'saved') throw new Error('Expected review to save successfully.');
    expect(result.assets).toEqual({ kind: 'uploaded', draft: uploadedDraft });
  });

  it('keeps the authority error intact when its message must fall back to the error code', async () => {
    const testAuthority = authority();
    const saveReceiptReview = jest.fn(async () => {
      throw { code: 'AUTHORITY_OFFLINE', message: ' ' };
    });

    await expect(
      finalizeReceiptReview(
        {
          capture: capture(),
          draft: parseGermanReceipt(REWE_RECEIPT_LINES),
          householdId: 'household-1',
          createdBy: 'user-1',
          storeId: 'store-1',
          existingStoreIds: ['store-1'],
        },
        { authority: { ...testAuthority.writer, saveReceiptReview } },
      ),
    ).rejects.toMatchObject({ code: 'AUTHORITY_OFFLINE', message: ' ' });
  });

  it('maps uncommon and unsupported reviewed units before writing receipt items', async () => {
    const testAuthority = authority();
    const source = parseGermanReceipt(REWE_RECEIPT_LINES);
    const units = ['Portion', 'g', null, 'Karton'];
    const draft = {
      ...source,
      items: Array.from({ length: units.length }, (_, index) => {
        const item = source.items[index % source.items.length];
        if (!item) throw new Error('Receipt fixture must contain at least one item.');
        return { ...item, unit: units[index] ?? null, sourceLineIndex: -1 };
      }),
    };

    await finalizeReceiptReview(
      {
        capture: capture(),
        draft,
        householdId: 'household-1',
        createdBy: 'user-1',
        storeId: 'store-1',
        existingStoreIds: ['store-1'],
      },
      { authority: testAuthority.writer },
    );

    expect(
      testAuthority.createdItems.map((item) => (item as { unit: string | null }).unit),
    ).toEqual(['portion', 'g', null, null]);
    const itemIds = testAuthority.createdItems.map((item) => (item as { id: string }).id);
    expect(new Set(itemIds).size).toBe(itemIds.length);
  });
});

describe('processReceiptCapture', () => {
  it('skips Vision readiness and passes the selected ML Kit provider to page OCR', async () => {
    const getAvailability = jest.spyOn(receiptNative, 'getReceiptOcrAvailability');
    const recognizePage = jest
      .spyOn(receiptSections, 'recognizeReceiptPageSections')
      .mockResolvedValue({
        imageSize: { width: 100, height: 200 },
        lines: [
          {
            text: 'REWE',
            confidence: null,
            boundingBox: { x: 0.1, y: 0.1, width: 0.5, height: 0.04 },
          },
        ],
      });

    await expect(
      processReceiptCapture({ capture: capture(), provider: 'google-mlkit' }),
    ).resolves.toMatchObject({
      kind: 'success',
    });

    expect(getAvailability).not.toHaveBeenCalled();
    expect(recognizePage).toHaveBeenCalledWith(capture().pages[0]?.localUri, {
      provider: 'google-mlkit',
    });
    getAvailability.mockRestore();
    recognizePage.mockRestore();
  });

  it('returns a preparation failure with its original message and preparing progress', async () => {
    const getAvailability = jest
      .spyOn(receiptNative, 'getReceiptOcrAvailability')
      .mockRejectedValue(new Error('Vision service unavailable'));
    const onProgress = jest.fn();

    await expect(processReceiptCapture({ capture: capture(), onProgress })).resolves.toMatchObject({
      kind: 'failed',
      captureId: 'capture-1',
      failure: {
        code: 'RECEIPT_PROCESSING_FAILED',
        message: 'Vision service unavailable',
        pageIndex: 0,
      },
    });
    expect(onProgress).toHaveBeenCalledWith({ phase: 'preparing', progress: 0 });
    expect(onProgress).toHaveBeenCalledTimes(1);
    getAvailability.mockRestore();
  });

  it('stops on the first page OCR failure and preserves the native error code', async () => {
    const getAvailability = jest
      .spyOn(receiptNative, 'getReceiptOcrAvailability')
      .mockResolvedValue({ status: 'available' });
    const recognizePage = jest
      .spyOn(receiptSections, 'recognizeReceiptPageSections')
      .mockResolvedValueOnce({ imageSize: { width: 100, height: 200 }, lines: [] })
      .mockRejectedValueOnce({ code: 'IMAGE_DECODE_FAILED', message: ' ' });
    const onProgress = jest.fn();
    const twoPages = {
      ...capture(),
      pages: [
        ...capture().pages,
        {
          id: 'page-2',
          localUri: 'file:///documents/receipt-captures/capture-1/page-2.jpg',
          mimeType: 'image/jpeg',
          byteSize: null,
        },
      ],
    };

    await expect(processReceiptCapture({ capture: twoPages, onProgress })).resolves.toMatchObject({
      kind: 'failed',
      failure: { code: 'IMAGE_DECODE_FAILED', message: 'IMAGE_DECODE_FAILED', pageIndex: 1 },
    });
    expect(recognizePage).toHaveBeenCalledTimes(2);
    expect(onProgress).toHaveBeenCalledWith({ phase: 'reading', pageIndex: 1, pageCount: 2 });
    getAvailability.mockRestore();
    recognizePage.mockRestore();
  });
});
