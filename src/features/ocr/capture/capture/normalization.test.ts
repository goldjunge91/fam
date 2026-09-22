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

  it('rejects output that is not a persistent canonical JPEG', () => {
    expect(
      validateNormalizedReceiptImage(
        { ...VALID_IMAGE, mimeType: 'image/heic' },
        { maxBytes: 5 * 1024 * 1024, maxLongEdge: 2_400 },
      ),
    ).toMatchObject({ code: 'non_canonical_image' });
  });
});
