import {
  RECEIPT_CAPTURE_SOURCES,
  type ReceiptCaptureDraft,
  type ReceiptCaptureFailure,
  type ReceiptCaptureLocalAsset,
  type ReceiptCaptureLocalAssetInput,
  type ReceiptCapturePhase,
  type ReceiptCaptureSource,
  type ReceiptCaptureUploadedAsset,
} from './types';

export type CreateReceiptCaptureDraftInput = {
  id: string;
  source: ReceiptCaptureSource;
  pages: readonly ReceiptCaptureLocalAssetInput[];
  createdAt: string;
  updatedAt?: string;
};

export type AppendReceiptCapturePagesInput = {
  pages: readonly ReceiptCaptureLocalAssetInput[];
  updatedAt: string;
};

export type MarkReceiptCaptureUploadedInput = {
  uploadedAssets: readonly ReceiptCaptureUploadedAsset[];
  updatedAt: string;
};

export type MarkReceiptCaptureFailedInput = {
  failure: ReceiptCaptureFailure;
  updatedAt: string;
};

export type RetryReceiptCaptureInput = {
  updatedAt: string;
};

export type SetReceiptCapturePhaseInput = {
  phase: ReceiptCapturePhase;
  updatedAt: string;
};

const NEXT_PHASES: Record<ReceiptCapturePhase, readonly ReceiptCapturePhase[]> = {
  captured: ['normalized'],
  normalized: ['processing'],
  processing: ['needs_review'],
  needs_review: ['saving'],
  saving: ['saved'],
  saved: [],
};

function requireText(value: string, fieldName: string): string {
  if (value.trim().length === 0) {
    throw new Error(`${fieldName} is required.`);
  }
  return value;
}

function normalizeLocalAsset(input: ReceiptCaptureLocalAssetInput): ReceiptCaptureLocalAsset {
  requireText(input.id, 'Local asset ID');
  requireText(input.localUri, 'Local asset URI');
  requireText(input.mimeType, 'MIME type');

  if (
    input.byteSize !== undefined &&
    input.byteSize !== null &&
    (!Number.isSafeInteger(input.byteSize) || input.byteSize < 0)
  ) {
    throw new Error('Local asset byte size must be a non-negative safe integer.');
  }

  return {
    id: input.id,
    localUri: input.localUri,
    mimeType: input.mimeType,
    byteSize: input.byteSize ?? null,
  };
}

function normalizePages(
  pages: readonly ReceiptCaptureLocalAssetInput[],
): ReceiptCaptureLocalAsset[] {
  if (pages.length === 0) {
    throw new Error('A receipt capture requires at least one page.');
  }

  const normalized = pages.map(normalizeLocalAsset);
  const ids = new Set<string>();
  for (const page of normalized) {
    if (ids.has(page.id)) {
      throw new Error(`Duplicate local asset ID: ${page.id}.`);
    }
    ids.add(page.id);
  }
  return normalized;
}

function assertCaptureSource(source: ReceiptCaptureSource): void {
  if (!RECEIPT_CAPTURE_SOURCES.includes(source)) {
    throw new Error(`Unsupported receipt capture source: ${source}.`);
  }
}

function assertPending(draft: ReceiptCaptureDraft): void {
  if (draft.status !== 'pending') {
    throw new Error('Only pending captures can be changed.');
  }
}

export function createReceiptCaptureDraft(
  input: CreateReceiptCaptureDraftInput,
): ReceiptCaptureDraft {
  requireText(input.id, 'Capture ID');
  assertCaptureSource(input.source);
  requireText(input.createdAt, 'Creation timestamp');

  const pages = normalizePages(input.pages);
  const updatedAt = input.updatedAt ?? input.createdAt;
  requireText(updatedAt, 'Update timestamp');

  return {
    id: input.id,
    source: input.source,
    pages,
    status: 'pending',
    phase: 'normalized',
    uploadedAssets: [],
    failure: null,
    createdAt: input.createdAt,
    updatedAt,
  };
}

export function appendReceiptCapturePages(
  draft: ReceiptCaptureDraft,
  input: AppendReceiptCapturePagesInput,
): ReceiptCaptureDraft {
  assertPending(draft);
  requireText(input.updatedAt, 'Update timestamp');

  const pages = normalizePages(input.pages);
  const existingIds = new Set(draft.pages.map(({ id }) => id));
  if (pages.some(({ id }) => existingIds.has(id))) {
    throw new Error('A local asset ID can only appear once in a capture.');
  }

  return {
    ...draft,
    pages: [...draft.pages, ...pages],
    updatedAt: input.updatedAt,
  };
}

export function markReceiptCaptureUploaded(
  draft: ReceiptCaptureDraft,
  input: MarkReceiptCaptureUploadedInput,
): ReceiptCaptureDraft {
  assertPending(draft);
  requireText(input.updatedAt, 'Update timestamp');

  if (input.uploadedAssets.length !== draft.pages.length) {
    throw new Error('There must be one uploaded asset for each page.');
  }

  const pageIds = new Set(draft.pages.map(({ id }) => id));
  const uploadedPageIds = new Set<string>();
  const assetIds = new Set<string>();
  for (const uploadedAsset of input.uploadedAssets) {
    requireText(uploadedAsset.localAssetId, 'Uploaded local asset ID');
    requireText(uploadedAsset.assetId, 'Uploaded asset ID');
    if (!pageIds.has(uploadedAsset.localAssetId)) {
      throw new Error('Every uploaded asset must reference a capture page.');
    }
    if (uploadedPageIds.has(uploadedAsset.localAssetId)) {
      throw new Error('Every capture page can only be uploaded once.');
    }
    if (assetIds.has(uploadedAsset.assetId)) {
      throw new Error('Every uploaded asset ID must be unique.');
    }
    uploadedPageIds.add(uploadedAsset.localAssetId);
    assetIds.add(uploadedAsset.assetId);
  }

  return {
    ...draft,
    status: 'uploaded',
    uploadedAssets: [...input.uploadedAssets],
    failure: null,
    updatedAt: input.updatedAt,
  };
}

export function markReceiptCaptureFailed(
  draft: ReceiptCaptureDraft,
  input: MarkReceiptCaptureFailedInput,
): ReceiptCaptureDraft {
  assertPending(draft);
  requireText(input.updatedAt, 'Update timestamp');
  requireText(input.failure.code, 'Capture failure code');
  requireText(input.failure.message, 'Capture failure message');

  return {
    ...draft,
    phase: input.failure.phase ?? draft.phase,
    status: 'failed',
    failure: { ...input.failure },
    updatedAt: input.updatedAt,
  };
}

export function setReceiptCapturePhase(
  draft: ReceiptCaptureDraft,
  input: SetReceiptCapturePhaseInput,
): ReceiptCaptureDraft {
  requireText(input.updatedAt, 'Update timestamp');
  if (draft.status === 'failed') {
    throw new Error('Retry a failed capture before changing its phase.');
  }
  if (draft.phase !== input.phase && !NEXT_PHASES[draft.phase].includes(input.phase)) {
    throw new Error(`Receipt capture phase cannot move from ${draft.phase} to ${input.phase}.`);
  }

  return { ...draft, phase: input.phase, updatedAt: input.updatedAt };
}

export function retryReceiptCapture(
  draft: ReceiptCaptureDraft,
  input: RetryReceiptCaptureInput,
): ReceiptCaptureDraft {
  if (draft.status !== 'failed') {
    throw new Error('Only failed captures can be retried.');
  }
  requireText(input.updatedAt, 'Update timestamp');

  return {
    ...draft,
    status: 'pending',
    failure: null,
    updatedAt: input.updatedAt,
  };
}
