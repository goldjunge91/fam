import {
  type ConfirmReceiptInput,
  type CreateReceiptInput,
  type CreateReceiptItemInput,
  confirmReceipt,
  confirmReceiptItem,
  createReceipt,
  createReceiptItem,
  type ReceiptApiDependencies,
  type ReceiptItemReference,
  saveReceiptReview,
} from '@/features/ocr/authority/api';
import { receiptCaptureAssetId } from '@/features/ocr/capture/capture/ids';
import { markReceiptCaptureFailed } from '@/features/ocr/capture/domain/actions';
import type { ReceiptCaptureDraft } from '@/features/ocr/capture/domain/types';
import { debugLogEvent } from '@/lib/observability/debug-log';
import { parseGermanReceipt } from './domain/parser';
import type { ReceiptDraft, ReceiptOcrLine } from './domain/types';
import {
  getReceiptOcrAvailability,
  prepareReceiptOcr,
  type ReceiptOcrErrorCode,
  type ReceiptOcrResult,
  recognizeReceiptOcr,
} from './native';
import { getReceiptReviewValidationErrors } from './review/model';

export type ReceiptProcessingFailure = {
  code: string;
  message: string;
  pageIndex: number;
};

export type ReceiptProcessingResult =
  | {
      kind: 'success';
      captureId: string;
      draft: ReceiptDraft;
    }
  | {
      kind: 'failed';
      captureId: string;
      failure: ReceiptProcessingFailure;
    };

export type ReceiptProcessingProgress =
  | { phase: 'preparing'; progress: number }
  | { phase: 'reading'; pageIndex: number; pageCount: number };

function errorDetails(error: unknown): { code: string; message: string } {
  if (typeof error === 'object' && error !== null) {
    const candidate = error as { code?: unknown; message?: unknown };
    if (typeof candidate.code === 'string' && candidate.code.trim().length > 0) {
      return {
        code: candidate.code,
        message:
          typeof candidate.message === 'string' && candidate.message.trim().length > 0
            ? candidate.message
            : candidate.code,
      };
    }
  }

  return {
    code: 'RECEIPT_PROCESSING_FAILED',
    message: error instanceof Error && error.message ? error.message : 'Receipt processing failed.',
  };
}

function pageLines(result: ReceiptOcrResult, pageIndex: number): ReceiptOcrLine[] {
  return result.lines.map((line) => ({
    text: line.text,
    confidence: line.confidence,
    boundingBox: line.boundingBox,
    pageIndex,
  }));
}

/**
 * Runs on-device OCR for every captured page in order and parses one transient
 * semantic draft. OCR lines are deliberately not part of the returned value.
 */
export async function processReceiptCapture(input: {
  capture: ReceiptCaptureDraft;
  onProgress?: (progress: ReceiptProcessingProgress) => void;
}): Promise<ReceiptProcessingResult> {
  const lines: ReceiptOcrLine[] = [];

  try {
    input.onProgress?.({ phase: 'preparing', progress: 0 });
    const availability = await getReceiptOcrAvailability();
    if (availability.status !== 'available') {
      await prepareReceiptOcr({
        onProgress: (progress) => input.onProgress?.({ phase: 'preparing', progress }),
      });
    }
  } catch (error: unknown) {
    const details = errorDetails(error);
    return {
      kind: 'failed',
      captureId: input.capture.id,
      failure: { ...details, pageIndex: 0 },
    };
  }

  for (const [pageIndex, page] of input.capture.pages.entries()) {
    try {
      input.onProgress?.({
        phase: 'reading',
        pageIndex,
        pageCount: input.capture.pages.length,
      });
      const result = await recognizeReceiptOcr(page.localUri);
      lines.push(...pageLines(result, pageIndex));
    } catch (error: unknown) {
      const details = errorDetails(error);
      return {
        kind: 'failed',
        captureId: input.capture.id,
        failure: { ...details, pageIndex },
      };
    }
  }

  try {
    const draft = parseGermanReceipt(lines);
    debugLogEvent('receipt.processing.completed', {
      page_count: input.capture.pages.length,
      ocr_line_count: lines.length,
      item_count: draft.items.length,
      excluded_line_count: draft.excludedLines.length,
      warning_count: draft.warnings.length,
      has_market: draft.market.value !== null,
      has_date: draft.purchaseDate.value !== null,
      has_total: draft.totalCents.value !== null,
    });
    return {
      kind: 'success',
      captureId: input.capture.id,
      draft,
    };
  } catch (error: unknown) {
    const details = errorDetails(error);
    return {
      kind: 'failed',
      captureId: input.capture.id,
      failure: { ...details, pageIndex: Math.max(0, input.capture.pages.length - 1) },
    };
  }
}

export type ReceiptAuthorityWriter = {
  createReceipt: (
    input: CreateReceiptInput,
    dependencies?: ReceiptApiDependencies,
  ) => Promise<unknown>;
  createReceiptItem: (
    input: CreateReceiptItemInput,
    dependencies?: ReceiptApiDependencies,
  ) => Promise<unknown>;
  confirmReceiptItem: (
    input: ReceiptItemReference,
    dependencies?: ReceiptApiDependencies,
  ) => Promise<unknown>;
  confirmReceipt: (
    input: ConfirmReceiptInput,
    dependencies?: ReceiptApiDependencies,
  ) => Promise<unknown>;
  saveReceiptReview?: (
    input: Parameters<typeof saveReceiptReview>[0],
    dependencies?: ReceiptApiDependencies,
  ) => Promise<unknown>;
};

type ReceiptAssetUploadInput = {
  capture: ReceiptCaptureDraft;
  householdId: string;
  receiptId: string;
  createdBy: string;
};

type ReceiptAssetUploadResult = {
  draft: ReceiptCaptureDraft;
};

export type ReceiptAssetUploader = (
  input: ReceiptAssetUploadInput,
) => Promise<ReceiptAssetUploadResult>;

export type FinalizeReceiptReviewInput = {
  capture: ReceiptCaptureDraft;
  draft: ReceiptDraft;
  householdId: string;
  createdBy: string;
  receiptId?: string;
  storeId?: string | null;
  existingStoreIds?: readonly string[];
  confirmedBy?: string;
};

export type FinalizeReceiptDependencies = {
  authority?: ReceiptAuthorityWriter;
  uploadAssets?: ReceiptAssetUploader;
  authorityDependencies?: ReceiptApiDependencies;
};

export type FinalizeReceiptResult =
  | {
      kind: 'saved';
      receiptId: string;
      itemIds: readonly string[];
      assets: { kind: 'skipped' } | { kind: 'uploaded'; draft: ReceiptCaptureDraft };
    }
  | {
      kind: 'saved_with_pending_assets';
      receiptId: string;
      itemIds: readonly string[];
      assets: { kind: 'failed'; message: string; draft: ReceiptCaptureDraft };
    };

const DEFAULT_AUTHORITY: ReceiptAuthorityWriter = {
  createReceipt,
  createReceiptItem,
  confirmReceiptItem,
  confirmReceipt,
  saveReceiptReview,
};

function authorityUnit(unit: string | null): string | null {
  if (unit === null) return null;
  if (unit === 'Stück' || unit === 'Stk') return 'piece';
  if (unit === 'Packung') return 'package';
  if (unit === 'Portion') return 'portion';
  if (unit === 'g' || unit === 'kg' || unit === 'ml' || unit === 'l') return unit;
  return null;
}

function reviewedItemId(item: ReceiptDraft['items'][number], index: number): string {
  const reviewId = (item as ReceiptDraft['items'][number] & { reviewId?: unknown }).reviewId;
  if (typeof reviewId === 'string' && reviewId.trim().length > 0) return reviewId;
  return item.sourceLineIndex >= 0 ? `line-${item.sourceLineIndex}` : `item-${index}`;
}

function requireText(value: string, field: string): string {
  if (value.trim().length === 0) throw new Error(`${field} is required.`);
  return value.trim();
}

/**
 * Persists only the reviewed, structured draft. Asset upload is intentionally
 * best-effort and remains retryable when the device is offline.
 */
export async function finalizeReceiptReview(
  input: FinalizeReceiptReviewInput,
  dependencies: FinalizeReceiptDependencies = {},
): Promise<FinalizeReceiptResult> {
  const authority = dependencies.authority ?? DEFAULT_AUTHORITY;
  const receiptId = requireText(input.receiptId ?? input.capture.id, 'Receipt ID');
  const confirmedBy = requireText(input.confirmedBy ?? input.createdBy, 'Confirming member');
  const authorityDependencies = dependencies.authorityDependencies;
  const validationErrors = getReceiptReviewValidationErrors(
    input.draft,
    input.storeId ?? null,
    input.existingStoreIds ?? [],
  );
  if (validationErrors.length > 0) {
    throw new Error(`Receipt review is invalid: ${validationErrors[0]?.code ?? 'unknown'}.`);
  }

  const receiptInput = {
    id: receiptId,
    householdId: requireText(input.householdId, 'Household'),
    createdBy: requireText(input.createdBy, 'Creator'),
    storeId: input.storeId ?? null,
    purchaseDate: input.draft.purchaseDate.value,
    totalCents: input.draft.totalCents.value,
    processingStatus: 'needs_review' as const,
  };
  const itemInputs = input.draft.items.map((item, position) => ({
    id: receiptCaptureAssetId(`${receiptId}:item:${reviewedItemId(item, position)}`, 0),
    receiptId,
    householdId: input.householdId,
    position,
    name: requireText(item.name, 'Item name'),
    productId: null,
    categoryId: null,
    quantity: item.quantity,
    unit: authorityUnit(item.unit),
    packageSize: null,
    packageSizeUnit: null,
    lineTotalCents: item.lineTotalCents.value,
    reviewStatus: 'needs_review' as const,
  }));
  const itemIds = itemInputs.map(({ id }) => id);

  debugLogEvent('receipt.capture.save.authority_started', {
    item_count: itemInputs.length,
    has_store: input.storeId !== null && input.storeId !== undefined,
    has_total: input.draft.totalCents.value !== null,
  });
  try {
    if (authority.saveReceiptReview) {
      await authority.saveReceiptReview(
        { receipt: receiptInput, items: itemInputs, confirmedBy },
        authorityDependencies,
      );
    } else {
      await authority.createReceipt(receiptInput, authorityDependencies);
      for (const item of itemInputs) {
        await authority.createReceiptItem(item, authorityDependencies);
      }
      for (const itemId of itemIds) {
        await authority.confirmReceiptItem(
          { householdId: input.householdId, itemId },
          authorityDependencies,
        );
      }
      await authority.confirmReceipt(
        { householdId: input.householdId, receiptId, confirmedBy },
        authorityDependencies,
      );
    }
  } catch (error: unknown) {
    const details = errorDetails(error);
    debugLogEvent('receipt.capture.save.authority_failed', {
      ...details,
      item_count: itemInputs.length,
    });
    throw error;
  }
  debugLogEvent('receipt.capture.save.authority_completed', { item_count: itemInputs.length });

  if (!dependencies.uploadAssets) {
    debugLogEvent('receipt.capture.save.assets_skipped');
    return { kind: 'saved', receiptId, itemIds, assets: { kind: 'skipped' } };
  }

  debugLogEvent('receipt.capture.save.assets_started', { page_count: input.capture.pages.length });
  try {
    const uploaded = await dependencies.uploadAssets({
      capture: input.capture,
      householdId: input.householdId,
      receiptId,
      createdBy: input.createdBy,
    });
    if (uploaded.draft.status !== 'uploaded') {
      debugLogEvent('receipt.capture.save.assets_pending', {
        error_message: uploaded.draft.failure?.message ?? 'Asset upload failed.',
      });
      return {
        kind: 'saved_with_pending_assets',
        receiptId,
        itemIds,
        assets: {
          kind: 'failed',
          message: uploaded.draft.failure?.message ?? 'Asset upload failed.',
          draft: uploaded.draft,
        },
      };
    }
    debugLogEvent('receipt.capture.save.assets_completed', {
      page_count: uploaded.draft.pages.length,
    });
    return {
      kind: 'saved',
      receiptId,
      itemIds,
      assets: { kind: 'uploaded', draft: uploaded.draft },
    };
  } catch (error: unknown) {
    const details = errorDetails(error);
    debugLogEvent('receipt.capture.save.assets_failed', details);
    const message = details.message;
    const failedDraft =
      input.capture.status === 'pending'
        ? markReceiptCaptureFailed(input.capture, {
            failure: { code: 'upload_failed', message, phase: input.capture.phase },
            updatedAt: new Date().toISOString(),
          })
        : input.capture;
    return {
      kind: 'saved_with_pending_assets',
      receiptId,
      itemIds,
      assets: {
        kind: 'failed',
        message,
        draft: failedDraft,
      },
    };
  }
}

export type { ReceiptOcrErrorCode };
