import { View } from 'react-native';
import { Screen } from '@/components/layout/screen';
import { CameraPermissionCard } from '@/features/settings/camera-permission-card';
import { NotificationSettingsCard } from '@/features/settings/notification-settings-card';

/**
 * Sammelseite für alle App-Berechtigungen (Kamera, Benachrichtigungen).
 *
 * Vorher gab es nur eine "Benachrichtigungen"-Seite; die Kamera-Berechtigung
 * ließ sich nach dem Onboarding gar nicht mehr im App-eigenen Menü ansehen
 * oder erneut anfragen, obwohl sie über die Systemeinstellungen jederzeit
 * entzogen werden kann.
 */
export function PermissionsScreen() {
  return (
    <Screen
      title="Berechtigungen"
      back={{ label: 'Einstellungen', href: '/settings' }}
      backStyle="icon">
      <View className="gap-three">
        <CameraPermissionCard />
        {/* Enthält zusätzlich Schwellenwert & Uhrzeit für die Erinnerung */}
        <NotificationSettingsCard />
      </View>
    </Screen>
  );
}
