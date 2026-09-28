import type { RecognitionResult } from 'expo-mlkit-ocr';

export function isGoogleMlKitAvailable(): boolean {
  return false;
}

export async function recognizeWithGoogleMlKit(_uri: string): Promise<RecognitionResult> {
  throw new Error('Google ML Kit OCR is only available in the iOS receipt test build.');
}
