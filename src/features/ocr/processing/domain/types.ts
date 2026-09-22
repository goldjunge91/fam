export const RECEIPT_DRAFT_REVIEW_CONFIDENCE = 0.8;

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

export type ReceiptConfidence = number | null;

export type ReceiptOcrBoundingBox = {
  x: number;
  y: number;
  width: number;
  height: number;
};

/** Platform-neutral output shape of an on-device OCR line. */
export type ReceiptOcrLine = {
  text: string;
  confidence: ReceiptConfidence;
  pageIndex?: number;
  boundingBox?: ReceiptOcrBoundingBox;
};

export type ReceiptOcrPage = {
  pageIndex?: number;
  width: number;
  height: number;
  lines: readonly ReceiptOcrLine[];
};

export type ReceiptDraftField<T> = {
  value: T | null;
  confidence: ReceiptConfidence;
  sourceLineIndex: number | null;
  evidence: string | null;
  needsReview: boolean;
};

export type ReceiptDraftItem = {
  name: string;
  quantity: number | null;
  unit: string | null;
  lineTotalCents: ReceiptDraftField<EuroCents>;
  unitPriceCents: ReceiptDraftField<EuroCents> | null;
  confidence: ReceiptConfidence;
  sourceLineIndex: number;
  evidence: string;
  needsReview: boolean;
};

export type ReceiptDraftExcludedLineReason =
  | 'discount'
  | 'coupon'
  | 'deposit'
  | 'tax'
  | 'loyalty'
  | 'payment'
  | 'signature'
  | 'barcode';

export type ReceiptDraftExcludedLine = {
  sourceLineIndex: number;
  reason: ReceiptDraftExcludedLineReason;
  confidence: ReceiptConfidence;
  evidence: string;
};

export type ReceiptDraftWarning = 'missing_market' | 'missing_date' | 'missing_total' | 'no_items';

export type ReceiptDraft = {
  currency: ReceiptCurrency;
  market: ReceiptDraftField<string>;
  purchaseDate: ReceiptDraftField<string>;
  totalCents: ReceiptDraftField<EuroCents>;
  items: readonly ReceiptDraftItem[];
  excludedLines: readonly ReceiptDraftExcludedLine[];
  warnings: readonly ReceiptDraftWarning[];
};
