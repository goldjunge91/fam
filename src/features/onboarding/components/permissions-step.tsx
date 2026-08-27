import { useState } from 'react';
import { Pressable, Switch, Text, View } from 'react-native';
import { Button } from '@/components/ui/buttons';
import { requestNotificationPermissions } from '@/lib/notifications';
import { useOnboarding } from '../onboarding-store';

// Defensiver Import: expo-camera ist nur in einem nativen Dev-Build verfügbar.
// Gleiches Hook-Pattern wie in barcode-scanner-modal.tsx, damit der Systemdialog
// wirklich über die native Kamera-API ausgelöst wird.
// biome-ignore lint/suspicious/noExplicitAny: Dynamic Expo Camera Module
let useCameraPermissionsHook: any = () => [null, async () => ({ granted: false })];
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

  const [notifications, setNotifications] = useState(
    state.permissions.notificationsRequested ?? true,
  );

  // Spiegelt den echten Systemstatus wider, sobald einmal abgefragt wurde.
  const camera = cameraPermission?.granted ?? state.permissions.cameraRequested ?? false;

  const handleToggleNotifications = async (value: boolean) => {
    setNotifications(value);
    if (!value) return;
    // Löst den echten System-Dialog sofort beim Umschalten aus, nicht erst bei "Weiter".
    const granted = await requestNotificationPermissions();
    if (!granted) setNotifications(false);
  };

  const handleToggleCamera = async (value: boolean) => {
    if (!value) return;
    // Löst den echten Kamera-Permission-Dialog sofort beim Umschalten aus.
    await requestCameraPermission();
  };

  const handleNext = () => {
    updatePermissionsData({
      notificationsRequested: notifications,
      cameraRequested: camera,
    });
    onNext();
  };

  return (
    <View className="gap-three">
      <Text className="perm-heading">Erlaubnisse & Funktionen</Text>
      <Text className="perm-subheading">
        Damit die App optimal funktioniert, empfehlen wir folgende Berechtigungen:
      </Text>

      <View className="perm-list">
        <Pressable
          onPress={() => handleToggleNotifications(!notifications)}
          className={`perm-card ${notifications ? 'perm-card-selected' : 'perm-card-idle'}`}>
          <View className="perm-row">
            <View className="perm-text-col">
              <Text className="perm-title">🔔 Benachrichtigungen</Text>
              <Text className="perm-desc">
                Erhalte rechtzeitige Erinnerungen, bevor Lebensmittel im Kühlschrank ablaufen.
              </Text>
            </View>
            <Switch value={notifications} onValueChange={handleToggleNotifications} />
          </View>
        </Pressable>

        <Pressable
          onPress={() => handleToggleCamera(!camera)}
          className={`perm-card ${camera ? 'perm-card-selected' : 'perm-card-idle'}`}>
          <View className="perm-row">
            <View className="perm-text-col">
              <Text className="perm-title">📷 Kamera-Zugriff</Text>
              <Text className="perm-desc">
                Scanne Barcodes von Lebensmitteln oder QR-Codes für den Haushaltsbeitritt.
              </Text>
            </View>
            <Switch value={camera} onValueChange={handleToggleCamera} />
          </View>
        </Pressable>
      </View>

      <View className="perm-button-row">
        <View className="flex-1">
          <Button label="Weiter" onPress={handleNext} />
        </View>
        <View className="flex-1">
          <Button label="Jetzt nicht" variant="secondary" onPress={onSkip} />
        </View>
      </View>
    </View>
  );
}
