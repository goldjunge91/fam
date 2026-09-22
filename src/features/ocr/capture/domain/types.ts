export const RECEIPT_CAPTURE_SOURCES = ['camera', 'gallery'] as const;
export type ReceiptCaptureSource = (typeof RECEIPT_CAPTURE_SOURCES)[number];

export const RECEIPT_CAPTURE_STATUSES = ['pending', 'uploaded', 'failed'] as const;
export type ReceiptCaptureStatus = (typeof RECEIPT_CAPTURE_STATUSES)[number];

export const RECEIPT_CAPTURE_PHASES = [
  'captured',
  'normalized',
  'processing',
  'needs_review',
  'saving',
  'saved',
] as const;
export type ReceiptCapturePhase = (typeof RECEIPT_CAPTURE_PHASES)[number];

/** A local image handed from capture to the upload queue. Array order is page order. */
export type ReceiptCaptureLocalAsset = {
  id: string;
  localUri: string;
  mimeType: string;
  byteSize: number | null;
};

export type ReceiptCaptureLocalAssetInput = Omit<ReceiptCaptureLocalAsset, 'byteSize'> & {
  byteSize?: number | null;
};

export type ReceiptCapturePage = ReceiptCaptureLocalAsset;
export type ReceiptCapturePageInput = ReceiptCaptureLocalAssetInput;

/**
 * Structured review data that is safe to resume after a relaunch. It contains
 * parsed values and review inputs only, never OCR text or line evidence.
 */
export type ReceiptCaptureReviewFieldSnapshot<T extends string | number> = {
  value: T | null;
  confidence: number | null;
  sourceLineIndex: number | null;
  evidence: string | null;
  needsReview: boolean;
};

export type ReceiptCaptureReviewItemSourceSnapshot = {
  id: string;
  name: string;
  quantity: number | null;
  unit: string | null;
  lineTotalCents: ReceiptCaptureReviewFieldSnapshot<number>;
  unitPriceCents: ReceiptCaptureReviewFieldSnapshot<number> | null;
  confidence: number | null;
  sourceLineIndex: number;
  evidence: string;
  needsReview: boolean;
};

export type ReceiptCaptureReviewItemStateSnapshot = {
  id: string;
  name: string;
  quantity: string;
  lineTotalCents: string;
  needsReview: boolean;
};

export type ReceiptCaptureReviewSnapshot = {
  source: {
    market: ReceiptCaptureReviewFieldSnapshot<string>;
    purchaseDate: ReceiptCaptureReviewFieldSnapshot<string>;
    totalCents: ReceiptCaptureReviewFieldSnapshot<number>;
    items: readonly ReceiptCaptureReviewItemSourceSnapshot[];
  };
  state: {
    market: string;
    purchaseDate: string;
    totalCents: string;
    storeId: string | null;
    marketNeedsReview: boolean;
    dateNeedsReview: boolean;
    totalNeedsReview: boolean;
    items: readonly ReceiptCaptureReviewItemStateSnapshot[];
  };
};

export type ReceiptCaptureFailure = {
  code: string;
  message: string;
  /** The phase to resume after the failure. Optional for current callers. */
  phase?: ReceiptCapturePhase;
};

/** The server-side asset identity paired with one local page after upload. */
export type ReceiptCaptureUploadedAsset = {
  localAssetId: string;
  assetId: string;
};

/** A local-first capture draft. It carries image data only, never OCR meaning. */
export type ReceiptCaptureDraft = {
  id: string;
  source: ReceiptCaptureSource;
  pages: readonly ReceiptCapturePage[];
  status: ReceiptCaptureStatus;
  phase: ReceiptCapturePhase;
  uploadedAssets: readonly ReceiptCaptureUploadedAsset[];
  failure: ReceiptCaptureFailure | null;
  review?: ReceiptCaptureReviewSnapshot;
  createdAt: string;
  updatedAt: string;
};
