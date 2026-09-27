import type { ReceiptStoredFile } from './contracts';
import { resizeActionForLongEdge, validateNormalizedReceiptImage } from './normalization';

const VALID_IMAGE: ReceiptStoredFile = {
  localUri: 'file:///documents/receipt.jpg',
  mimeType: 'image/jpeg',
  byteSize: 1_000_000,
  width: 2_400,
  height: 1_800,
};

describe('receipt image normalization contract', () => {
  it('resizes a landscape image by its long edge', () => {
    expect(resizeActionForLongEdge(4_032, 3_024, 2_400)).toEqual({
      resize: { width: 2_400 },
    });
  });

  it('resizes a portrait image by its long edge', () => {
    expect(resizeActionForLongEdge(3_024, 4_032, 2_400)).toEqual({
      resize: { height: 2_400 },
    });
  });

  it('does not upscale an image already within the OCR bound', () => {
    expect(resizeActionForLongEdge(1_800, 2_400, 2_400)).toBeNull();
  });

  it('accepts a readable persistent JPEG within the byte and dimension limits', () => {
    expect(
      validateNormalizedReceiptImage(VALID_IMAGE, {
        maxBytes: 5 * 1024 * 1024,
        maxLongEdge: 2_400,
      }),
    ).toBeNull();
  });

  it('accepts an image exactly at both configured limits', () => {
    expect(
      validateNormalizedReceiptImage(
        { ...VALID_IMAGE, byteSize: 5 * 1024 * 1024 },
        { maxBytes: 5 * 1024 * 1024, maxLongEdge: 2_400 },
      ),
    ).toBeNull();
  });

  it('rejects an image one byte over the configured asset limit', () => {
    expect(
      validateNormalizedReceiptImage(
        { ...VALID_IMAGE, byteSize: 5 * 1024 * 1024 + 1 },
        { maxBytes: 5 * 1024 * 1024, maxLongEdge: 2_400 },
      ),
    ).toMatchObject({ code: 'asset_too_large' });
  });

  it('rejects an image one pixel over the configured long-edge limit', () => {
    expect(
      validateNormalizedReceiptImage(
        { ...VALID_IMAGE, width: 2_401 },
        { maxBytes: 5 * 1024 * 1024, maxLongEdge: 2_400 },
      ),
    ).toMatchObject({ code: 'image_too_large' });
  });

  it('rejects output that is not a persistent canonical JPEG', () => {
    expect(
      validateNormalizedReceiptImage(
        { ...VALID_IMAGE, mimeType: 'image/heic' },
        { maxBytes: 5 * 1024 * 1024, maxLongEdge: 2_400 },
      ),
    ).toMatchObject({ code: 'non_canonical_image' });
  });

  it('rejects output that does not point to a persistent local file', () => {
    expect(
      validateNormalizedReceiptImage(
        { ...VALID_IMAGE, localUri: 'data:image/jpeg;base64,synthetic-image-bytes' },
        { maxBytes: 5 * 1024 * 1024, maxLongEdge: 2_400 },
      ),
    ).toMatchObject({ code: 'non_local_asset' });
  });
});
