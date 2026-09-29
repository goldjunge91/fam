export type ReceiptPoint = { x: number; y: number };
export type ReceiptQuad = readonly [ReceiptPoint, ReceiptPoint, ReceiptPoint, ReceiptPoint];

export type ReceiptPixels = {
  buffer: ArrayBuffer;
  width: number;
  height: number;
  pixelFormat: string;
};

export type ReceiptSectionDetection = {
  quad: ReceiptQuad;
  topEdge: 'observed' | 'estimated';
};

// 002. Checks whether the detected receipt quadrilateral exceeds correction thresholds.
export function needsReceiptPerspectiveCorrection(
  quad: ReceiptQuad,
  imageWidth: number,
  imageHeight: number,
): boolean {
  const [topLeft, topRight, bottomRight, bottomLeft] = quad;
  const topWidth = topRight.x - topLeft.x;
  const bottomWidth = bottomRight.x - bottomLeft.x;
  return (
    Math.abs(topLeft.y - topRight.y) > imageHeight * 0.01 ||
    Math.abs(bottomLeft.x - topLeft.x) > imageWidth * 0.02 ||
    Math.abs(bottomRight.x - topRight.x) > imageWidth * 0.02 ||
    Math.abs(bottomWidth - topWidth) > imageWidth * 0.03
  );
}

// 003. Maps a supported pixel format to its red, green, and blue byte positions.
function colorChannels(format: string): readonly [number, number, number] | null {
  switch (format) {
    case 'RGBA':
    case 'RGBX':
      return [0, 1, 2];
    case 'BGRA':
    case 'BGRX':
      return [2, 1, 0];
    case 'ARGB':
    case 'XRGB':
      return [1, 2, 3];
    case 'ABGR':
    case 'XBGR':
      return [3, 2, 1];
    default:
      return null;
  }
}

// 004. Converts supported four-channel pixels to grayscale or rejects malformed data.
function grayscale(pixels: ReceiptPixels): Uint8Array | null {
  const channels = colorChannels(pixels.pixelFormat);
  if (!channels || pixels.width * pixels.height * 4 !== pixels.buffer.byteLength) return null;
  const source = new Uint8Array(pixels.buffer);
  const gray = new Uint8Array(pixels.width * pixels.height);
  for (let index = 0; index < gray.length; index += 1) {
    const offset = index * 4;
    gray[index] =
      ((source[offset + channels[0]] ?? 0) * 54 +
        (source[offset + channels[1]] ?? 0) * 183 +
        (source[offset + channels[2]] ?? 0) * 19) >>
      8;
  }
  return gray;
}

// 005. Smooths grayscale pixels with a separable nine-pixel box filter.
function blur(gray: Uint8Array, width: number, height: number): Uint8Array {
  const horizontal = new Uint8Array(gray.length);
  const result = new Uint8Array(gray.length);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let sum = 0;
      let count = 0;
      for (let dx = -4; dx <= 4; dx += 1) {
        const sample = gray[y * width + Math.max(0, Math.min(width - 1, x + dx))];
        sum += sample ?? 0;
        count += 1;
      }
      horizontal[y * width + x] = Math.round(sum / count);
    }
  }
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let sum = 0;
      for (let dy = -4; dy <= 4; dy += 1) {
        sum += horizontal[Math.max(0, Math.min(height - 1, y + dy)) * width + x] ?? 0;
      }
      result[y * width + x] = Math.round(sum / 9);
    }
  }
  return result;
}

// 006. Returns the middle value after sorting the supplied brightness samples.
function median(values: number[]): number {
  values.sort((left, right) => left - right);
  return values[Math.floor(values.length / 2)] ?? 0;
}

// 007. Fits a receipt side as x = slope * y + intercept when samples are sufficient.
function fitSide(samples: readonly ReceiptPoint[]): { slope: number; intercept: number } | null {
  if (samples.length < 8) return null;
  const meanY = samples.reduce((sum, point) => sum + point.y, 0) / samples.length;
  const meanX = samples.reduce((sum, point) => sum + point.x, 0) / samples.length;
  const variance = samples.reduce((sum, point) => sum + (point.y - meanY) ** 2, 0);
  if (variance === 0) return null;
  const slope =
    samples.reduce((sum, point) => sum + (point.y - meanY) * (point.x - meanX), 0) / variance;
  return { slope, intercept: meanX - slope * meanY };
}

// 008. Finds the first bright paper pixel along a vertical probe near the image top.
function firstPaperRow(
  gray: Uint8Array,
  width: number,
  height: number,
  x: number,
  threshold: number,
): number | null {
  const column = Math.round(x);
  for (let y = 0; y < Math.floor(height * 0.22); y += 1) {
    if ((gray[y * width + column] ?? 0) >= threshold) return y;
  }
  return null;
}

// 009. Detects long receipt sides and reports whether the top edge was observed or estimated.
export function detectReceiptSection(pixels: ReceiptPixels): ReceiptSectionDetection | null {
  const { width, height } = pixels;
  if (
    !Number.isSafeInteger(width) ||
    !Number.isSafeInteger(height) ||
    width < 100 ||
    height < 100
  ) {
    return null;
  }
  const source = grayscale(pixels);
  if (!source) return null;
  const gray = blur(source, width, height);
  const rows = Array.from({ length: 19 }, (_, index) => Math.round(((index + 1) * height) / 20));
  const border: number[] = [];
  const center: number[] = [];
  const borderWidth = Math.max(1, Math.floor(width * 0.05));
  for (const y of rows) {
    for (let x = 0; x < borderWidth; x += 1) {
      border.push(gray[y * width + x] ?? 0, gray[y * width + width - 1 - x] ?? 0);
    }
    for (let x = Math.floor(width * 0.4); x < Math.ceil(width * 0.6); x += 1) {
      center.push(gray[y * width + x] ?? 0);
    }
  }
  const outside = median(border);
  const paper = median(center);
  if (paper - outside < 45) return null;
  const threshold = (outside + paper) / 2;
  const leftSamples: ReceiptPoint[] = [];
  const rightSamples: ReceiptPoint[] = [];
  const middle = Math.floor(width / 2);
  for (const y of rows) {
    if ((gray[y * width + middle] ?? 0) < threshold) continue;
    let left = middle;
    let right = middle;
    while (left > 0 && (gray[y * width + left - 1] ?? 0) >= threshold) left -= 1;
    while (right < width - 1 && (gray[y * width + right + 1] ?? 0) >= threshold) right += 1;
    if (right - left < width * 0.4 || left < width * 0.015 || right > width * 0.985) continue;
    leftSamples.push({ x: left, y });
    rightSamples.push({ x: right, y });
  }
  const roughLeft = fitSide(leftSamples);
  const roughRight = fitSide(rightSamples);
  if (!roughLeft || !roughRight) return null;
  const left = fitSide(
    leftSamples.filter(
      (point) => Math.abs(point.x - roughLeft.slope * point.y - roughLeft.intercept) < width * 0.06,
    ),
  );
  const right = fitSide(
    rightSamples.filter(
      (point) =>
        Math.abs(point.x - roughRight.slope * point.y - roughRight.intercept) < width * 0.06,
    ),
  );
  if (!left || !right) return null;
  // 010. Projects a vertical coordinate onto the fitted left receipt edge.
  const leftAt = (y: number) => left.slope * y + left.intercept;
  // 011. Projects a vertical coordinate onto the fitted right receipt edge.
  const rightAt = (y: number) => right.slope * y + right.intercept;
  const topWidth = rightAt(0) - leftAt(0);
  const bottomWidth = rightAt(height - 1) - leftAt(height - 1);
  if (
    Math.min(topWidth, bottomWidth) < width * 0.4 ||
    Math.max(topWidth, bottomWidth) / Math.min(topWidth, bottomWidth) > 1.5 ||
    leftAt(0) < 0 ||
    rightAt(0) >= width ||
    leftAt(height - 1) < 0 ||
    rightAt(height - 1) >= width
  ) {
    return null;
  }
  const innerLeft = leftAt(0) + topWidth * 0.08;
  const innerRight = rightAt(0) - topWidth * 0.08;
  const observedLeftTop = firstPaperRow(gray, width, height, innerLeft, threshold);
  const observedRightTop = firstPaperRow(gray, width, height, innerRight, threshold);
  const observedTop = observedLeftTop ?? observedRightTop ?? 0;
  const topSlope =
    observedLeftTop !== null && observedRightTop !== null
      ? (observedRightTop - observedLeftTop) / (innerRight - innerLeft)
      : 0;
  const estimatedTopLeft = Math.max(0, observedTop + topSlope * (leftAt(0) - innerLeft));
  const estimatedTopRight = Math.max(0, observedTop + topSlope * (rightAt(0) - innerLeft));
  const topLeftY = Math.min(height * 0.22, estimatedTopLeft);
  const topRightY = Math.min(height * 0.22, estimatedTopRight);
  return {
    topEdge: observedLeftTop !== null && observedRightTop !== null ? 'observed' : 'estimated',
    quad: [
      { x: leftAt(topLeftY), y: topLeftY },
      { x: rightAt(topRightY), y: topRightY },
      { x: rightAt(height - 1), y: height - 1 },
      { x: leftAt(height - 1), y: height - 1 },
    ],
  };
}

// 012. Exposes only the detected quadrilateral for callers that do not need edge confidence.
export function detectReceiptSectionQuad(pixels: ReceiptPixels): ReceiptQuad | null {
  return detectReceiptSection(pixels)?.quad ?? null;
}
