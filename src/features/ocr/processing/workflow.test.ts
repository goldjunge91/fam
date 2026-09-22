import { createReceiptCaptureDraft } from '@/features/ocr/capture/domain/actions';
import type { ReceiptCaptureDraft } from '@/features/ocr/capture/domain/types';
import { REWE_RECEIPT_LINES } from './domain/fixtures/german-receipts';
import { parseGermanReceipt } from './domain/parser';
import {
  addReceiptReviewItem,
  applyReceiptReviewState,
  createReceiptReviewState,
  removeReceiptReviewItem,
  updateReceiptReviewItem,
} from './review/model';
import { finalizeReceiptReview, type ReceiptAuthorityWriter } from './workflow';

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
});
