import {
  isLocalReceiptImageUri,
  normalizeReceiptImageMimeType,
  RECEIPT_CANONICAL_IMAGE_MIME_TYPE,
} from './mime';

describe('receipt image MIME contract', () => {
  it('accepts HEIC and HEIF picker inputs without making them upload formats', () => {
    expect(normalizeReceiptImageMimeType('image/heic', 'file:///receipt.HEIC')).toBe('image/heic');
    expect(normalizeReceiptImageMimeType(undefined, 'file:///receipt.heif')).toBe('image/heif');
    expect(RECEIPT_CANONICAL_IMAGE_MIME_TYPE).toBe('image/jpeg');
  });

  it('accepts only local picker URI schemes', () => {
    expect(isLocalReceiptImageUri('file:///receipt.heic')).toBe(true);
    expect(isLocalReceiptImageUri('content://media/external/images/1')).toBe(true);
    expect(isLocalReceiptImageUri('ph://A1B2C3')).toBe(true);
    expect(isLocalReceiptImageUri('https://example.test/receipt.heic')).toBe(false);
    expect(isLocalReceiptImageUri('data:image/heic;base64,AAAA')).toBe(false);
  });
});
