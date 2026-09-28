import Constants from 'expo-constants';
import type { RecognitionResult } from 'expo-mlkit-ocr';
import { requireOptionalNativeModule } from 'expo-modules-core';

type ExpoMlkitOcrModule = {
  isSupported(): boolean;
  recognizeText(uri: string): Promise<RecognitionResult>;
};

const nativeModule = requireOptionalNativeModule<ExpoMlkitOcrModule>('ExpoMlkitOcr');

export function isGoogleMlKitAvailable(): boolean {
  try {
    return (
      Constants.expoConfig?.extra?.iosMlKitOcrEnabled === true &&
      (nativeModule?.isSupported() ?? false)
    );
  } catch {
    return false;
  }
}

export async function recognizeWithGoogleMlKit(uri: string): Promise<RecognitionResult> {
  if (!isGoogleMlKitAvailable() || !nativeModule) {
    throw new Error('MLKIT_NOT_ENABLED: This iOS build does not include Google ML Kit OCR.');
  }
  return nativeModule.recognizeText(uri);
}
