import type { RecognitionResult } from 'expo-mlkit-ocr';
import { requireOptionalNativeModule } from 'expo-modules-core';

type ExpoMlkitOcrModule = {
  isSupported(): boolean;
  recognizeText(uri: string): Promise<RecognitionResult>;
};

const nativeModule = requireOptionalNativeModule<ExpoMlkitOcrModule>('ExpoMlkitOcr');

// 053. Checks the installed native module because runtime config may differ after an OTA update.
export function isGoogleMlKitAvailable(): boolean {
  try {
    return nativeModule?.isSupported() ?? false;
  } catch {
    return false;
  }
}

// 054. Runs iOS ML Kit recognition or throws when the native module is unavailable.
export async function recognizeWithGoogleMlKit(uri: string): Promise<RecognitionResult> {
  if (!isGoogleMlKitAvailable() || !nativeModule) {
    throw new Error('MLKIT_NOT_ENABLED: This iOS build does not include Google ML Kit OCR.');
  }
  return nativeModule.recognizeText(uri);
}
