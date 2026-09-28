import { detectReceiptSectionQuad, needsReceiptPerspectiveCorrection } from './receipt-edges';

function partialReceipt(): {
  buffer: ArrayBuffer;
  width: number;
  height: number;
  pixelFormat: 'RGBA';
} {
  const width = 400;
  const height = 600;
  const buffer = new ArrayBuffer(width * height * 4);
  const pixels = new Uint8Array(buffer);
  for (let y = 0; y < height; y += 1) {
    const left = 80 - (20 * y) / (height - 1);
    const right = 320 + (25 * y) / (height - 1);
    for (let x = 0; x < width; x += 1) {
      const top = 20 - (15 * (x - 80)) / 240;
      const brightness = x >= left && x <= right && y >= top ? 220 : 20;
      const offset = (y * width + x) * 4;
      pixels[offset] = brightness;
      pixels[offset + 1] = brightness;
      pixels[offset + 2] = brightness;
      pixels[offset + 3] = 255;
    }
  }
  return { buffer, width, height, pixelFormat: 'RGBA' };
}

describe('detectReceiptSectionQuad', () => {
  it('uses two visible top corners and both sides when the bottom of the receipt is outside the photo', () => {
    const quad = detectReceiptSectionQuad(partialReceipt());

    expect(quad).not.toBeNull();
    if (!quad) return;
    const expected = [
      { x: 80, y: 20 },
      { x: 320, y: 5 },
      { x: 345, y: 599 },
      { x: 60, y: 599 },
    ];
    for (const [index, point] of quad.entries()) {
      expect(Math.abs(point.x - expected[index].x)).toBeLessThan(9);
      expect(Math.abs(point.y - expected[index].y)).toBeLessThan(9);
    }
  });

  it('keeps a photo without distinguishable paper edges unchanged', () => {
    const image = partialReceipt();
    new Uint8Array(image.buffer).fill(180);

    expect(detectReceiptSectionQuad(image)).toBeNull();
  });
});

describe('needsReceiptPerspectiveCorrection', () => {
  it('preserves original pixels when the visible paper edges are nearly straight', () => {
    expect(
      needsReceiptPerspectiveCorrection(
        [
          { x: 52, y: 0 },
          { x: 304, y: 0 },
          { x: 305, y: 499 },
          { x: 50, y: 499 },
        ],
        375,
        500,
      ),
    ).toBe(false);
  });

  it('rectifies a visible perspective shift', () => {
    expect(
      needsReceiptPerspectiveCorrection(
        [
          { x: 80, y: 20 },
          { x: 320, y: 5 },
          { x: 345, y: 599 },
          { x: 60, y: 599 },
        ],
        400,
        600,
      ),
    ).toBe(true);
  });
});
