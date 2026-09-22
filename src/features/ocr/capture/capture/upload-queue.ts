import {
  markReceiptCaptureFailed,
  markReceiptCaptureUploaded,
  retryReceiptCapture,
} from '../domain/actions';
import type {
  ReceiptCaptureDraft,
  ReceiptCaptureFailure,
  ReceiptCaptureUploadedAsset,
} from '../domain/types';
import { RECEIPT_MAX_ASSET_BYTES } from './constants';
import type {
  ReceiptAssetUploadAdapter,
  ReceiptAssetUploadInput,
  ReceiptCaptureClock,
  ReceiptCaptureFileAdapter,
} from './contracts';
import {
  normalizeReceiptImageMimeType,
  RECEIPT_CANONICAL_IMAGE_MIME_TYPE,
  receiptImageExtension,
} from './mime';

export type UploadReceiptCaptureInput = {
  draft: ReceiptCaptureDraft;
  householdId: string;
  receiptId: string;
  createdBy: string;
};

export type ReceiptUploadDependencies = {
  fileSystem: ReceiptCaptureFileAdapter;
  assetUploader: ReceiptAssetUploadAdapter;
  now?: ReceiptCaptureClock;
  maxBytes?: number;
};

export type ReceiptCaptureUploadResult = {
  draft: ReceiptCaptureDraft;
};

const DEFAULT_CLOCK = () => new Date();

function requirePathSegment(value: string, fieldName: string): string {
  if (value.trim().length === 0) throw new Error(`${fieldName} is required.`);
  if (value.includes('/') || value.includes('\\') || value.includes('..')) {
    throw new Error(`${fieldName} contains an invalid path segment.`);
  }
  return value;
}

export function receiptAssetStoragePath(input: {
  householdId: string;
  receiptId: string;
  assetId: string;
  mimeType: string;
}): string {
  const householdId = requirePathSegment(input.householdId, 'Household ID');
  const receiptId = requirePathSegment(input.receiptId, 'Receipt ID');
  const assetId = requirePathSegment(input.assetId, 'Asset ID');
  const mimeType = normalizeReceiptImageMimeType(input.mimeType, input.assetId);
  if (!mimeType) throw new Error('Receipt asset MIME type is not supported.');
  if (mimeType !== RECEIPT_CANONICAL_IMAGE_MIME_TYPE) {
    throw new Error('Receipt uploads require the normalized JPEG working file.');
  }
  return `${householdId}/${receiptId}/${assetId}.${receiptImageExtension(mimeType)}`;
}

function failureFrom(error: unknown, fallbackCode: string): ReceiptCaptureFailure {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    const code = (error as { code?: unknown }).code;
    const message = (error as { message?: unknown }).message;
    if (typeof code === 'string' && code.trim().length > 0) {
      return {
        code,
        message: typeof message === 'string' && message.trim().length > 0 ? message : code,
      };
    }
  }
  return {
    code: fallbackCode,
    message:
      error instanceof Error && error.message ? error.message : 'Receipt asset upload failed.',
  };
}

function isoNow(clock: ReceiptCaptureClock): string {
  return clock().toISOString();
}

function assertByteSize(byteSize: number, maxBytes: number): void {
  if (!Number.isSafeInteger(byteSize) || byteSize <= 0) {
    const error = new Error('The receipt image is empty or has invalid metadata.') as Error & {
      code?: string;
    };
    error.code = 'invalid_asset_metadata';
    throw error;
  }
  if (byteSize > maxBytes) {
    const error = new Error(`Receipt images must be at most ${maxBytes} bytes.`) as Error & {
      code?: string;
    };
    error.code = 'asset_too_large';
    throw error;
  }
}

async function uploadPendingReceiptCapture(
  input: UploadReceiptCaptureInput,
  dependencies: ReceiptUploadDependencies,
  draft: ReceiptCaptureDraft,
): Promise<ReceiptCaptureUploadResult> {
  const clock = dependencies.now ?? DEFAULT_CLOCK;
  const maxBytes = dependencies.maxBytes ?? RECEIPT_MAX_ASSET_BYTES;

  try {
    const uploadedAssets: ReceiptCaptureUploadedAsset[] = [];
    for (const [sortOrder, page] of draft.pages.entries()) {
      if (page.byteSize !== null) assertByteSize(page.byteSize, maxBytes);

      const bytes = await dependencies.fileSystem.readBytes(page.localUri);
      assertByteSize(bytes.byteLength, maxBytes);

      const mimeType = normalizeReceiptImageMimeType(page.mimeType, page.localUri);
      if (!mimeType) {
        const error = new Error('Receipt images must be JPEG, PNG, or WebP files.') as Error & {
          code?: string;
        };
        error.code = 'unsupported_format';
        throw error;
      }
      if (mimeType !== RECEIPT_CANONICAL_IMAGE_MIME_TYPE) {
        const error = new Error(
          'Receipt uploads require the normalized JPEG working file.',
        ) as Error & { code?: string };
        error.code = 'non_canonical_image';
        throw error;
      }

      const uploadInput: ReceiptAssetUploadInput = {
        householdId: input.householdId,
        receiptId: input.receiptId,
        createdBy: input.createdBy,
        localAssetId: page.id,
        assetId: page.id,
        storagePath: receiptAssetStoragePath({
          householdId: input.householdId,
          receiptId: input.receiptId,
          assetId: page.id,
          mimeType,
        }),
        mimeType,
        byteSize: bytes.byteLength,
        sortOrder,
        bytes,
      };
      const uploaded = await dependencies.assetUploader.upload(uploadInput);
      if (uploaded.assetId.trim().length === 0 || uploaded.storagePath.trim().length === 0) {
        const error = new Error('Receipt asset upload returned incomplete metadata.') as Error & {
          code?: string;
        };
        error.code = 'invalid_upload_result';
        throw error;
      }
      uploadedAssets.push({ localAssetId: page.id, assetId: uploaded.assetId });
    }

    return {
      draft: markReceiptCaptureUploaded(draft, {
        uploadedAssets,
        updatedAt: isoNow(clock),
      }),
    };
  } catch (error: unknown) {
    return {
      draft: markReceiptCaptureFailed(draft, {
        failure: failureFrom(error, 'upload_failed'),
        updatedAt: isoNow(clock),
      }),
    };
  }
}

/** Uploads one page at a time so an offline failure keeps the local draft retryable. */
export function uploadReceiptCapture(
  input: UploadReceiptCaptureInput,
  dependencies: ReceiptUploadDependencies,
): Promise<ReceiptCaptureUploadResult> {
  if (input.draft.status === 'uploaded') return Promise.resolve({ draft: input.draft });
  if (input.draft.status !== 'pending') {
    return Promise.reject(new Error('Only pending captures can be uploaded.'));
  }
  return uploadPendingReceiptCapture(input, dependencies, input.draft);
}

/** Reopens one failed draft and immediately retries its ordered upload queue. */
export function retryReceiptCaptureUpload(
  input: UploadReceiptCaptureInput,
  dependencies: ReceiptUploadDependencies,
): Promise<ReceiptCaptureUploadResult> {
  if (input.draft.status !== 'failed') {
    return Promise.reject(new Error('Only failed captures can be retried.'));
  }
  const clock = dependencies.now ?? DEFAULT_CLOCK;
  const pending = retryReceiptCapture(input.draft, { updatedAt: isoNow(clock) });
  return uploadPendingReceiptCapture(input, dependencies, pending);
}

export type {
  ReceiptAssetUploadAdapter,
  ReceiptCaptureFileAdapter,
  ReceiptUploadDependencies as ReceiptCaptureUploadDependencies,
};
