import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';

import {
  getSpeechRecognizerPermissions,
  requestSpeechRecognizerPermissions,
  type SpeechRecognizerPermissionResponse,
} from './native-speech-recognition';

export type SpeechRecognizerPermissionState = {
  granted: boolean;
  canAskAgain: boolean;
};

const UNAVAILABLE_PERMISSION: SpeechRecognizerPermissionState = {
  granted: false,
  canAskAgain: false,
};

function toPermissionState(
  permission: SpeechRecognizerPermissionResponse,
): SpeechRecognizerPermissionState {
  return {
    granted: permission.granted,
    canAskAgain: permission.canAskAgain ?? true,
  };
}

/** Keeps the iOS speech-recognition permission current while the app is in the foreground. */
export function useSpeechRecognizerPermission(): readonly [
  SpeechRecognizerPermissionState | null,
  () => Promise<SpeechRecognizerPermissionState>,
] {
  const [permission, setPermission] = useState<SpeechRecognizerPermissionState | null>(null);

  const refreshPermission = useCallback(async (): Promise<SpeechRecognizerPermissionState> => {
    const nextPermission = toPermissionState(await getSpeechRecognizerPermissions());
    setPermission(nextPermission);
    return nextPermission;
  }, []);

  const requestPermission = useCallback(async (): Promise<SpeechRecognizerPermissionState> => {
    const nextPermission = toPermissionState(await requestSpeechRecognizerPermissions());
    setPermission(nextPermission);
    return nextPermission;
  }, []);

  useEffect(() => {
    void refreshPermission();

    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active') void refreshPermission();
    });

    return () => subscription.remove();
  }, [refreshPermission]);

  return [permission, requestPermission];
}

export { UNAVAILABLE_PERMISSION };
