import { Linking, type StyleProp, Switch, View, type ViewStyle } from 'react-native';
import { ThemedText } from '@/components/theme/themed-text';
import { Card } from '@/components/ui/card';
// Switch akzeptiert nur echte Farbwerte in trackColor, keine CSS-Variable/
// Tailwind-Klasse (s. docs/design-system/nativewind-liquid-glass-migration.md).
import { useTheme } from '@/hooks/use-theme';

// expo-camera ist nur im nativen Dev-Build verfuegbar.
// biome-ignore lint/suspicious/noExplicitAny: Dynamic Expo Camera Module
let useCameraPermissionsHook: any = () => [null, async () => ({ granted: false })];
try {
  const ExpoCamera = require('expo-camera');
  if (ExpoCamera?.useCameraPermissions) {
    useCameraPermissionsHook = ExpoCamera.useCameraPermissions;
  }
} catch {}

type CameraPermissionCardProps = {
  style?: StyleProp<ViewStyle>;
};

/** Zeigt den aktuellen Kamera-Systemstatus und den verfuegbaren Folgeweg. */
export function CameraPermissionCard({ style }: CameraPermissionCardProps) {
  const theme = useTheme();
  const [permission, requestPermission] = useCameraPermissionsHook();

  const granted = permission?.granted ?? false;
  // iOS verweist nach endgueltiger Ablehnung in die Systemeinstellungen.
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
