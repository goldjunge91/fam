const MIME_TO_EXTENSION = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/heic': 'heic',
  'image/heif': 'heif',
  'image/heic-sequence': 'heic',
  'image/heif-sequence': 'heif',
} as const;

export type ReceiptImageMimeType = keyof typeof MIME_TO_EXTENSION;
export const RECEIPT_CANONICAL_IMAGE_MIME_TYPE = 'image/jpeg' as const;

function extensionFromUri(uri: string): string | null {
  const path = uri.split(/[?#]/, 1)[0] ?? uri;
  const extension = path.slice(path.lastIndexOf('.') + 1).toLowerCase();
  return extension.length > 0 && extension.length <= 5 ? extension : null;
}

function mimeTypeFromExtension(extension: string | null): ReceiptImageMimeType | null {
  if (extension === 'jpg' || extension === 'jpeg') return 'image/jpeg';
  if (extension === 'png') return 'image/png';
  if (extension === 'webp') return 'image/webp';
  if (extension === 'heic') return 'image/heic';
  if (extension === 'heif') return 'image/heif';
  return null;
}

export function normalizeReceiptImageMimeType(
  mimeType: string | null | undefined,
  uri: string,
): ReceiptImageMimeType | null {
  const normalizedMimeType = mimeType?.split(';', 1)[0]?.trim().toLowerCase();
  if (normalizedMimeType === 'image/jpg') return 'image/jpeg';
  if (normalizedMimeType && normalizedMimeType in MIME_TO_EXTENSION) {
    return normalizedMimeType as ReceiptImageMimeType;
  }
  return mimeTypeFromExtension(extensionFromUri(uri));
}

export function receiptImageExtension(mimeType: ReceiptImageMimeType): string {
  return MIME_TO_EXTENSION[mimeType];
}

export function isLocalReceiptImageUri(uri: string): boolean {
  const scheme = uri.split(':', 1)[0]?.toLowerCase();
  return (
    scheme === 'file' || scheme === 'content' || scheme === 'ph' || scheme === 'assets-library'
  );
}
