import { Linking, type StyleProp, Switch, View, type ViewStyle } from 'react-native';
import { ThemedText } from '@/components/theme/themed-text';
import { Card } from '@/components/ui/card';
// `trackColor` benötigt echte Farbwerte statt CSS-Variablen.
import { useTheme } from '@/hooks/use-theme';

// Das native Kameramodul ist nur im Dev Build verfügbar.
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

export function CameraPermissionCard({ style }: CameraPermissionCardProps) {
  const theme = useTheme();
  const [permission, requestPermission] = useCameraPermissionsHook();

  const granted = permission?.granted ?? false;
  // Nach einer iOS-Ablehnung nur noch zu den Systemeinstellungen verweisen.
  const canAskAgain = permission?.canAskAgain ?? true;

  async function handleToggle(value: boolean) {
    // Die App kann die Systemberechtigung nicht zurücknehmen. Beim Ausschalten
    // bleibt der Schalter daher beim echten Systemstatus; der Nutzer kann die
    // Nutzung im Modul-Settings steuern. Nach dauerhafter Ablehnung hilft nur
    // noch der Weg über die Systemeinstellungen.
    if (value && !canAskAgain) {
      Linking.openSettings();
      return;
    }
    if (!value) return;
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
