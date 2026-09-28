import { enhanceReceiptSection } from './receipt-contrast';

describe('receipt section contrast', () => {
  it('keeps faint ink on both dark and bright paper readable', () => {
    const width = 64;
    const height = 32;
    const buffer = new ArrayBuffer(width * height * 4);
    const source = new Uint8Array(buffer);
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const background = x < width / 2 ? 180 : 240;
        const ink = x === 10 || x === 50;
        const offset = (y * width + x) * 4;
        source.fill(ink ? background - 60 : background, offset, offset + 3);
        source[offset + 3] = 255;
      }
    }

    const enhanced = enhanceReceiptSection({ buffer, width, height, pixelFormat: 'BGRA' });
    if (!enhanced) throw new Error('Expected a supported pixel format');
    const result = new Uint8Array(enhanced.buffer);
    const pixel = (x: number) => result[(16 * width + x) * 4];

    expect(enhanced.pixelFormat).toBe('RGBA');
    expect(pixel(10)).toBe(0);
    expect(pixel(50)).toBe(0);
    expect(pixel(20)).toBe(255);
    expect(pixel(40)).toBe(255);
  });

  it('rejects pixel data with mismatched dimensions', () => {
    expect(
      enhanceReceiptSection({
        buffer: new ArrayBuffer(4),
        width: 2,
        height: 2,
        pixelFormat: 'RGBA',
      }),
    ).toBeNull();
  });
});
