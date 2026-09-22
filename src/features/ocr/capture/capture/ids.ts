function requireCaptureId(captureId: string): string {
  if (captureId.trim().length === 0) {
    throw new Error('Capture ID is required.');
  }
  return captureId;
}

function requirePageIndex(pageIndex: number): number {
  if (!Number.isSafeInteger(pageIndex) || pageIndex < 0) {
    throw new Error('Page index must be a non-negative safe integer.');
  }
  return pageIndex;
}

function hash32(value: string, seed: number): number {
  let hash = seed >>> 0;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }
  return hash >>> 0;
}

function wordHex(value: number): string {
  return value.toString(16).padStart(8, '0');
}

/**
 * Stable UUID-shaped identity for one page in a capture.
 * The capture ID must itself be unique for each new draft.
 */
export function receiptCaptureAssetId(captureId: string, pageIndex: number): string {
  const normalizedCaptureId = requireCaptureId(captureId);
  const normalizedPageIndex = requirePageIndex(pageIndex);
  const input = `receipt-capture:${normalizedCaptureId}:page:${normalizedPageIndex}`;
  const hash = [
    hash32(input, 0x811c9dc5),
    hash32(input, 0x9e3779b9),
    hash32(input, 0x243f6a88),
    hash32(input, 0xb7e15162),
  ]
    .map(wordHex)
    .join('');

  const versioned = `${hash.slice(0, 12)}5${hash.slice(13, 16)}`;
  const variantNibble = ['8', '9', 'a', 'b'][Number.parseInt(hash[16] ?? '8', 16) & 3];
  const variant = `${variantNibble}${hash.slice(17)}`;
  return `${versioned.slice(0, 8)}-${versioned.slice(8, 12)}-${versioned.slice(12)}-${variant.slice(0, 4)}-${variant.slice(4)}`;
}
