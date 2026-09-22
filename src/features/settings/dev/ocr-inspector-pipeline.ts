import type { ReceiptCaptureFileAdapter } from '@/features/ocr/capture/capture/contracts';
import { normalizeReceiptOcrResult, type ReceiptOcrResult } from '@/features/ocr/processing/native';

export type InspectorRecognitionLevel = 'accurate' | 'fast';
export type InspectorLanguage = 'auto' | 'de-DE' | 'en-US' | 'fr-FR';
export type InspectorResize = 'source' | '1600' | '2400' | '3200';
export type InspectorCrop = 'none' | 'edges-2' | 'edges-5';
export type InspectorColorMode = 'color' | 'grayscale';
export type InspectorContrast = 'none' | 'low' | 'high';
export type InspectorSharpen = 'off' | 'medium';
export type InspectorQuality = 'source' | 'low' | 'standard' | 'max';

export type InspectorImageSettings = {
  resize: InspectorResize;
  crop: InspectorCrop;
  colorMode: InspectorColorMode;
  contrast: InspectorContrast;
  sharpen: InspectorSharpen;
  quality: InspectorQuality;
};

export type InspectorNativeOcrSettings = {
  languages: readonly string[];
  recognitionLevel: InspectorRecognitionLevel;
  usesLanguageCorrection: boolean;
  customWords: readonly string[];
};

export type PreparedInspectorImage = {
  localUri: string;
  width: number;
  height: number;
  byteSize: number;
  ownsFile: boolean;
};

type NitroImageModule = Pick<typeof import('react-native-nitro-image'), 'Images' | 'loadImage'>;
type ExpoAiKitModule = Pick<typeof import('expo-ai-kit'), 'recognizeText'>;
type ExpoImageModule = Pick<typeof import('expo-image'), 'Image'>;

type ChannelLayout = {
  stride: 3 | 4;
  red: number;
  green: number;
  blue: number;
  alpha: number | null;
};

const RESIZE_LONG_EDGES: Record<InspectorResize, number | null> = {
  source: null,
  '1600': 1_600,
  '2400': 2_400,
  '3200': 3_200,
};

const CROP_MARGINS: Record<InspectorCrop, number> = {
  none: 0,
  'edges-2': 0.02,
  'edges-5': 0.05,
};

const JPEG_QUALITY: Record<InspectorQuality, number | null> = {
  source: null,
  low: 55,
  standard: 82,
  max: 100,
};

export function parseInspectorCustomWords(value: string): string[] {
  return [
    ...new Set(
      value
        .split(/[\n,;]/u)
        .map((word) => word.trim())
        .filter(Boolean),
    ),
  ];
}

function loadNitroImage(): NitroImageModule {
  return require('react-native-nitro-image') as NitroImageModule;
}

function loadExpoAiKit(): ExpoAiKitModule {
  return require('expo-ai-kit') as ExpoAiKitModule;
}

function loadExpoImage(): ExpoImageModule {
  return require('expo-image') as ExpoImageModule;
}

function localFilePath(uri: string): string {
  return uri.startsWith('file://') ? uri.slice('file://'.length) : uri;
}

function fileUri(path: string): string {
  return path.startsWith('file://') ? path : `file://${path}`;
}

function channelLayout(pixelFormat: string): ChannelLayout {
  switch (pixelFormat) {
    case 'RGBA':
      return { stride: 4, red: 0, green: 1, blue: 2, alpha: 3 };
    case 'BGRA':
      return { stride: 4, red: 2, green: 1, blue: 0, alpha: 3 };
    case 'ARGB':
      return { stride: 4, red: 1, green: 2, blue: 3, alpha: 0 };
    case 'ABGR':
      return { stride: 4, red: 3, green: 2, blue: 1, alpha: 0 };
    case 'RGB':
      return { stride: 3, red: 0, green: 1, blue: 2, alpha: null };
    case 'BGR':
      return { stride: 3, red: 2, green: 1, blue: 0, alpha: null };
    case 'XRGB':
      return { stride: 4, red: 1, green: 2, blue: 3, alpha: null };
    case 'BGRX':
      return { stride: 4, red: 2, green: 1, blue: 0, alpha: null };
    case 'XBGR':
      return { stride: 4, red: 3, green: 2, blue: 1, alpha: null };
    case 'RGBX':
      return { stride: 4, red: 0, green: 1, blue: 2, alpha: null };
    default:
      throw new Error(`Nicht unterstütztes Pixel-Format für Inspector-Filter: ${pixelFormat}`);
  }
}

function clampChannel(value: number): number {
  return Math.min(255, Math.max(0, Math.round(value)));
}

function contrastFactor(contrast: InspectorContrast): number {
  if (contrast === 'low') return 1.2;
  if (contrast === 'high') return 1.45;
  return 1;
}

function processPixels(
  buffer: ArrayBuffer,
  width: number,
  height: number,
  pixelFormat: string,
  settings: Pick<InspectorImageSettings, 'colorMode' | 'contrast' | 'sharpen'>,
): ArrayBuffer {
  const layout = channelLayout(pixelFormat);
  const pixels = new Uint8Array(buffer.slice(0));
  const expectedLength = width * height * layout.stride;
  if (pixels.length < expectedLength) {
    throw new Error('Der native Bildpuffer ist kürzer als die gemeldete Bildgröße.');
  }

  const factor = contrastFactor(settings.contrast);
  for (let offset = 0; offset < expectedLength; offset += layout.stride) {
    const red = pixels[offset + layout.red] ?? 0;
    const green = pixels[offset + layout.green] ?? 0;
    const blue = pixels[offset + layout.blue] ?? 0;
    const luminance = red * 0.2126 + green * 0.7152 + blue * 0.0722;
    const nextRed = settings.colorMode === 'grayscale' ? luminance : red;
    const nextGreen = settings.colorMode === 'grayscale' ? luminance : green;
    const nextBlue = settings.colorMode === 'grayscale' ? luminance : blue;
    pixels[offset + layout.red] = clampChannel((nextRed - 128) * factor + 128);
    pixels[offset + layout.green] = clampChannel((nextGreen - 128) * factor + 128);
    pixels[offset + layout.blue] = clampChannel((nextBlue - 128) * factor + 128);
  }

  if (settings.sharpen !== 'off' && width > 2 && height > 2) {
    const source = pixels.slice();
    const strength = settings.sharpen === 'medium' ? 0.65 : 0;
    for (let y = 1; y < height - 1; y += 1) {
      for (let x = 1; x < width - 1; x += 1) {
        const center = (y * width + x) * layout.stride;
        const top = ((y - 1) * width + x) * layout.stride;
        const bottom = ((y + 1) * width + x) * layout.stride;
        const left = (y * width + x - 1) * layout.stride;
        const right = (y * width + x + 1) * layout.stride;
        for (const channel of [layout.red, layout.green, layout.blue]) {
          const convolved =
            source[center + channel] * 5 -
            source[top + channel] -
            source[bottom + channel] -
            source[left + channel] -
            source[right + channel];
          pixels[center + channel] = clampChannel(
            source[center + channel] + (convolved - source[center + channel]) * strength,
          );
        }
      }
    }
  }

  return pixels.buffer;
}

function targetDimensions(
  width: number,
  height: number,
  resize: InspectorResize,
): { width: number; height: number } {
  const targetLongEdge = RESIZE_LONG_EDGES[resize];
  if (targetLongEdge === null) return { width, height };
  const currentLongEdge = Math.max(width, height);
  if (currentLongEdge === targetLongEdge) return { width, height };
  const scale = targetLongEdge / currentLongEdge;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

function hasImageChanges(settings: InspectorImageSettings): boolean {
  return (
    settings.resize !== 'source' ||
    settings.crop !== 'none' ||
    settings.colorMode !== 'color' ||
    settings.contrast !== 'none' ||
    settings.sharpen !== 'off' ||
    settings.quality !== 'source'
  );
}

/** Builds a temporary inspector-only image variant and never mutates the source file. */
export async function prepareInspectorImage(
  sourceUri: string,
  settings: InspectorImageSettings,
  fileSystem: Pick<ReceiptCaptureFileAdapter, 'readBytes'>,
): Promise<PreparedInspectorImage> {
  if (!hasImageChanges(settings)) {
    return { localUri: sourceUri, width: 0, height: 0, byteSize: 0, ownsFile: false };
  }

  const { Images, loadImage } = loadNitroImage();
  let image = await loadImage({ filePath: localFilePath(sourceUri) });
  const cropMargin = CROP_MARGINS[settings.crop];
  if (cropMargin > 0) {
    const originX = Math.round(image.width * cropMargin);
    const originY = Math.round(image.height * cropMargin);
    image = await image.cropAsync(originX, originY, image.width - originX, image.height - originY);
  }

  const dimensions = targetDimensions(image.width, image.height, settings.resize);
  if (dimensions.width !== image.width || dimensions.height !== image.height) {
    image = await image.resizeAsync(dimensions.width, dimensions.height);
  }

  const hasPixelChanges =
    settings.colorMode !== 'color' || settings.contrast !== 'none' || settings.sharpen !== 'off';
  if (hasPixelChanges) {
    const raw = await image.toRawPixelDataAsync();
    const processedBuffer = processPixels(
      raw.buffer,
      raw.width,
      raw.height,
      raw.pixelFormat,
      settings,
    );
    image = await Images.loadFromRawPixelDataAsync({
      ...raw,
      buffer: processedBuffer,
    });
  }

  const quality = JPEG_QUALITY[settings.quality] ?? 100;
  const path = await image.saveToTemporaryFileAsync('jpg', quality);
  const localUri = fileUri(path);
  let byteSize = 0;
  try {
    byteSize = (await fileSystem.readBytes(localUri)).byteLength;
  } catch {
    // File metadata is helpful but not required for an OCR diagnostic run.
  }

  return {
    localUri,
    width: image.width,
    height: image.height,
    byteSize,
    ownsFile: true,
  };
}

/** Runs expo-ai-kit directly for inspector-only iOS option experiments. */
export async function recognizeReceiptOcrForInspector(
  uri: string,
  settings: InspectorNativeOcrSettings,
): Promise<ReceiptOcrResult> {
  const aiKit = loadExpoAiKit();
  const imageApi = loadExpoImage();
  const image = await imageApi.Image.loadAsync({ uri });
  const result = await aiKit.recognizeText(
    { uri },
    {
      languages: [...settings.languages],
      recognitionLevel: settings.recognitionLevel,
      usesLanguageCorrection: settings.usesLanguageCorrection,
      customWords: [...settings.customWords],
    },
  );

  return normalizeReceiptOcrResult({
    imageSize: {
      width: image.width * (image.scale ?? 1),
      height: image.height * (image.scale ?? 1),
    },
    lines: result.blocks.flatMap((block) =>
      block.lines.map((line) => ({
        text: line.text,
        confidence: line.confidence ?? null,
        boundingBox: line.bounds,
      })),
    ),
  });
}
