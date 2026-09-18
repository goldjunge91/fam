import * as Location from 'expo-location';
import { useEffect, useState } from 'react';
import { AppState, Linking, Switch, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { Button, Press, Txt } from '@/constants/ui';
import { useMicrophonePermission } from '@/lib/platform/microphone-permissions';
import {
  getNotificationPermissionStatus,
  type NotificationPermissionStatus,
  requestNotificationPermissions,
} from '@/lib/platform/notifications';
import { useOnboarding } from '../onboarding-store';

// Defensiver Import: expo-camera ist nur in einem nativen Dev-Build verfügbar.
// Gleiches Hook-Pattern wie in barcode-scanner-modal.tsx, damit der Systemdialog
// wirklich über die native Kamera-API ausgelöst wird.
type CameraPermission = { granted: boolean; canAskAgain: boolean };
type CameraPermissionHook = () => [
  CameraPermission | null,
  () => Promise<CameraPermission>,
  () => Promise<CameraPermission>,
];

let useCameraPermissionsHook: CameraPermissionHook = () => [
  null,
  async () => ({ granted: false, canAskAgain: false }),
  async () => ({ granted: false, canAskAgain: false }),
];
try {
  const ExpoCamera = require('expo-camera');
  if (ExpoCamera?.useCameraPermissions) {
    useCameraPermissionsHook = ExpoCamera.useCameraPermissions;
  }
} catch {
  // Kein natives Modul verfügbar (z. B. Expo Go) — Fallback bleibt aktiv.
}

interface PermissionsStepFormProps {
  onNext: () => void;
  onSkip: () => void;
}

const styles = StyleSheet.create((theme) => ({
  root: {
    gap: theme.space.lg,
  },
  list: {
    gap: theme.space.sm,
    marginTop: theme.space.xs,
  },
  card: {
    padding: theme.space.lg,
    borderWidth: theme.borderWidth.base,
    borderRadius: theme.radius.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  text: {
    flex: 1,
    paddingRight: theme.space.sm,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: theme.space.sm,
    marginTop: theme.space.lg,
  },
  flex: {
    flex: 1,
  },
}));

export function PermissionsStepForm({ onNext, onSkip }: PermissionsStepFormProps) {
  const { updatePermissionsData } = useOnboarding();
  const [cameraPermission, requestCameraPermission, getCameraPermission] =
    useCameraPermissionsHook();
  const [microphonePermission, requestMicrophonePermission] = useMicrophonePermission();
  const [locationPermission, requestLocationPermission, getLocationPermission] =
    Location.useForegroundPermissions();

  const [notificationPermission, setNotificationPermission] =
    useState<NotificationPermissionStatus>({
      granted: false,
      canAskAgain: true,
    });

  useEffect(() => {
    let active = true;

    async function refreshNotifications() {
      const nextStatus = await getNotificationPermissionStatus();
      if (active) setNotificationPermission(nextStatus);
    }

    void refreshNotifications();
    const subscription = AppState.addEventListener('change', (appState) => {
      if (appState === 'active') void refreshNotifications();
    });

    return () => {
      active = false;
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (appState) => {
      if (appState !== 'active') return;
      void getCameraPermission();
      void getLocationPermission();
    });

    return () => subscription.remove();
  }, [getCameraPermission, getLocationPermission]);

  // Spiegelt den echten Systemstatus wider, sobald einmal abgefragt wurde.
  const notifications = notificationPermission.granted;
  const camera = cameraPermission?.granted ?? false;
  const microphone = microphonePermission?.granted ?? false;
  const location = locationPermission?.granted ?? false;

  const handleToggleNotifications = async (value: boolean) => {
    if (!value) {
      if (notifications) Linking.openSettings();
      return;
    }
    if (!notificationPermission.canAskAgain) {
      Linking.openSettings();
      return;
    }
    // Löst den echten System-Dialog sofort beim Umschalten aus, nicht erst bei "Weiter".
    await requestNotificationPermissions();
    setNotificationPermission(await getNotificationPermissionStatus());
  };

  // Apps können iOS/Android-Berechtigungen nicht selbst zurücknehmen — beim
  // Versuch, eine bereits erteilte Berechtigung auszuschalten, bleibt nur der
  // Weg über die Systemeinstellungen.
  const handleToggleCamera = async (value: boolean) => {
    if (!value) {
      if (camera) Linking.openSettings();
      return;
    }
    if (cameraPermission != null && !cameraPermission.canAskAgain) {
      Linking.openSettings();
      return;
    }
    // Löst den echten Kamera-Permission-Dialog sofort beim Umschalten aus.
    await requestCameraPermission();
  };

  const handleToggleLocation = async (value: boolean) => {
    if (!value) {
      if (location) Linking.openSettings();
      return;
    }
    if (locationPermission != null && !locationPermission.canAskAgain) {
      Linking.openSettings();
      return;
    }
    await requestLocationPermission();
  };

  const handleToggleMicrophone = async (value: boolean) => {
    if (!value) {
      if (microphone) Linking.openSettings();
      return;
    }
    if (microphonePermission != null && !microphonePermission.canAskAgain) {
      Linking.openSettings();
      return;
    }
    await requestMicrophonePermission();
  };

  const handleNext = () => {
    updatePermissionsData({
      notificationsRequested: notifications,
      cameraRequested: camera,
      microphoneRequested: microphone,
      locationRequested: location,
    });
    onNext();
  };

  return (
    <View style={styles.root}>
      <Txt variant="subheading" weight="700">
        Erlaubnisse & Funktionen
      </Txt>
      <Txt variant="body" tone="secondary">
        Damit die App optimal funktioniert, empfehlen wir folgende Berechtigungen:
      </Txt>

      <View style={styles.list}>
        <Press
          onPress={() => void handleToggleNotifications(!notifications)}
          accessibilityRole="switch"
          accessibilityLabel="Benachrichtigungen"
          accessibilityState={{ checked: notifications }}
          haptic="selection"
          selected={notifications}
          style={styles.card}>
          <View style={styles.row}>
            <View style={styles.text}>
              <Txt variant="body" weight="700" tone="primary">
                🔔 Benachrichtigungen
              </Txt>
              <Txt variant="label" tone="secondary">
                Erhalte rechtzeitige Erinnerungen, bevor Lebensmittel im Kühlschrank ablaufen.
              </Txt>
            </View>
            <Switch value={notifications} accessible={false} pointerEvents="none" />
          </View>
        </Press>

        <Press
          onPress={() => void handleToggleCamera(!camera)}
          accessibilityRole="switch"
          accessibilityLabel="Kamera-Zugriff"
          accessibilityState={{ checked: camera }}
          haptic="selection"
          selected={camera}
          style={styles.card}>
          <View style={styles.row}>
            <View style={styles.text}>
              <Txt variant="body" weight="700" tone="primary">
                📷 Kamera-Zugriff
              </Txt>
              <Txt variant="label" tone="secondary">
                Scanne Barcodes von Lebensmitteln oder QR-Codes für den Haushaltsbeitritt.
              </Txt>
            </View>
            <Switch value={camera} accessible={false} pointerEvents="none" />
          </View>
        </Press>

        <Press
          onPress={() => void handleToggleMicrophone(!microphone)}
          accessibilityRole="switch"
          accessibilityLabel="Mikrofon-Zugriff"
          accessibilityState={{ checked: microphone }}
          haptic="selection"
          selected={microphone}
          style={styles.card}>
          <View style={styles.row}>
            <View style={styles.text}>
              <Txt variant="body" weight="700" tone="primary">
                🎙️ Mikrofon-Zugriff
              </Txt>
              <Txt variant="label" tone="secondary">
                Für die Spracheingabe in der Einkaufsliste.
              </Txt>
            </View>
            <Switch value={microphone} accessible={false} pointerEvents="none" />
          </View>
        </Press>

        <Press
          onPress={() => void handleToggleLocation(!location)}
          accessibilityRole="switch"
          accessibilityLabel="Standort-Zugriff"
          accessibilityState={{ checked: location }}
          haptic="selection"
          selected={location}
          style={styles.card}>
          <View style={styles.row}>
            <View style={styles.text}>
              <Txt variant="body" weight="700" tone="primary">
                📍 Standort-Zugriff
              </Txt>
              <Txt variant="label" tone="secondary">
                Für Prospekte aus deiner Umgebung.
              </Txt>
            </View>
            <Switch value={location} accessible={false} pointerEvents="none" />
          </View>
        </Press>
      </View>

      <View style={styles.buttonRow}>
        <View style={styles.flex}>
          <Button title="Weiter" onPress={handleNext} />
        </View>
        <View style={styles.flex}>
          <Button title="Jetzt nicht" variant="secondary" onPress={onSkip} />
        </View>
      </View>
    </View>
  );
}
