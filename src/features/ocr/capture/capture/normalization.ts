import type { ReceiptCaptureFailure } from '../domain/types';
import type { ReceiptStoredFile } from './contracts';
import { isLocalReceiptImageUri, RECEIPT_CANONICAL_IMAGE_MIME_TYPE } from './mime';

export type ReceiptImageResizeAction = {
  resize: { width: number } | { height: number };
};

export function resizeActionForLongEdge(
  width: number,
  height: number,
  maxLongEdge: number,
): ReceiptImageResizeAction | null {
  if (
    !Number.isSafeInteger(width) ||
    !Number.isSafeInteger(height) ||
    width <= 0 ||
    height <= 0 ||
    !Number.isSafeInteger(maxLongEdge) ||
    maxLongEdge <= 0
  ) {
    throw new Error('Image dimensions and the long-edge limit must be positive integers.');
  }

  if (Math.max(width, height) <= maxLongEdge) return null;
  return width >= height ? { resize: { width: maxLongEdge } } : { resize: { height: maxLongEdge } };
}

export function validateNormalizedReceiptImage(
  image: ReceiptStoredFile,
  limits: { maxBytes: number; maxLongEdge: number },
): ReceiptCaptureFailure | null {
  if (!isLocalReceiptImageUri(image.localUri)) {
    return { code: 'non_local_asset', message: 'Normalized receipt images must remain local.' };
  }
  if (image.mimeType !== RECEIPT_CANONICAL_IMAGE_MIME_TYPE) {
    return {
      code: 'non_canonical_image',
      message: 'Normalized receipt images must use JPEG as their working format.',
    };
  }
  if (
    !Number.isSafeInteger(image.width) ||
    !Number.isSafeInteger(image.height) ||
    image.width <= 1 ||
    image.height <= 1
  ) {
    return {
      code: 'invalid_dimensions',
      message: 'The normalized receipt image has invalid dimensions.',
    };
  }
  if (Math.max(image.width, image.height) > limits.maxLongEdge) {
    return {
      code: 'image_too_large',
      message: 'The normalized receipt image exceeds the long-edge limit.',
    };
  }
  if (!Number.isSafeInteger(image.byteSize) || image.byteSize <= 0) {
    return {
      code: 'invalid_asset_metadata',
      message: 'The normalized receipt image has invalid byte metadata.',
    };
  }
  if (image.byteSize > limits.maxBytes) {
    return {
      code: 'asset_too_large',
      message: `Receipt images must be at most ${limits.maxBytes} bytes.`,
    };
  }
  return null;
}
