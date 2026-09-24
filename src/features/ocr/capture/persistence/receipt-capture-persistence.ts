import { getEncryptedAccountStorage } from '@/lib/storage/local-account-storage';
import type { ReceiptCaptureFileAdapter } from '../capture/contracts';
import {
  type AppendReceiptCapturePagesInput,
  appendReceiptCapturePages,
  markReceiptCaptureFailed,
  retryReceiptCapture,
  setReceiptCapturePhase,
} from '../domain/actions';
import {
  RECEIPT_CAPTURE_PHASES,
  RECEIPT_CAPTURE_SOURCES,
  RECEIPT_CAPTURE_STATUSES,
  type ReceiptCaptureDraft,
  type ReceiptCaptureFailure,
  type ReceiptCapturePhase,
  type ReceiptCaptureReviewSnapshot,
} from '../domain/types';

export const RECEIPT_CAPTURE_DRAFT_STORAGE_KEY = 'fam.ocr.receipt-capture.draft.v1';

/**
 * Fast refresh can unmount one flow while the next instance is already
 * mounting. Keep discard ordered per account so the next flow cannot resume
 * the draft that the previous instance is still deleting.
 */
const pendingDiscardByAccount = new Map<string, Promise<void>>();
const discardGenerationByAccount = new Map<string, number>();

export type ReceiptCaptureMetadataStorage = {
  getString(key: string): string | undefined;
  set(key: string, value: string): void;
  remove(key: string): void;
};

export type ReceiptCapturePersistenceDependencies = {
  storage?: ReceiptCaptureMetadataStorage;
  fileSystem?: Pick<ReceiptCaptureFileAdapter, 'deleteLocalFile'>;
};

export type ReceiptCapturePersistence = {
  load(): Promise<ReceiptCaptureDraft | null>;
  save(draft: ReceiptCaptureDraft): Promise<void>;
  appendPages(input: AppendReceiptCapturePagesInput): Promise<ReceiptCaptureDraft>;
  transition(input: {
    phase: ReceiptCapturePhase;
    updatedAt: string;
  }): Promise<ReceiptCaptureDraft>;
  fail(input: {
    phase: ReceiptCapturePhase;
    failure: Omit<ReceiptCaptureFailure, 'phase'>;
    updatedAt: string;
  }): Promise<ReceiptCaptureDraft>;
  retry(updatedAt: string): Promise<ReceiptCaptureDraft>;
  discard(): Promise<void>;
};

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isNumberOrNull(value: unknown): value is number | null {
  return value === null || (typeof value === 'number' && Number.isSafeInteger(value) && value >= 0);
}

function isConfidence(value: unknown): value is number | null {
  return (
    value === null ||
    (typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1)
  );
}

function isBoolean(value: unknown): value is boolean {
  return typeof value === 'boolean';
}

function isSourceLineIndex(value: unknown): value is number | null {
  return (
    value === null || (typeof value === 'number' && Number.isSafeInteger(value) && value >= -1)
  );
}

function isOwnedReceiptCaptureUri(uri: string): boolean {
  if (!uri.startsWith('file://')) return false;
  const path = uri.slice('file://'.length).split(/[?#]/, 1)[0] ?? '';
  const segments = path.split('/').filter(Boolean);
  const directoryIndex = segments.indexOf('receipt-captures');
  if (directoryIndex < 1 || segments.length < directoryIndex + 3) return false;
  return segments.every((segment) => segment !== '.' && segment !== '..');
}

function isOneOf<T extends readonly string[]>(values: T, value: unknown): value is T[number] {
  return typeof value === 'string' && values.includes(value);
}

function isPersistedPage(value: unknown): boolean {
  if (!isRecord(value)) return false;
  return (
    isString(value.id) &&
    isString(value.localUri) &&
    isOwnedReceiptCaptureUri(value.localUri) &&
    isString(value.mimeType) &&
    isNumberOrNull(value.byteSize)
  );
}

function isPersistedUploadedAsset(value: unknown): boolean {
  return isRecord(value) && isString(value.localAssetId) && isString(value.assetId);
}

function isPersistedFailure(value: unknown): value is ReceiptCaptureFailure {
  if (!isRecord(value) || !isString(value.code) || !isString(value.message)) return false;
  return value.phase === undefined || isOneOf(RECEIPT_CAPTURE_PHASES, value.phase);
}

function isPersistedReviewField(value: unknown, valueType: 'string' | 'number'): boolean {
  if (!isRecord(value)) return false;
  const fieldValue = value.value;
  const validValue =
    fieldValue === null ||
    (valueType === 'string' ? typeof fieldValue === 'string' : isNumberOrNull(fieldValue));
  return (
    validValue &&
    isConfidence(value.confidence) &&
    isSourceLineIndex(value.sourceLineIndex) &&
    (value.evidence === null || typeof value.evidence === 'string') &&
    isBoolean(value.needsReview)
  );
}

function isPersistedReviewSnapshot(value: unknown): value is ReceiptCaptureReviewSnapshot {
  if (!isRecord(value) || !isRecord(value.source) || !isRecord(value.state)) return false;
  const source = value.source;
  const state = value.state;
  if (
    !isPersistedReviewField(source.market, 'string') ||
    !isPersistedReviewField(source.purchaseDate, 'string') ||
    !isPersistedReviewField(source.totalCents, 'number') ||
    !Array.isArray(source.items) ||
    !Array.isArray(state.items) ||
    typeof state.market !== 'string' ||
    typeof state.purchaseDate !== 'string' ||
    typeof state.totalCents !== 'string' ||
    (state.storeId !== null && typeof state.storeId !== 'string') ||
    !isBoolean(state.marketNeedsReview) ||
    !isBoolean(state.dateNeedsReview) ||
    !isBoolean(state.totalNeedsReview)
  ) {
    return false;
  }

  const sourceItems = source.items.every((item) => {
    if (!isRecord(item)) return false;
    return (
      isString(item.id) &&
      typeof item.name === 'string' &&
      (item.quantity === null ||
        (typeof item.quantity === 'number' && Number.isFinite(item.quantity))) &&
      (item.unit === null || typeof item.unit === 'string') &&
      isPersistedReviewField(item.lineTotalCents, 'number') &&
      (item.unitPriceCents === null || isPersistedReviewField(item.unitPriceCents, 'number')) &&
      isConfidence(item.confidence) &&
      typeof item.sourceLineIndex === 'number' &&
      Number.isSafeInteger(item.sourceLineIndex) &&
      item.sourceLineIndex >= -1 &&
      typeof item.evidence === 'string' &&
      isBoolean(item.needsReview)
    );
  });
  const stateItems = state.items.every((item) => {
    if (!isRecord(item)) return false;
    return (
      isString(item.id) &&
      typeof item.name === 'string' &&
      typeof item.quantity === 'string' &&
      typeof item.lineTotalCents === 'string' &&
      isBoolean(item.needsReview)
    );
  });
  if (!sourceItems || !stateItems) return false;

  const sourceIds = source.items.map((item) => (item as UnknownRecord).id);
  const stateIds = state.items.map((item) => (item as UnknownRecord).id);
  return new Set(sourceIds).size === sourceIds.length && new Set(stateIds).size === stateIds.length;
}

function cloneReviewSnapshot(value: ReceiptCaptureReviewSnapshot): ReceiptCaptureReviewSnapshot {
  return {
    source: {
      market: { ...value.source.market },
      purchaseDate: { ...value.source.purchaseDate },
      totalCents: { ...value.source.totalCents },
      items: value.source.items.map((item) => ({
        ...item,
        lineTotalCents: { ...item.lineTotalCents },
        unitPriceCents: item.unitPriceCents ? { ...item.unitPriceCents } : null,
      })),
    },
    state: {
      market: value.state.market,
      purchaseDate: value.state.purchaseDate,
      totalCents: value.state.totalCents,
      storeId: value.state.storeId,
      marketNeedsReview: value.state.marketNeedsReview,
      dateNeedsReview: value.state.dateNeedsReview,
      totalNeedsReview: value.state.totalNeedsReview,
      items: value.state.items.map((item) => ({ ...item })),
    },
  };
}

function decodeDraft(raw: string): ReceiptCaptureDraft | null {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed) || parsed.version !== 1 || !isRecord(parsed.draft)) return null;
    const value = parsed.draft;
    if (
      !isString(value.id) ||
      !isOneOf(RECEIPT_CAPTURE_SOURCES, value.source) ||
      !isOneOf(RECEIPT_CAPTURE_STATUSES, value.status) ||
      !isOneOf(RECEIPT_CAPTURE_PHASES, value.phase) ||
      !isString(value.createdAt) ||
      !isString(value.updatedAt) ||
      !Array.isArray(value.pages) ||
      value.pages.length === 0 ||
      !value.pages.every(isPersistedPage) ||
      !Array.isArray(value.uploadedAssets) ||
      !value.uploadedAssets.every(isPersistedUploadedAsset) ||
      (value.failure !== null && !isPersistedFailure(value.failure)) ||
      (value.review !== undefined &&
        value.review !== null &&
        !isPersistedReviewSnapshot(value.review))
    ) {
      return null;
    }

    const pageIds = new Set(value.pages.map((page) => (page as UnknownRecord).id as string));
    if (pageIds.size !== value.pages.length) return null;
    const uploadedAssets = value.uploadedAssets.map((asset) => ({
      localAssetId: (asset as UnknownRecord).localAssetId as string,
      assetId: (asset as UnknownRecord).assetId as string,
    }));
    if (
      new Set(uploadedAssets.map(({ localAssetId }) => localAssetId)).size !==
        uploadedAssets.length ||
      new Set(uploadedAssets.map(({ assetId }) => assetId)).size !== uploadedAssets.length ||
      uploadedAssets.some(({ localAssetId }) => !pageIds.has(localAssetId)) ||
      (value.status === 'uploaded' && uploadedAssets.length !== value.pages.length)
    ) {
      return null;
    }

    return {
      id: value.id,
      source: value.source,
      pages: value.pages.map((page) => ({
        id: (page as UnknownRecord).id as string,
        localUri: (page as UnknownRecord).localUri as string,
        mimeType: (page as UnknownRecord).mimeType as string,
        byteSize: (page as UnknownRecord).byteSize as number | null,
      })),
      status: value.status,
      phase: value.phase,
      uploadedAssets,
      failure: value.failure === null ? null : { ...value.failure },
      review:
        value.review === undefined || value.review === null
          ? undefined
          : cloneReviewSnapshot(value.review),
      createdAt: value.createdAt,
      updatedAt: value.updatedAt,
    };
  } catch {
    return null;
  }
}

function encodeDraft(draft: ReceiptCaptureDraft): string {
  return JSON.stringify({
    version: 1,
    draft: {
      id: draft.id,
      source: draft.source,
      pages: draft.pages.map(({ id, localUri, mimeType, byteSize }) => ({
        id,
        localUri,
        mimeType,
        byteSize,
      })),
      status: draft.status,
      phase: draft.phase,
      uploadedAssets: draft.uploadedAssets.map(({ localAssetId, assetId }) => ({
        localAssetId,
        assetId,
      })),
      failure: draft.failure
        ? { code: draft.failure.code, message: draft.failure.message, phase: draft.failure.phase }
        : null,
      review: draft.review ? cloneReviewSnapshot(draft.review) : null,
      createdAt: draft.createdAt,
      updatedAt: draft.updatedAt,
    },
  });
}

function assertPersistableDraft(draft: ReceiptCaptureDraft): void {
  if (draft.pages.length === 0) throw new Error('A receipt capture requires at least one page.');
  if (draft.pages.some((page) => !isOwnedReceiptCaptureUri(page.localUri))) {
    throw new Error('Receipt capture pages must use app-owned receipt-captures URIs.');
  }
}

function requireDraft(draft: ReceiptCaptureDraft | null): ReceiptCaptureDraft {
  if (!draft) throw new Error('No persisted receipt capture draft exists.');
  return draft;
}

function defaultFileSystem(): Pick<ReceiptCaptureFileAdapter, 'deleteLocalFile'> {
  const { createExpoFileSystemAdapter } =
    require('../capture/native-adapters') as typeof import('../capture/native-adapters');
  return createExpoFileSystemAdapter();
}

export function createReceiptCapturePersistence(
  accountId: string,
  dependencies: ReceiptCapturePersistenceDependencies = {},
): ReceiptCapturePersistence {
  if (!isString(accountId)) throw new Error('Account ID is required.');
  let storagePromise: Promise<ReceiptCaptureMetadataStorage> | null = null;
  const storage = (): Promise<ReceiptCaptureMetadataStorage> => {
    if (storagePromise) return storagePromise;
    storagePromise = dependencies.storage
      ? Promise.resolve(dependencies.storage)
      : getEncryptedAccountStorage(accountId);
    return storagePromise;
  };

  const readStoredDraft = async (): Promise<ReceiptCaptureDraft | null> => {
    const value = (await storage()).getString(RECEIPT_CAPTURE_DRAFT_STORAGE_KEY);
    if (!value) return null;
    const draft = decodeDraft(value);
    if (!draft) {
      (await storage()).remove(RECEIPT_CAPTURE_DRAFT_STORAGE_KEY);
      return null;
    }
    return draft;
  };

  const waitForPendingDiscard = async (): Promise<void> => {
    await pendingDiscardByAccount.get(accountId);
  };

  const currentDiscardGeneration = (): number => discardGenerationByAccount.get(accountId) ?? 0;

  const load = async (): Promise<ReceiptCaptureDraft | null> => {
    await waitForPendingDiscard();
    return readStoredDraft();
  };

  const saveAtGeneration = async (
    draft: ReceiptCaptureDraft,
    generation: number,
  ): Promise<void> => {
    assertPersistableDraft(draft);
    await waitForPendingDiscard();
    const accountStorage = await storage();
    if (currentDiscardGeneration() !== generation) return;
    accountStorage.set(RECEIPT_CAPTURE_DRAFT_STORAGE_KEY, encodeDraft(draft));
  };

  const save = async (draft: ReceiptCaptureDraft): Promise<void> => {
    await saveAtGeneration(draft, currentDiscardGeneration());
  };

  return {
    load,
    save,
    async appendPages(input) {
      const generation = currentDiscardGeneration();
      const next = appendReceiptCapturePages(requireDraft(await load()), input);
      await saveAtGeneration(next, generation);
      return next;
    },
    async transition(input) {
      const generation = currentDiscardGeneration();
      const next = setReceiptCapturePhase(requireDraft(await load()), input);
      await saveAtGeneration(next, generation);
      return next;
    },
    async fail(input) {
      const generation = currentDiscardGeneration();
      const next = markReceiptCaptureFailed(requireDraft(await load()), {
        failure: { ...input.failure, phase: input.phase },
        updatedAt: input.updatedAt,
      });
      await saveAtGeneration(next, generation);
      return next;
    },
    async retry(updatedAt) {
      const generation = currentDiscardGeneration();
      const next = retryReceiptCapture(requireDraft(await load()), { updatedAt });
      await saveAtGeneration(next, generation);
      return next;
    },
    async discard() {
      const generation = currentDiscardGeneration() + 1;
      discardGenerationByAccount.set(accountId, generation);
      const previousDiscard = pendingDiscardByAccount.get(accountId);
      let discardPromise!: Promise<void>;
      discardPromise = (async () => {
        await previousDiscard;
        const current = await readStoredDraft();
        if (!current) {
          (await storage()).remove(RECEIPT_CAPTURE_DRAFT_STORAGE_KEY);
          return;
        }
        const fileSystem = dependencies.fileSystem ?? defaultFileSystem();
        for (const page of current.pages) await fileSystem.deleteLocalFile(page.localUri);
        (await storage()).remove(RECEIPT_CAPTURE_DRAFT_STORAGE_KEY);
      })();
      pendingDiscardByAccount.set(accountId, discardPromise);
      try {
        await discardPromise;
      } finally {
        if (pendingDiscardByAccount.get(accountId) === discardPromise) {
          pendingDiscardByAccount.delete(accountId);
        }
      }
    },
  };
}
