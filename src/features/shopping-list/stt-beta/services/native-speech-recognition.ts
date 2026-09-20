import { ExpoSpeechRecognitionModule } from 'expo-speech-recognition';
import {
  createSpeechRecognitionAdapter,
  type SpeechRecognitionAdapter,
} from './speech-recognition-adapter';

export type SpeechRecognizerPermissionResponse = {
  granted: boolean;
  canAskAgain?: boolean;
  status?: string;
};

const UNAVAILABLE_SPEECH_RECOGNIZER_PERMISSION: SpeechRecognizerPermissionResponse = {
  granted: false,
  canAskAgain: false,
};

function normalizeSpeechRecognizerPermission(
  permission: SpeechRecognizerPermissionResponse,
): SpeechRecognizerPermissionResponse {
  return {
    granted: permission.granted,
    canAskAgain: permission.canAskAgain ?? true,
    ...(permission.status ? { status: permission.status } : {}),
  };
}

/** Reads the OS permission that allows Apple's speech recognizer to transcribe audio on iOS. */
export async function getSpeechRecognizerPermissions(): Promise<SpeechRecognizerPermissionResponse> {
  try {
    return normalizeSpeechRecognizerPermission(
      await ExpoSpeechRecognitionModule.getSpeechRecognizerPermissionsAsync(),
    );
  } catch {
    return UNAVAILABLE_SPEECH_RECOGNIZER_PERMISSION;
  }
}

/** Requests the OS permission for network-backed speech recognition. */
export async function requestSpeechRecognizerPermissions(): Promise<SpeechRecognizerPermissionResponse> {
  try {
    return normalizeSpeechRecognizerPermission(
      await ExpoSpeechRecognitionModule.requestSpeechRecognizerPermissionsAsync(),
    );
  } catch {
    return UNAVAILABLE_SPEECH_RECOGNIZER_PERMISSION;
  }
}

/**
 * Native binding for the speech adapter. Network-backed recognition is allowed on iOS after the
 * speech-recognizer permission is granted. See the package permission contract:
 * https://github.com/jamsch/expo-speech-recognition#requestspeechrecognizerpermissionsasync
 */
export const nativeSpeechRecognitionAdapter: SpeechRecognitionAdapter =
  createSpeechRecognitionAdapter(ExpoSpeechRecognitionModule);
