type ReceiptPixels = {
  buffer: ArrayBuffer;
  width: number;
  height: number;
  pixelFormat: string;
};
type EnhancedReceiptPixels = Omit<ReceiptPixels, 'pixelFormat'> & { pixelFormat: 'RGBA' };

type ChannelLayout = { stride: number; red: number; green: number; blue: number };

// 066. Finds the grayscale value at which the requested cumulative pixel rank is reached.
function percentile(histogram: Uint32Array, rank: number): number {
  let seen = 0;
  for (let value = 0; value < 256; value += 1) {
    seen += histogram[value] ?? 0;
    if (seen > rank) return value;
  }
  return 255;
}

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

// 057. Stretches the useful receipt grayscale range and returns it as RGBA pixels.
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
  const total = width * height;
  const gray = new Uint8Array(total);
  const histogram = new Uint32Array(256);
  for (let index = 0; index < total; index += 1) {
    const offset = index * channels.stride;
    const luminance =
      ((source[offset + channels.red] ?? 0) * 77 +
        (source[offset + channels.green] ?? 0) * 150 +
        (source[offset + channels.blue] ?? 0) * 29) >>
      8;
    gray[index] = luminance;
    histogram[luminance] = (histogram[luminance] ?? 0) + 1;
  }

  const low = percentile(histogram, total * 0.01);
  const high = percentile(histogram, total * 0.99);
  if (high - low < 16) return null;

  const lut = new Uint8Array(256);
  for (let value = 0; value < 256; value += 1) {
    lut[value] = Math.min(255, Math.max(0, Math.round(((value - low) * 255) / (high - low))));
  }

  const result = new ArrayBuffer(total * 4);
  const output = new Uint8Array(result);
  for (let index = 0; index < total; index += 1) {
    const value = lut[gray[index] ?? 0] ?? 255;
    const offset = index * 4;
    output[offset] = value;
    output[offset + 1] = value;
    output[offset + 2] = value;
    output[offset + 3] = 255;
  }
  return { buffer: result, width, height, pixelFormat: 'RGBA' };
}
