import { View } from 'react-native';
import { Screen } from '@/components/layout/screen';
import { CameraPermissionCard } from '@/features/settings/camera-permission-card';
import { NotificationPermissionCard } from '@/features/settings/notification-permission-card';

/**
 * Systemberechtigungen (Kamera, Benachrichtigungen), getrennt von den
 * Benachrichtigungs-*Einstellungen* (Schwellenwert, Uhrzeit) unter
 * `/settings/notifications` — eine Berechtigung ist ein OS-Status
 * (gewährt/verweigert), keine App-Konfiguration.
 *
 * Beide Berechtigungen wurden vorher nur im Onboarding abgefragt und ließen
 * sich danach nirgends mehr ansehen oder erneut anfragen, obwohl sie über
 * die iOS/Android-Systemeinstellungen jederzeit entzogen werden können.
 */
export function PermissionsScreen() {
  return (
    <Screen
      title="Berechtigungen"
      back={{ label: 'Einstellungen', href: '/settings' }}
      backStyle="icon">
      <View className="gap-three">
        <CameraPermissionCard />
        <NotificationPermissionCard />
      </View>
    </Screen>
  );
}
