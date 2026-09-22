import type { ReceiptItemReviewStatus, ReceiptProcessingStatus } from './status';

export const RECEIPT_CURRENCY = 'EUR';
export type ReceiptCurrency = typeof RECEIPT_CURRENCY;

/** Non-negative, safe integer amount in the receipt's canonical currency. */
export type EuroCents = number & { readonly __brand: 'EuroCents' };

export function isEuroCents(value: unknown): value is EuroCents {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

export function assertEuroCents(value: unknown, fieldName = 'EUR cents'): EuroCents {
  if (!isEuroCents(value)) {
    throw new Error(`${fieldName} must be a non-negative safe integer in EUR cents.`);
  }
  return value;
}

export type Receipt = {
  id: string;
  householdId: string;
  storeId: string | null;
  purchaseDate: string | null;
  currency: ReceiptCurrency;
  totalCents: EuroCents | null;
  processingStatus: ReceiptProcessingStatus;
  createdBy: string;
  confirmedBy: string | null;
  confirmedAt: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

export type ReceiptCreateInput = Pick<Receipt, 'id' | 'householdId' | 'currency' | 'createdBy'> &
  Partial<Pick<Receipt, 'storeId' | 'purchaseDate' | 'totalCents' | 'processingStatus'>>;

export type ReceiptUpdateInput = Partial<Pick<Receipt, 'storeId' | 'purchaseDate' | 'totalCents'>>;

export type ReceiptItem = {
  id: string;
  receiptId: string;
  householdId: string;
  position: number;
  name: string;
  productId: string | null;
  categoryId: string | null;
  quantity: number | null;
  unit: string | null;
  packageSize: number | null;
  packageSizeUnit: string | null;
  lineTotalCents: EuroCents | null;
  reviewStatus: ReceiptItemReviewStatus;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

export type ReceiptItemCreateInput = Omit<ReceiptItem, 'createdAt' | 'updatedAt' | 'deletedAt'>;

export type ReceiptItemUpdateInput = Partial<
  Pick<
    ReceiptItem,
    | 'position'
    | 'name'
    | 'productId'
    | 'categoryId'
    | 'quantity'
    | 'unit'
    | 'packageSize'
    | 'packageSizeUnit'
    | 'lineTotalCents'
  >
>;

export type ReceiptAsset = {
  id: string;
  receiptId: string;
  householdId: string;
  storagePath: string;
  mimeType: string;
  byteSize: number;
  sortOrder: number;
  createdBy: string;
  createdAt: string;
  deletedAt: string | null;
};

export type ReceiptAssetCreateInput = Omit<ReceiptAsset, 'createdAt' | 'deletedAt'>;

export type ReceiptAssetUpdateInput = Partial<
  Pick<ReceiptAsset, 'storagePath' | 'mimeType' | 'byteSize' | 'sortOrder'>
>;
