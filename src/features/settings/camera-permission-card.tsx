import type { StyleProp, ViewStyle } from 'react-native';
import { PermissionCard } from './permission-card';

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
  return (
    <PermissionCard
      style={style}
      title="Kamera"
      label="Kamera-Zugriff"
      grantedCopy="Für Barcode-Scan und QR-Code-Beitritt."
      deniedCopy="In den Systemeinstellungen deaktiviert. Zum Ändern antippen."
      usePermission={useCameraPermissionsHook}
    />
  );
}
