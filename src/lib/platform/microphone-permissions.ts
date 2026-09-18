import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';

export type MicrophonePermissionState = {
  granted: boolean;
  canAskAgain: boolean;
};

type PermissionResponse = {
  granted: boolean;
  canAskAgain?: boolean;
};

type MicrophonePermissionModule = {
  getMicrophonePermissionsAsync: () => Promise<PermissionResponse>;
  requestMicrophonePermissionsAsync: () => Promise<PermissionResponse>;
};

const UNAVAILABLE_PERMISSION: MicrophonePermissionState = {
  granted: false,
  canAskAgain: false,
};

/**
 * Lädt das Speech-Modul defensiv, damit Settings und Onboarding auch in einem
 * Build ohne natives Speech-Modul nicht beim Import abstürzen.
 */
function getMicrophonePermissionModule(): MicrophonePermissionModule | null {
  try {
    const imported = require('expo-speech-recognition') as {
      ExpoSpeechRecognitionModule?: MicrophonePermissionModule;
    };
    return imported.ExpoSpeechRecognitionModule ?? null;
  } catch {
    return null;
  }
}

function normalizePermission(permission: PermissionResponse): MicrophonePermissionState {
  return {
    granted: permission.granted,
    canAskAgain: permission.canAskAgain ?? true,
  };
}

/** Liest und aktualisiert die Mikrofonberechtigung für Settings und Onboarding. */
export function useMicrophonePermission(): readonly [
  MicrophonePermissionState | null,
  () => Promise<MicrophonePermissionState>,
] {
  const [permission, setPermission] = useState<MicrophonePermissionState | null>(null);

  const refreshPermission = useCallback(async (): Promise<MicrophonePermissionState> => {
    const module = getMicrophonePermissionModule();
    if (!module) {
      setPermission(UNAVAILABLE_PERMISSION);
      return UNAVAILABLE_PERMISSION;
    }

    try {
      const nextPermission = normalizePermission(await module.getMicrophonePermissionsAsync());
      setPermission(nextPermission);
      return nextPermission;
    } catch {
      setPermission(UNAVAILABLE_PERMISSION);
      return UNAVAILABLE_PERMISSION;
    }
  }, []);

  const requestPermission = useCallback(async (): Promise<MicrophonePermissionState> => {
    const module = getMicrophonePermissionModule();
    if (!module) {
      setPermission(UNAVAILABLE_PERMISSION);
      return UNAVAILABLE_PERMISSION;
    }

    try {
      const nextPermission = normalizePermission(await module.requestMicrophonePermissionsAsync());
      setPermission(nextPermission);
      return nextPermission;
    } catch {
      setPermission(UNAVAILABLE_PERMISSION);
      return UNAVAILABLE_PERMISSION;
    }
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
