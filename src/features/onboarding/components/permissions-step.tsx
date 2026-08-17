import { useState } from 'react';
import { Pressable, Switch, Text, View } from 'react-native';
import { Button } from '@/components/ui/buttons';
import { requestNotificationPermissions } from '@/lib/notifications';
import { useOnboarding } from '../context/onboarding-context';

// Defensiver Import: expo-camera ist nur in einem nativen Dev-Build verfügbar.
// biome-ignore lint/suspicious/noExplicitAny: Dynamic Expo Camera Module
let requestCameraPermissionsAsync: any = null;
try {
  const ExpoCamera = require('expo-camera');
  if (ExpoCamera?.requestCameraPermissionsAsync) {
    requestCameraPermissionsAsync = ExpoCamera.requestCameraPermissionsAsync;
  }
} catch {
  requestCameraPermissionsAsync = null;
}

interface PermissionsStepFormProps {
  onNext: () => void;
  onSkip: () => void;
}

export function PermissionsStepForm({ onNext, onSkip }: PermissionsStepFormProps) {
  const { state, updatePermissionsData } = useOnboarding();

  const [notifications, setNotifications] = useState(
    state.permissions.notificationsRequested ?? true,
  );
  const [camera, setCamera] = useState(state.permissions.cameraRequested ?? true);

  const handlePermissions = async () => {
    // Kamera-Berechtigung anfordern wenn aktiviert
    if (camera && requestCameraPermissionsAsync) {
      try {
        await requestCameraPermissionsAsync();
      } catch {
        // Graceful Fallback — nur im nativen Build verfügbar
      }
    }

    // Benachrichtigungs-Berechtigung anfordern wenn aktiviert
    if (notifications) {
      try {
        await requestNotificationPermissions();
      } catch {
        // Graceful Fallback — nur im nativen Build verfügbar
      }
    }

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
          onPress={() => setNotifications((prev) => !prev)}
          className={`perm-card ${notifications ? 'perm-card-selected' : 'perm-card-idle'}`}>
          <View className="perm-row">
            <View className="perm-text-col">
              <Text className="perm-title">🔔 Benachrichtigungen</Text>
              <Text className="perm-desc">
                Erhalte rechtzeitige Erinnerungen, bevor Lebensmittel im Kühlschrank ablaufen.
              </Text>
            </View>
            <Switch value={notifications} onValueChange={setNotifications} />
          </View>
        </Pressable>

        <Pressable
          onPress={() => setCamera((prev) => !prev)}
          className={`perm-card ${camera ? 'perm-card-selected' : 'perm-card-idle'}`}>
          <View className="perm-row">
            <View className="perm-text-col">
              <Text className="perm-title">📷 Kamera-Zugriff</Text>
              <Text className="perm-desc">
                Scanne Barcodes von Lebensmitteln oder QR-Codes für den Haushaltsbeitritt.
              </Text>
            </View>
            <Switch value={camera} onValueChange={setCamera} />
          </View>
        </Pressable>
      </View>

      <View className="perm-button-row">
        <View className="flex-1">
          <Button label="Festlegen & Weiter" onPress={handlePermissions} />
        </View>
        <View className="flex-1">
          <Button label="Jetzt nicht" variant="secondary" onPress={onSkip} />
        </View>
      </View>
    </View>
  );
}
