import * as Location from 'expo-location';
import { useState } from 'react';
import { Linking, Pressable, Switch, View } from 'react-native';
import { Button, Txt } from '@/constants/ui';
import { requestNotificationPermissions } from '@/lib/notifications';
import { useOnboarding } from '../onboarding-store';

// Defensiver Import: expo-camera ist nur in einem nativen Dev-Build verfügbar.
// Gleiches Hook-Pattern wie in barcode-scanner-modal.tsx, damit der Systemdialog
// wirklich über die native Kamera-API ausgelöst wird.
type CameraPermission = { granted: boolean; canAskAgain: boolean };
type CameraPermissionHook = () => [CameraPermission | null, () => Promise<CameraPermission>];

let useCameraPermissionsHook: CameraPermissionHook = () => [
  null,
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

export function PermissionsStepForm({ onNext, onSkip }: PermissionsStepFormProps) {
  const { state, updatePermissionsData } = useOnboarding();
  const [cameraPermission, requestCameraPermission] = useCameraPermissionsHook();
  const [locationPermission, requestLocationPermission] = Location.useForegroundPermissions();

  const [notifications, setNotifications] = useState(
    state.permissions.notificationsRequested ?? true,
  );

  // Spiegelt den echten Systemstatus wider, sobald einmal abgefragt wurde.
  const camera = cameraPermission?.granted ?? state.permissions.cameraRequested ?? false;
  const location = locationPermission?.granted ?? state.permissions.locationRequested ?? false;

  const handleToggleNotifications = async (value: boolean) => {
    setNotifications(value);
    if (!value) return;
    // Löst den echten System-Dialog sofort beim Umschalten aus, nicht erst bei "Weiter".
    const granted = await requestNotificationPermissions();
    if (!granted) setNotifications(false);
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

  const handleNext = () => {
    updatePermissionsData({
      notificationsRequested: notifications,
      cameraRequested: camera,
      locationRequested: location,
    });
    onNext();
  };

  return (
    <View className="gap-three">
      <Txt variant="subheading" weight="700">
        Erlaubnisse & Funktionen
      </Txt>
      <Txt variant="body" tone="secondary">
        Damit die App optimal funktioniert, empfehlen wir folgende Berechtigungen:
      </Txt>

      <View className="perm-list">
        <Pressable
          onPress={() => handleToggleNotifications(!notifications)}
          className={`perm-card ${notifications ? 'perm-card-selected' : 'perm-card-idle'}`}>
          <View className="perm-row">
            <View className="perm-text-col">
              <Txt variant="body" weight="700" tone={notifications ? 'onAccent' : 'primary'}>
                🔔 Benachrichtigungen
              </Txt>
              <Txt variant="label" tone={notifications ? 'onAccent' : 'secondary'}>
                Erhalte rechtzeitige Erinnerungen, bevor Lebensmittel im Kühlschrank ablaufen.
              </Txt>
            </View>
            <Switch value={notifications} onValueChange={handleToggleNotifications} />
          </View>
        </Pressable>

        <Pressable
          onPress={() => handleToggleCamera(!camera)}
          className={`perm-card ${camera ? 'perm-card-selected' : 'perm-card-idle'}`}>
          <View className="perm-row">
            <View className="perm-text-col">
              <Txt variant="body" weight="700" tone={camera ? 'onAccent' : 'primary'}>
                📷 Kamera-Zugriff
              </Txt>
              <Txt variant="label" tone={camera ? 'onAccent' : 'secondary'}>
                Scanne Barcodes von Lebensmitteln oder QR-Codes für den Haushaltsbeitritt.
              </Txt>
            </View>
            <Switch value={camera} onValueChange={handleToggleCamera} />
          </View>
        </Pressable>

        <Pressable
          onPress={() => handleToggleLocation(!location)}
          className={`perm-card ${location ? 'perm-card-selected' : 'perm-card-idle'}`}>
          <View className="perm-row">
            <View className="perm-text-col">
              <Txt variant="body" weight="700" tone={location ? 'onAccent' : 'primary'}>
                📍 Standort-Zugriff
              </Txt>
              <Txt variant="label" tone={location ? 'onAccent' : 'secondary'}>
                Für Prospekte aus deiner Umgebung.
              </Txt>
            </View>
            <Switch value={location} onValueChange={handleToggleLocation} />
          </View>
        </Pressable>
      </View>

      <View className="perm-button-row">
        <View className="flex-1">
          <Button title="Weiter" onPress={handleNext} />
        </View>
        <View className="flex-1">
          <Button title="Jetzt nicht" variant="secondary" onPress={onSkip} />
        </View>
      </View>
    </View>
  );
}
