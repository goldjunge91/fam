import { detectReceiptSection } from '@/features/ocr/capture/capture/receipt-edges';
import type { InspectorGeometryPoint, InspectorReceiptGeometry } from './ocr-inspector-geometry';

type NitroImageModule = Pick<typeof import('react-native-nitro-image'), 'loadImage'>;

function localFilePath(uri: string): string {
  return uri.startsWith('file://') ? uri.slice('file://'.length) : uri;
}

function normalizePoint(
  point: { x: number; y: number },
  width: number,
  height: number,
): InspectorGeometryPoint {
  return {
    x: Math.min(1, Math.max(0, point.x / width)),
    y: Math.min(1, Math.max(0, point.y / height)),
  };
}

/** Runs the same side fallback used by capture and returns normalized overlay points. */
export async function detectInspectorReceiptGeometry(
  uri: string,
): Promise<InspectorReceiptGeometry | null> {
  try {
    const { loadImage } = require('react-native-nitro-image') as NitroImageModule;
    const source = await loadImage({ filePath: localFilePath(uri) });
    const scale = Math.min(1, 500 / Math.max(source.width, source.height));
    const preview =
      scale === 1
        ? source
        : await source.resizeAsync(
            Math.max(1, Math.round(source.width * scale)),
            Math.max(1, Math.round(source.height * scale)),
          );
    const detected = detectReceiptSection(await preview.toRawPixelDataAsync());
    if (!detected) return null;
    const normalized = detected.quad.map((point) =>
      normalizePoint(point, preview.width, preview.height),
    );
    const [topLeft, topRight, bottomRight, bottomLeft] = normalized;
    if (!topLeft || !topRight || !bottomRight || !bottomLeft) return null;
    return {
      method: 'side-fallback',
      topEdge: detected.topEdge,
      quad: [topLeft, topRight, bottomRight, bottomLeft],
    };
  } catch {
    // Geometry is diagnostic only; an OCR run must remain usable when raw pixels are unavailable.
    return null;
  }
}
