import { ExpoSpeechRecognitionModule } from 'expo-speech-recognition';
import {
  createSpeechRecognitionAdapter,
  type SpeechRecognitionAdapter,
} from './speech-recognition-adapter';

/**
 * T4 native binding. Recognition must stay on-device; the adapter reports missing capability or
 * microphone permission instead of enabling a network fallback. See the package's permission
 * contract: https://github.com/jamsch/expo-speech-recognition#requestmicrophonepermissionsasync
 */
export const nativeSpeechRecognitionAdapter: SpeechRecognitionAdapter =
  createSpeechRecognitionAdapter(ExpoSpeechRecognitionModule);
