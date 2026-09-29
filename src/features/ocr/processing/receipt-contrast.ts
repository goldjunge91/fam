type ReceiptPixels = {
  buffer: ArrayBuffer;
  width: number;
  height: number;
  pixelFormat: string;
};
type EnhancedReceiptPixels = Omit<ReceiptPixels, 'pixelFormat'> & { pixelFormat: 'RGBA' };

type ChannelLayout = { stride: number; red: number; green: number; blue: number };

// 056. Describes RGB byte offsets and stride for each supported pixel format.
function channelLayout(format: string): ChannelLayout | null {
  switch (format) {
    case 'RGBA':
    case 'RGBX':
    case 'RGB':
      return { stride: format === 'RGB' ? 3 : 4, red: 0, green: 1, blue: 2 };
    case 'BGRA':
    case 'BGRX':
    case 'BGR':
      return { stride: format === 'BGR' ? 3 : 4, red: 2, green: 1, blue: 0 };
    case 'ARGB':
    case 'XRGB':
      return { stride: 4, red: 1, green: 2, blue: 3 };
    case 'ABGR':
    case 'XBGR':
      return { stride: 4, red: 3, green: 2, blue: 1 };
    default:
      return null;
  }
}

// 057. Applies a local-mean threshold and returns grayscale ink as RGBA pixels.
export function enhanceReceiptSection(pixels: ReceiptPixels): EnhancedReceiptPixels | null {
  const { width, height } = pixels;
  const channels = channelLayout(pixels.pixelFormat);
  if (
    !channels ||
    !Number.isSafeInteger(width) ||
    !Number.isSafeInteger(height) ||
    width <= 0 ||
    height <= 0 ||
    pixels.buffer.byteLength !== width * height * channels.stride
  ) {
    return null;
  }

  const source = new Uint8Array(pixels.buffer);
  const gray = new Uint8Array(width * height);
  const integralWidth = width + 1;
  const integral = new Uint32Array(integralWidth * (height + 1));
  for (let y = 0; y < height; y += 1) {
    let rowSum = 0;
    for (let x = 0; x < width; x += 1) {
      const index = y * width + x;
      const offset = index * channels.stride;
      const luminance = Math.round(
        ((source[offset + channels.red] ?? 0) * 77 +
          (source[offset + channels.green] ?? 0) * 150 +
          (source[offset + channels.blue] ?? 0) * 29) /
          256,
      );
      gray[index] = luminance;
      rowSum += luminance;
      integral[(y + 1) * integralWidth + x + 1] =
        (integral[y * integralWidth + x + 1] ?? 0) + rowSum;
    }
  }

  const result = new ArrayBuffer(width * height * 4);
  const output = new Uint8Array(result);
  const radius = 15;
  for (let y = 0; y < height; y += 1) {
    const top = Math.max(0, y - radius);
    const bottom = Math.min(height, y + radius + 1);
    for (let x = 0; x < width; x += 1) {
      const left = Math.max(0, x - radius);
      const right = Math.min(width, x + radius + 1);
      const sum =
        (integral[bottom * integralWidth + right] ?? 0) -
        (integral[top * integralWidth + right] ?? 0) -
        (integral[bottom * integralWidth + left] ?? 0) +
        (integral[top * integralWidth + left] ?? 0);
      const mean = sum / ((right - left) * (bottom - top));
      const value = (gray[y * width + x] ?? 0) > mean - 12 ? 255 : 0;
      const offset = (y * width + x) * 4;
      output[offset] = value;
      output[offset + 1] = value;
      output[offset + 2] = value;
      output[offset + 3] = 255;
    }
  }
  return { buffer: result, width, height, pixelFormat: 'RGBA' };
}
