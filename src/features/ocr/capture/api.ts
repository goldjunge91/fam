import type {
  ReceiptAssetUploadAdapter,
  ReceiptCaptureClock,
  ReceiptCaptureDependencies,
  ReceiptCaptureFileAdapter,
  ReceiptImagePickerAdapter,
} from './capture/contracts';
import {
  type CaptureReceiptPagesInput,
  captureReceiptPages,
  type ReceiptCaptureResult,
} from './capture/image-picker';
import {
  createExpoFileSystemAdapter,
  createExpoImagePickerAdapter,
} from './capture/native-adapters';
import { createSupabaseReceiptAssetUploadAdapter } from './capture/supabase-upload';
import {
  type ReceiptCaptureUploadResult,
  type ReceiptUploadDependencies,
  retryReceiptCaptureUpload as retryPendingReceiptCaptureUpload,
  type UploadReceiptCaptureInput,
  uploadReceiptCapture as uploadPendingReceiptCapture,
} from './capture/upload-queue';
import { appendReceiptCapturePages } from './domain/actions';
import type { ReceiptCapturePersistence } from './persistence/receipt-capture-persistence';
import {
  createReceiptCapturePersistence as createReceiptCapturePersistenceOwner,
  type ReceiptCaptureMetadataStorage,
  type ReceiptCapturePersistenceDependencies,
} from './persistence/receipt-capture-persistence';

export type ReceiptCaptureApiDependencies = {
  imagePicker?: ReceiptImagePickerAdapter;
  fileSystem?: ReceiptCaptureFileAdapter;
  assetUploader?: ReceiptAssetUploadAdapter;
  now?: ReceiptCaptureClock;
  maxBytes?: number;
  persistence?: ReceiptCapturePersistence;
};

export type CaptureReceiptInput = CaptureReceiptPagesInput & {
  appendToExisting?: boolean;
};

function captureDependencies(
  dependencies: ReceiptCaptureApiDependencies,
): ReceiptCaptureDependencies {
  return {
    imagePicker: dependencies.imagePicker ?? createExpoImagePickerAdapter(),
    fileSystem: dependencies.fileSystem ?? createExpoFileSystemAdapter(),
    now: dependencies.now,
  };
}

function uploadDependencies(
  dependencies: ReceiptCaptureApiDependencies,
): ReceiptUploadDependencies {
  return {
    fileSystem: dependencies.fileSystem ?? createExpoFileSystemAdapter(),
    assetUploader: dependencies.assetUploader ?? createSupabaseReceiptAssetUploadAdapter(),
    now: dependencies.now,
    maxBytes: dependencies.maxBytes,
  };
}

/** Capture entry point. Defaults are lazy; tests and callers may inject every boundary. */
export function captureReceipt(
  input: CaptureReceiptInput,
  dependencies: ReceiptCaptureApiDependencies = {},
): Promise<ReceiptCaptureResult> {
  const existingPromise =
    input.appendToExisting && dependencies.persistence ? dependencies.persistence.load() : null;

  return Promise.resolve(existingPromise).then(async (existing) => {
    if (existing && existing.status !== 'pending') {
      throw new Error('Only a pending capture can receive additional pages.');
    }
    const captureId = existing
      ? `${input.captureId}:append:${existing.pages.length}`
      : input.captureId;
    const result = await captureReceiptPages(
      { ...input, captureId },
      captureDependencies(dependencies),
    );
    if (result.kind === 'captured' && dependencies.persistence) {
      const draft = existing
        ? appendReceiptCapturePages(existing, {
            pages: result.draft.pages,
            updatedAt: result.draft.updatedAt,
          })
        : result.draft;
      await dependencies.persistence.save(draft);
      return { ...result, draft };
    }
    return result;
  });
}

/** Upload entry point for a pending local draft. Offline failures remain on the draft. */
export function uploadReceiptCapture(
  input: UploadReceiptCaptureInput,
  dependencies: ReceiptCaptureApiDependencies = {},
): Promise<ReceiptCaptureUploadResult> {
  return uploadPendingReceiptCapture(input, uploadDependencies(dependencies)).then(
    async (result) => {
      if (dependencies.persistence) await dependencies.persistence.save(result.draft);
      return result;
    },
  );
}

/** Retry entry point for a failed local draft. */
export function retryReceiptCaptureUpload(
  input: UploadReceiptCaptureInput,
  dependencies: ReceiptCaptureApiDependencies = {},
): Promise<ReceiptCaptureUploadResult> {
  return retryPendingReceiptCaptureUpload(input, uploadDependencies(dependencies)).then(
    async (result) => {
      if (dependencies.persistence) await dependencies.persistence.save(result.draft);
      return result;
    },
  );
}

export function createReceiptCapturePersistence(
  accountId: string,
  dependencies: ReceiptCapturePersistenceDependencies & {
    storage?: ReceiptCaptureMetadataStorage;
  } = {},
): ReceiptCapturePersistence {
  return createReceiptCapturePersistenceOwner(accountId, dependencies);
}

export { receiptCaptureAssetId } from './capture/ids';
export {
  createExpoFileSystemAdapter,
  createExpoImagePickerAdapter,
} from './capture/native-adapters';
export { createSupabaseReceiptAssetUploadAdapter } from './capture/supabase-upload';
export { receiptAssetStoragePath } from './capture/upload-queue';
export type {
  ReceiptAssetUploadAdapter,
  ReceiptCaptureClock,
  ReceiptCaptureFileAdapter,
  ReceiptCaptureMetadataStorage,
  ReceiptCapturePersistence,
  ReceiptCapturePersistenceDependencies,
  ReceiptCaptureResult,
  ReceiptImagePickerAdapter,
  ReceiptUploadDependencies,
  UploadReceiptCaptureInput,
};
