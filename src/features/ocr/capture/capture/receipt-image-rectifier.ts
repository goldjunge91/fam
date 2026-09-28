import {
  detectReceiptSectionQuad,
  needsReceiptPerspectiveCorrection,
  type ReceiptPoint,
} from './receipt-edges';

type NitroImageModule = Pick<typeof import('react-native-nitro-image'), 'Images' | 'loadImage'>;
type NativeCvModule = Pick<typeof import('react-native-executorch'), 'cv' | 'tensor'>;

const DETECTION_LONG_EDGE = 500;
const WORKING_LONG_EDGE = 4_032;

function scalePoint(point: ReceiptPoint, xScale: number, yScale: number): ReceiptPoint {
  return { x: point.x * xScale, y: point.y * yScale };
}

function distance(left: ReceiptPoint, right: ReceiptPoint): number {
  return Math.hypot(right.x - left.x, right.y - left.y);
}

/** Returns a temporary local PNG, or null when the visible receipt edges are uncertain. */
export async function rectifyReceiptImage(sourceUri: string): Promise<string | null> {
  if (!sourceUri.startsWith('file://')) return null;
  const { Images, loadImage } = require('react-native-nitro-image') as NitroImageModule;
  const sourceImage = await loadImage({ filePath: sourceUri.slice('file://'.length) });
  const detectionScale = Math.min(
    1,
    DETECTION_LONG_EDGE / Math.max(sourceImage.width, sourceImage.height),
  );
  const preview =
    detectionScale === 1
      ? sourceImage
      : await sourceImage.resizeAsync(
          Math.max(1, Math.round(sourceImage.width * detectionScale)),
          Math.max(1, Math.round(sourceImage.height * detectionScale)),
        );
  const previewPixels = await preview.toRawPixelDataAsync();
  const detected = detectReceiptSectionQuad(previewPixels);
  if (!detected) return null;
  if (!needsReceiptPerspectiveCorrection(detected, preview.width, preview.height)) return null;

  const scaled = detected.map((point) =>
    scalePoint(point, sourceImage.width / preview.width, sourceImage.height / preview.height),
  );
  const left = Math.max(0, Math.floor(Math.min(scaled[0].x, scaled[3].x)) - 8);
  const top = Math.max(0, Math.floor(Math.min(scaled[0].y, scaled[1].y)) - 8);
  const right = Math.min(sourceImage.width, Math.ceil(Math.max(scaled[1].x, scaled[2].x)) + 9);
  const bottom = sourceImage.height;
  if (right - left < 100 || bottom - top < 100) return null;
  const cropped = await sourceImage.cropAsync(left, top, right, bottom);
  const workingScale = Math.min(1, WORKING_LONG_EDGE / Math.max(cropped.width, cropped.height));
  const working =
    workingScale === 1
      ? cropped
      : await cropped.resizeAsync(
          Math.max(1, Math.round(cropped.width * workingScale)),
          Math.max(1, Math.round(cropped.height * workingScale)),
        );
  const pixels = await working.toRawPixelDataAsync();
  if (pixels.buffer.byteLength !== pixels.width * pixels.height * 4) return null;
  const withinWorkingImage = (point: ReceiptPoint) =>
    scalePoint(
      { x: point.x - left, y: point.y - top },
      working.width / cropped.width,
      working.height / cropped.height,
    );
  const quad = [
    withinWorkingImage(scaled[0]),
    withinWorkingImage(scaled[1]),
    withinWorkingImage(scaled[2]),
    withinWorkingImage(scaled[3]),
  ] as const;
  const outputWidth = Math.max(
    1,
    Math.round(Math.max(distance(quad[0], quad[1]), distance(quad[3], quad[2]))),
  );
  const outputHeight = Math.max(
    1,
    Math.round(Math.max(distance(quad[0], quad[3]), distance(quad[1], quad[2]))),
  );
  const { cv, tensor } = require('react-native-executorch') as NativeCvModule;
  const sourceTensor = tensor(
    'uint8',
    [pixels.height, pixels.width, 4],
    new Uint8Array(pixels.buffer),
  );
  let output: Uint8Array;
  try {
    const resultTensor = tensor('uint8', [outputHeight, outputWidth, 4]);
    try {
      cv.rectifyQuad(sourceTensor, resultTensor, quad, {
        contentWidth: outputWidth,
        padValue: 255,
      });
      output = resultTensor.getData(new Uint8Array(outputWidth * outputHeight * 4));
    } finally {
      resultTensor.dispose();
    }
  } finally {
    sourceTensor.dispose();
  }
  const outputBuffer: ArrayBuffer = new ArrayBuffer(output.byteLength);
  new Uint8Array(outputBuffer).set(output);
  const rectified = await Images.loadFromRawPixelDataAsync({
    buffer: outputBuffer,
    width: outputWidth,
    height: outputHeight,
    pixelFormat: pixels.pixelFormat,
  });
  const path = await rectified.saveToTemporaryFileAsync('png');
  return path.startsWith('file://') ? path : `file://${path}`;
}
