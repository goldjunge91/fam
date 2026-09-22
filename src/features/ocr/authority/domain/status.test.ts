import {
  canTransitionReceiptItemReviewStatus,
  canTransitionReceiptStatus,
  receiptItemReviewStatusAfterCorrection,
  receiptStatusAfterCorrection,
  restore,
  softDelete,
  transitionReceiptItemReviewStatus,
  transitionReceiptStatus,
} from './status';
import {
  assertEuroCents,
  type Receipt,
  type ReceiptAsset,
  type ReceiptAssetCreateInput,
  type ReceiptCreateInput,
  type ReceiptItem,
  type ReceiptItemCreateInput,
} from './types';

const RECEIPT: Receipt = {
  id: 'receipt-1',
  householdId: 'household-1',
  storeId: 'store-1',
  purchaseDate: '2026-09-21',
  currency: 'EUR',
  totalCents: assertEuroCents(1299),
  processingStatus: 'confirmed',
  createdBy: 'member-1',
  confirmedBy: 'member-2',
  confirmedAt: '2026-09-21T12:00:00.000Z',
  createdAt: '2026-09-21T11:00:00.000Z',
  updatedAt: '2026-09-21T12:00:00.000Z',
  deletedAt: null,
};

const ITEM: ReceiptItem = {
  id: 'item-1',
  receiptId: RECEIPT.id,
  householdId: RECEIPT.householdId,
  position: 0,
  name: 'Milch',
  productId: 'product-1',
  categoryId: 'category-dairy',
  quantity: 2,
  unit: 'l',
  packageSize: 1,
  packageSizeUnit: 'l',
  lineTotalCents: assertEuroCents(298),
  reviewStatus: 'confirmed',
  createdAt: '2026-09-21T11:00:00.000Z',
  updatedAt: '2026-09-21T12:00:00.000Z',
  deletedAt: null,
};

describe('receipt-authority domain contract', () => {
  it('models receipt, item and asset inputs without discount fields', () => {
    const receiptInput: ReceiptCreateInput = {
      id: RECEIPT.id,
      householdId: RECEIPT.householdId,
      currency: 'EUR',
      createdBy: RECEIPT.createdBy,
      totalCents: assertEuroCents(1299),
    };
    const itemInput: ReceiptItemCreateInput = {
      id: ITEM.id,
      receiptId: ITEM.receiptId,
      householdId: ITEM.householdId,
      position: ITEM.position,
      name: ITEM.name,
      productId: ITEM.productId,
      categoryId: ITEM.categoryId,
      quantity: ITEM.quantity,
      unit: ITEM.unit,
      packageSize: ITEM.packageSize,
      packageSizeUnit: ITEM.packageSizeUnit,
      lineTotalCents: ITEM.lineTotalCents,
      reviewStatus: 'needs_review',
    };
    const assetInput: ReceiptAssetCreateInput = {
      id: 'asset-1',
      receiptId: RECEIPT.id,
      householdId: RECEIPT.householdId,
      storagePath: 'household-1/receipt-1/asset-1.jpg',
      mimeType: 'image/jpeg',
      byteSize: 120_000,
      sortOrder: 0,
      createdBy: RECEIPT.createdBy,
    };

    expect(receiptInput).toMatchObject({ currency: 'EUR', totalCents: 1299 });
    expect(itemInput).toMatchObject({ lineTotalCents: 298, reviewStatus: 'needs_review' });
    expect(assetInput).toMatchObject({ receiptId: RECEIPT.id, sortOrder: 0 });
    expect(itemInput).not.toHaveProperty('discountCents');
  });

  describe('EUR cents', () => {
    it.each([0, 1, 1299, Number.MAX_SAFE_INTEGER])(
      'accepts non-negative safe integer %s',
      (value) => {
        expect(assertEuroCents(value)).toBe(value);
      },
    );

    it.each([-1, 0.5, Number.NaN, Number.POSITIVE_INFINITY, Number.MAX_SAFE_INTEGER + 1])(
      'rejects invalid cent value %s',
      (value) => {
        expect(() => assertEuroCents(value)).toThrow('EUR cents');
      },
    );
  });

  describe('receipt status lifecycle', () => {
    it.each([
      ['draft', 'processing'],
      ['draft', 'failed'],
      ['processing', 'needs_review'],
      ['processing', 'failed'],
      ['needs_review', 'confirmed'],
      ['needs_review', 'failed'],
      ['confirmed', 'needs_review'],
      ['confirmed', 'failed'],
      ['failed', 'draft'],
    ] as const)('allows %s -> %s', (from, to) => {
      expect(canTransitionReceiptStatus(from, to)).toBe(true);
      expect(transitionReceiptStatus(from, to)).toBe(to);
    });

    it.each([
      ['draft', 'confirmed'],
      ['processing', 'confirmed'],
      ['needs_review', 'draft'],
      ['confirmed', 'draft'],
      ['failed', 'processing'],
    ] as const)('rejects %s -> %s', (from, to) => {
      expect(canTransitionReceiptStatus(from, to)).toBe(false);
      expect(() => transitionReceiptStatus(from, to)).toThrow('Receipt status transition');
    });

    it('reopens a confirmed receipt after correction', () => {
      expect(receiptStatusAfterCorrection('confirmed')).toBe('needs_review');
      expect(receiptStatusAfterCorrection('draft')).toBe('draft');
    });
  });

  describe('receipt item review lifecycle', () => {
    it.each([
      ['needs_review', 'confirmed'],
      ['confirmed', 'needs_review'],
    ] as const)('allows %s -> %s', (from, to) => {
      expect(canTransitionReceiptItemReviewStatus(from, to)).toBe(true);
      expect(transitionReceiptItemReviewStatus(from, to)).toBe(to);
    });

    it('reopens a confirmed item after correction', () => {
      expect(receiptItemReviewStatusAfterCorrection('confirmed')).toBe('needs_review');
      expect(receiptItemReviewStatusAfterCorrection('needs_review')).toBe('needs_review');
    });
  });

  describe('soft-delete and restore', () => {
    it('soft-deletes and restores a receipt as inverse operations', () => {
      const deleted = softDelete(RECEIPT, '2026-09-21T13:00:00.000Z');
      expect(deleted.deletedAt).toBe('2026-09-21T13:00:00.000Z');
      expect(restore(deleted)).toEqual(RECEIPT);
    });

    it('works for receipt assets without deleting structured receipt data', () => {
      const asset: ReceiptAsset = {
        id: 'asset-1',
        receiptId: RECEIPT.id,
        householdId: RECEIPT.householdId,
        storagePath: 'household-1/receipt-1/asset-1.jpg',
        mimeType: 'image/jpeg',
        byteSize: 120_000,
        sortOrder: 0,
        createdBy: RECEIPT.createdBy,
        createdAt: '2026-09-21T11:30:00.000Z',
        deletedAt: null,
      };

      const deletedAsset = softDelete(asset, '2026-09-21T13:00:00.000Z');
      expect(deletedAsset.receiptId).toBe(RECEIPT.id);
      expect(RECEIPT.deletedAt).toBeNull();
      expect(restore(deletedAsset)).toEqual(asset);
    });

    it('rejects deleting an already deleted record and restoring an active record', () => {
      const deleted = softDelete(RECEIPT, '2026-09-21T13:00:00.000Z');

      expect(() => softDelete(deleted, '2026-09-21T14:00:00.000Z')).toThrow('already deleted');
      expect(() => restore(RECEIPT)).toThrow('not deleted');
    });
  });
});
