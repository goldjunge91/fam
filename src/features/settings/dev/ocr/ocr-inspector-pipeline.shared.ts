import { normalizeReceiptOcrResult, type ReceiptOcrResult } from '@/features/ocr/processing/native';

// This module is shared by native and web builds. Native-only image preprocessing
// lives in the platform files so Metro never has to resolve Nitro Image for web.
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

type ExpoAiKitModule = Pick<typeof import('expo-ai-kit'), 'recognizeText'>;
type ExpoImageModule = Pick<typeof import('expo-image'), 'Image'>;

export function parseInspectorCustomWords(value: string): string[] {
  // Keep the input order while removing repeated words from the Vision request.
  return [
    ...new Set(
      value
        .split(/[\n,;]/u)
        .map((word) => word.trim())
        .filter(Boolean),
    ),
  ];
}

function loadExpoAiKit(): ExpoAiKitModule {
  return require('expo-ai-kit') as ExpoAiKitModule;
}

function loadExpoImage(): ExpoImageModule {
  return require('expo-image') as ExpoImageModule;
}

/** Runs inspector-only OCR options that do not depend on Nitro Image. */
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
