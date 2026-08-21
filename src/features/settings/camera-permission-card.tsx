import { Linking, type StyleProp, Switch, View, type ViewStyle } from 'react-native';
import { ThemedText } from '@/components/theme/themed-text';
import { Card } from '@/components/ui/card';
// Switch akzeptiert nur echte Farbwerte in trackColor, keine CSS-Variable/
// Tailwind-Klasse (s. docs/design-system/nativewind-liquid-glass-migration.md).
import { useTheme } from '@/hooks/use-theme';

// Defensiver Import: expo-camera ist nur in einem nativen Dev-Build verfügbar.
// Gleiches Hook-Pattern wie in barcode-scanner-modal.tsx und dem Onboarding-
// Permissions-Step, damit der Systemdialog wirklich über die native Kamera-API
// ausgelöst wird.
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

type CameraPermissionCardProps = {
  style?: StyleProp<ViewStyle>;
};

/**
 * Kamera-Berechtigung ist einmal im Onboarding abgefragt worden, kann aber
 * jederzeit über die iOS/Android-Systemeinstellungen wieder entzogen werden.
 * Diese Karte macht den aktuellen Systemstatus sichtbar und erlaubt, die
 * Berechtigung erneut anzufragen (Android) bzw. direkt in die
 * System-Einstellungen zu springen, wenn iOS ein erneutes Fragen verweigert.
 */
export function CameraPermissionCard({ style }: CameraPermissionCardProps) {
  const theme = useTheme();
  const [permission, requestPermission] = useCameraPermissionsHook();

  const granted = permission?.granted ?? false;
  // iOS fragt nach einer Ablehnung nie wieder selbst — dort geht es nur noch
  // über die System-Einstellungen weiter (canAskAgain === false).
  const canAskAgain = permission?.canAskAgain ?? true;

  async function handleToggle(value: boolean) {
    if (!value) return;
    if (!canAskAgain) {
      Linking.openSettings();
      return;
    }
    await requestPermission();
  }

  return (
    <View style={style}>
      <Card title="Kamera">
        <View className="row-between">
          <View className="row-text">
            <ThemedText type="bodyBold">Kamera-Zugriff</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {canAskAgain
                ? 'Für Barcode-Scan und QR-Code-Beitritt.'
                : 'In den Systemeinstellungen deaktiviert. Zum Ändern antippen.'}
            </ThemedText>
          </View>
          <Switch
            value={granted}
            onValueChange={handleToggle}
            trackColor={{ false: theme.border, true: theme.accent }}
          />
        </View>
      </Card>
    </View>
  );
}
