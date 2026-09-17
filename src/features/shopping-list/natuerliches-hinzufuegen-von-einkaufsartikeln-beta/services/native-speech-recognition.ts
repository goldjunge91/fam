import { ExpoSpeechRecognitionModule } from 'expo-speech-recognition';
import {
  createSpeechRecognitionAdapter,
  type SpeechRecognitionAdapter,
} from './speech-recognition-adapter';

/**
 * Beta-only native binding. The caller must provide explicit network-recognition consent when
 * starting a session. See the package's permission contract:
 * https://github.com/jamsch/expo-speech-recognition#requestspeechrecognizerpermissionsasync
 */
export const nativeSpeechRecognitionAdapter: SpeechRecognitionAdapter =
  createSpeechRecognitionAdapter(ExpoSpeechRecognitionModule, {
    requiresOnDeviceRecognition: false,
  });
