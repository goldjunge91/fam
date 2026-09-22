export const RECEIPT_PROCESSING_STATUSES = [
  'draft',
  'processing',
  'needs_review',
  'confirmed',
  'failed',
] as const;

export type ReceiptProcessingStatus = (typeof RECEIPT_PROCESSING_STATUSES)[number];

export const RECEIPT_ITEM_REVIEW_STATUSES = ['needs_review', 'confirmed'] as const;

export type ReceiptItemReviewStatus = (typeof RECEIPT_ITEM_REVIEW_STATUSES)[number];

const RECEIPT_STATUS_TRANSITIONS: Readonly<
  Record<ReceiptProcessingStatus, readonly ReceiptProcessingStatus[]>
> = {
  draft: ['processing', 'failed'],
  processing: ['needs_review', 'failed'],
  needs_review: ['confirmed', 'failed'],
  confirmed: ['needs_review', 'failed'],
  failed: ['draft'],
};

const RECEIPT_ITEM_REVIEW_TRANSITIONS: Readonly<
  Record<ReceiptItemReviewStatus, readonly ReceiptItemReviewStatus[]>
> = {
  needs_review: ['confirmed'],
  confirmed: ['needs_review'],
};

export function canTransitionReceiptStatus(
  from: ReceiptProcessingStatus,
  to: ReceiptProcessingStatus,
): boolean {
  return from === to || RECEIPT_STATUS_TRANSITIONS[from].includes(to);
}

export function transitionReceiptStatus(
  from: ReceiptProcessingStatus,
  to: ReceiptProcessingStatus,
): ReceiptProcessingStatus {
  if (!canTransitionReceiptStatus(from, to)) {
    throw new Error(`Receipt status transition ${from} -> ${to} is not allowed.`);
  }
  return to;
}

export function receiptStatusAfterCorrection(
  status: ReceiptProcessingStatus,
): ReceiptProcessingStatus {
  return status === 'confirmed' ? 'needs_review' : status;
}

export function canTransitionReceiptItemReviewStatus(
  from: ReceiptItemReviewStatus,
  to: ReceiptItemReviewStatus,
): boolean {
  return from === to || RECEIPT_ITEM_REVIEW_TRANSITIONS[from].includes(to);
}

export function transitionReceiptItemReviewStatus(
  from: ReceiptItemReviewStatus,
  to: ReceiptItemReviewStatus,
): ReceiptItemReviewStatus {
  if (!canTransitionReceiptItemReviewStatus(from, to)) {
    throw new Error(`Receipt item review transition ${from} -> ${to} is not allowed.`);
  }
  return to;
}

export function receiptItemReviewStatusAfterCorrection(
  status: ReceiptItemReviewStatus,
): ReceiptItemReviewStatus {
  return status === 'confirmed' ? 'needs_review' : status;
}

type TombstonedRecord = { deletedAt: string | null };

export function softDelete<T extends TombstonedRecord>(record: T, deletedAt: string): T {
  if (record.deletedAt !== null) {
    throw new Error('Record is already deleted.');
  }
  if (deletedAt.trim().length === 0) {
    throw new Error('Deletion timestamp is required.');
  }
  return { ...record, deletedAt };
}

export function restore<T extends TombstonedRecord>(record: T): T {
  if (record.deletedAt === null) {
    throw new Error('Record is not deleted.');
  }
  return { ...record, deletedAt: null };
}
