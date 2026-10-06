import { useQuery } from '@tanstack/react-query';
import { beginAccountSyncRun } from '@/lib/sync/remote-sync-gate';
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
  isReceiptAssetUploadFailureCode,
  type ReceiptCaptureUploadResult,
  type ReceiptParentSyncWaiter,
  type ReceiptUploadDependencies,
  retryReceiptCaptureUpload as retryPendingReceiptCaptureUpload,
  type UploadReceiptCaptureInput,
  uploadReceiptCapture as uploadPendingReceiptCapture,
} from './capture/upload-queue';
import { appendReceiptCapturePages } from './domain/actions';
import type { ReceiptCaptureDraft } from './domain/types';
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
  waitForParentSync?: ReceiptParentSyncWaiter;
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
    waitForParentSync: dependencies.waitForParentSync,
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
  const retry = () =>
    retryPendingReceiptCaptureUpload(input, uploadDependencies(dependencies)).then(
      async (result) => {
        if (dependencies.persistence) await dependencies.persistence.save(result.draft);
        return result;
      },
    );
  const accountId = dependencies.persistence?.accountId;
  if (!accountId) return retry();
  const existing = pendingAssetRetryByAccount.get(accountId);
  if (existing) return existing;
  const operation = retry();
  pendingAssetRetryByAccount.set(accountId, operation);
  return operation.finally(() => {
    if (pendingAssetRetryByAccount.get(accountId) === operation) {
      pendingAssetRetryByAccount.delete(accountId);
    }
  });
}

export type PendingReceiptAssetUpload = {
  receiptId: string;
  pageCount: number;
  updatedAt: string;
  errorMessage: string | null;
};

export async function getPendingReceiptAssetUpload(
  accountId: string | undefined,
): Promise<PendingReceiptAssetUpload | null> {
  if (!accountId) return null;
  const draft = await createReceiptCapturePersistence(accountId).load();
  if (
    draft?.status !== 'failed' ||
    !draft.failure ||
    !isReceiptAssetUploadFailureCode(draft.failure.code)
  )
    return null;
  return {
    receiptId: draft.id,
    pageCount: draft.pages.length,
    updatedAt: draft.updatedAt,
    errorMessage: draft.failure.message,
  };
}

export function usePendingReceiptAssetUpload(accountId: string | undefined) {
  return useQuery({
    queryKey: ['receipt-asset-upload', accountId],
    queryFn: () => getPendingReceiptAssetUpload(accountId),
    enabled: Boolean(accountId),
    networkMode: 'always',
    refetchInterval: getPendingReceiptAssetUploadRefetchInterval(accountId),
  });
}

export function getPendingReceiptAssetUploadRefetchInterval(accountId: string | undefined) {
  return accountId ? 15_000 : false;
}

const pendingAssetRetryByAccount = new Map<string, Promise<ReceiptCaptureUploadResult>>();

export async function retryPendingReceiptAssetUpload(input: {
  accountId: string;
  householdId: string;
  createdBy: string;
}): Promise<ReceiptCaptureUploadResult | null> {
  const finishAccountSyncRun = beginAccountSyncRun();
  if (!finishAccountSyncRun) return null;
  try {
    return await retryPendingReceiptAssetUploadOnce(input);
  } finally {
    finishAccountSyncRun();
  }
}

async function retryPendingReceiptAssetUploadOnce(input: {
  accountId: string;
  householdId: string;
  createdBy: string;
}): Promise<ReceiptCaptureUploadResult | null> {
  const persistence = createReceiptCapturePersistence(input.accountId);
  const draft = await persistence.load();
  if (
    draft?.status !== 'failed' ||
    !draft.failure ||
    !isReceiptAssetUploadFailureCode(draft.failure.code)
  )
    return null;
  const result = await retryReceiptCaptureUpload(
    {
      draft,
      householdId: draft.householdId ?? input.householdId,
      receiptId: draft.id,
      createdBy: input.createdBy,
    },
    { persistence },
  );
  if (result.draft.status === 'uploaded') {
    await persistence.transition({ phase: 'saved', updatedAt: new Date().toISOString() });
    await persistence.discard();
  }
  return result;
}

export type ResumableReceiptDraft = {
  draftId: string;
  phase: ReceiptCaptureDraft['phase'];
  pageCount: number;
  updatedAt: string;
};

/**
 * Sichtbarer Wiedereinstieg fuer einen persistierten, noch nicht
 * abgeschlossenen Capture-Entwurf. `getPendingReceiptAssetUpload` deckt nur
 * den Upload-Fehlerfall ab; ein nach Neustart offener Review- oder
 * Processing-Entwurf braucht einen eigenen, allgemeinen Resume-Punkt.
 */
export async function getResumableReceiptDraft(
  accountId: string | undefined,
): Promise<ResumableReceiptDraft | null> {
  if (!accountId) return null;
  const draft = await createReceiptCapturePersistence(accountId).load();
  if (!draft) return null;
  if (draft.status === 'uploaded' || draft.phase === 'saved') return null;
  return {
    draftId: draft.id,
    phase: draft.phase,
    pageCount: draft.pages.length,
    updatedAt: draft.updatedAt,
  };
}

export function useResumableReceiptDraft(accountId: string | undefined) {
  return useQuery({
    queryKey: ['receipt-resumable-draft', accountId],
    queryFn: () => getResumableReceiptDraft(accountId),
    enabled: Boolean(accountId),
    networkMode: 'always',
  });
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
export { isReceiptAssetUploadFailureCode, receiptAssetStoragePath } from './capture/upload-queue';
export type {
  ReceiptAssetUploadAdapter,
  ReceiptCaptureClock,
  ReceiptCaptureFileAdapter,
  ReceiptCaptureMetadataStorage,
  ReceiptCapturePersistence,
  ReceiptCapturePersistenceDependencies,
  ReceiptCaptureResult,
  ReceiptImagePickerAdapter,
  ReceiptParentSyncWaiter,
  ReceiptUploadDependencies,
  UploadReceiptCaptureInput,
};
