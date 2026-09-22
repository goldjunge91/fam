import { createReceiptCaptureDraft } from '../domain/actions';
import type {
  ReceiptCaptureDraft,
  ReceiptCaptureFailure,
  ReceiptCaptureSource,
} from '../domain/types';
import {
  RECEIPT_IMAGE_NORMALIZATION_QUALITY,
  RECEIPT_IMAGE_PICKER_QUALITY,
  RECEIPT_MAX_ASSET_BYTES,
  RECEIPT_MAX_IMAGE_LONG_EDGE,
} from './constants';
import type {
  ReceiptCaptureDependencies,
  ReceiptImagePickerOptions,
  ReceiptPickerAsset,
  ReceiptPickerError,
  ReceiptPickerResponse,
  ReceiptStoredFile,
} from './contracts';
import { receiptCaptureAssetId } from './ids';
import { isLocalReceiptImageUri, normalizeReceiptImageMimeType } from './mime';
import { validateNormalizedReceiptImage } from './normalization';

export type CaptureReceiptPagesInput = {
  captureId: string;
  source: ReceiptCaptureSource;
  createdAt?: string;
  updatedAt?: string;
  maxBytes?: number;
  maxLongEdge?: number;
  jpegQuality?: number;
};

export type ReceiptCaptureResult =
  | { kind: 'captured'; draft: ReceiptCaptureDraft }
  | { kind: 'cancelled'; source: ReceiptCaptureSource }
  | { kind: 'permission_denied'; source: ReceiptCaptureSource }
  | { kind: 'failed'; source: ReceiptCaptureSource; failure: ReceiptCaptureFailure };

const DEFAULT_CLOCK = () => new Date();

const pickerOptions = (source: ReceiptCaptureSource): ReceiptImagePickerOptions => ({
  // Expo SDK 57 uses the array form for mediaTypes. Multiple selection and editing are
  // mutually exclusive, so receipt pages are selected without the cropper.
  mediaTypes: ['images'],
  allowsEditing: false,
  allowsMultipleSelection: source === 'gallery',
  quality: RECEIPT_IMAGE_PICKER_QUALITY,
  base64: false,
  exif: true,
  orderedSelection: true,
});

function captureFailure(
  source: ReceiptCaptureSource,
  code: string,
  message: string,
): ReceiptCaptureResult {
  return { kind: 'failed', source, failure: { code, message } };
}

function errorMessage(error: unknown): string {
  return error instanceof Error && error.message.trim().length > 0
    ? error.message
    : 'Receipt capture failed.';
}

function asFailure(error: unknown, fallbackCode: string): ReceiptCaptureFailure {
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
  return { code: fallbackCode, message: errorMessage(error) };
}

function isPickerError(response: ReceiptPickerResponse): response is ReceiptPickerError {
  return (
    response !== null &&
    typeof response === 'object' &&
    'code' in response &&
    !('canceled' in response)
  );
}

function failureFromPickerResponse(
  source: ReceiptCaptureSource,
  response: ReceiptPickerResponse,
): ReceiptCaptureResult | null {
  if (response === null) {
    return captureFailure(source, 'picker_unavailable', 'The image picker returned no result.');
  }
  if (isPickerError(response)) {
    return captureFailure(source, response.code, response.message);
  }
  if (response.canceled || response.assets.length === 0) {
    return { kind: 'cancelled', source };
  }
  return null;
}

function assertPickerAssetSize(
  asset: ReceiptPickerAsset,
  _maxBytes: number,
): ReceiptCaptureFailure | null {
  if (asset.fileSize === undefined) return null;
  if (!Number.isSafeInteger(asset.fileSize) || asset.fileSize < 0) {
    return { code: 'invalid_asset_metadata', message: 'The selected image has an invalid size.' };
  }
  return null;
}

async function persistAsset(
  input: CaptureReceiptPagesInput,
  asset: ReceiptPickerAsset,
  pageIndex: number,
  dependencies: ReceiptCaptureDependencies,
  maxBytes: number,
  maxLongEdge: number,
  jpegQuality: number,
): Promise<
  | ReceiptCaptureFailure
  | (Pick<ReceiptStoredFile, 'localUri' | 'mimeType' | 'byteSize'> & { id: string })
> {
  if (asset.type && asset.type !== 'image') {
    return { code: 'unsupported_format', message: 'Only still receipt images are supported.' };
  }
  if (asset.uri.trim().length === 0) {
    return { code: 'invalid_asset', message: 'The selected image has no local URI.' };
  }
  if (!isLocalReceiptImageUri(asset.uri)) {
    return { code: 'invalid_asset', message: 'The selected image URI must be local.' };
  }

  const pickerSizeFailure = assertPickerAssetSize(asset, maxBytes);
  if (pickerSizeFailure) return pickerSizeFailure;

  const mimeType = normalizeReceiptImageMimeType(asset.mimeType, asset.uri);
  if (!mimeType || mimeType === 'image/heic-sequence' || mimeType === 'image/heif-sequence') {
    return {
      code: 'unsupported_format',
      message: 'Receipt images must be JPEG, PNG, WebP, HEIC, or HEIF files.',
    };
  }

  const id = receiptCaptureAssetId(input.captureId, pageIndex);
  const stored = await dependencies.fileSystem.normalizeToPersistentStorage({
    sourceUri: asset.uri,
    captureId: input.captureId,
    pageIndex,
    localAssetId: id,
    mimeType,
    maxBytes,
    maxLongEdge,
    jpegQuality,
  });

  const validationFailure = validateNormalizedReceiptImage(stored, { maxBytes, maxLongEdge });
  if (validationFailure) return validationFailure;

  return {
    id,
    localUri: stored.localUri,
    mimeType: stored.mimeType,
    byteSize: stored.byteSize,
  };
}

async function cleanupPersistentAssets(
  dependencies: ReceiptCaptureDependencies,
  localUris: readonly string[],
): Promise<ReceiptCaptureFailure | null> {
  for (const localUri of localUris) {
    try {
      await dependencies.fileSystem.deleteLocalFile(localUri);
    } catch (error: unknown) {
      return asFailure(error, 'capture_cleanup_failed');
    }
  }
  return null;
}

/** Captures image pages and normalizes them into durable app storage without invoking OCR. */
export async function captureReceiptPages(
  input: CaptureReceiptPagesInput,
  dependencies: ReceiptCaptureDependencies,
): Promise<ReceiptCaptureResult> {
  const now = dependencies.now ?? DEFAULT_CLOCK;
  const maxBytes = input.maxBytes ?? RECEIPT_MAX_ASSET_BYTES;
  const maxLongEdge = input.maxLongEdge ?? RECEIPT_MAX_IMAGE_LONG_EDGE;
  const jpegQuality = input.jpegQuality ?? RECEIPT_IMAGE_NORMALIZATION_QUALITY;
  const persistedUris: string[] = [];
  let sourceUriForCleanup: string | null = null;

  try {
    const pending = await dependencies.imagePicker.getPendingResultAsync();
    let response = pending;

    if (response === null) {
      const permission =
        input.source === 'camera'
          ? await dependencies.imagePicker.requestCameraPermissionsAsync()
          : await dependencies.imagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        return { kind: 'permission_denied', source: input.source };
      }

      response =
        input.source === 'camera'
          ? await dependencies.imagePicker.launchCameraAsync(pickerOptions(input.source))
          : await dependencies.imagePicker.launchImageLibraryAsync(pickerOptions(input.source));
    }

    const terminalResult = failureFromPickerResponse(input.source, response);
    if (terminalResult) return terminalResult;
    if (!response || isPickerError(response) || response.canceled || response.assets.length === 0) {
      return { kind: 'cancelled', source: input.source };
    }

    const pages = [];
    for (const [pageIndex, asset] of response.assets.entries()) {
      sourceUriForCleanup = asset.uri;
      const persisted = await persistAsset(
        input,
        asset,
        pageIndex,
        dependencies,
        maxBytes,
        maxLongEdge,
        jpegQuality,
      );
      if ('code' in persisted) {
        let cleanupFailure: ReceiptCaptureFailure | null = null;
        try {
          await dependencies.fileSystem.cleanupSourceUri(asset.uri);
        } catch (cleanupError: unknown) {
          cleanupFailure = asFailure(cleanupError, 'capture_cleanup_failed');
        }
        cleanupFailure ??= await cleanupPersistentAssets(dependencies, persistedUris);
        return captureFailure(
          input.source,
          cleanupFailure?.code ?? persisted.code,
          cleanupFailure?.message ?? persisted.message,
        );
      }
      pages.push(persisted);
      persistedUris.push(persisted.localUri);
      await dependencies.fileSystem.cleanupSourceUri(asset.uri);
      sourceUriForCleanup = null;
    }

    const createdAt = input.createdAt ?? now().toISOString();
    const updatedAt = input.updatedAt ?? createdAt;
    return {
      kind: 'captured',
      draft: createReceiptCaptureDraft({
        id: input.captureId,
        source: input.source,
        pages,
        createdAt,
        updatedAt,
      }),
    };
  } catch (error: unknown) {
    let cleanupFailure: ReceiptCaptureFailure | null = null;
    if (sourceUriForCleanup) {
      try {
        await dependencies.fileSystem.cleanupSourceUri(sourceUriForCleanup);
      } catch (cleanupError: unknown) {
        cleanupFailure = asFailure(cleanupError, 'capture_cleanup_failed');
      }
    }
    cleanupFailure ??= await cleanupPersistentAssets(dependencies, persistedUris);
    return {
      kind: 'failed',
      source: input.source,
      failure: cleanupFailure ?? asFailure(error, 'capture_failed'),
    };
  }
}
