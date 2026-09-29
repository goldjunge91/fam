import type { RecognitionResult } from 'expo-mlkit-ocr';

// 051. Reports ML Kit as unavailable on platforms without the iOS native adapter.
export function isGoogleMlKitAvailable(): boolean {
  return false;
}

// 052. Rejects recognition requests when this platform has no ML Kit implementation.
export async function recognizeWithGoogleMlKit(_uri: string): Promise<RecognitionResult> {
  throw new Error('Google ML Kit OCR is only available in the iOS receipt test build.');
}
