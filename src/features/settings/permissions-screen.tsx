import { Screen } from '@/components/layout/screen';
import { CameraPermissionCard } from '@/features/settings/camera-permission-card';

/**
 * Systemberechtigungen (aktuell: Kamera), getrennt von den
 * Benachrichtigungs-*Einstellungen* (Schwellenwert, Uhrzeit) unter
 * `/settings/notifications` — eine Berechtigung ist ein OS-Status
 * (gewährt/verweigert), keine App-Konfiguration.
 *
 * Kamera-Berechtigung wurde vorher nur im Onboarding abgefragt und ließ sich
 * danach nirgends mehr ansehen oder erneut anfragen, obwohl sie über die
 * iOS/Android-Systemeinstellungen jederzeit entzogen werden kann.
 */
export function PermissionsScreen() {
  return (
    <Screen
      title="Berechtigungen"
      back={{ label: 'Einstellungen', href: '/settings' }}
      backStyle="icon">
      <CameraPermissionCard />
    </Screen>
  );
}
