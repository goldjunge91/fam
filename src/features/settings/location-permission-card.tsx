import * as Location from 'expo-location';
import type { StyleProp, ViewStyle } from 'react-native';
import { PermissionCard } from './permission-card';

type LocationPermissionCardProps = {
  style?: StyleProp<ViewStyle>;
};

export function LocationPermissionCard({ style }: LocationPermissionCardProps) {
  return (
    <PermissionCard
      style={style}
      title="Standort"
      label="Standort-Zugriff"
      grantedCopy="Für Prospekte aus deiner Umgebung."
      deniedCopy="In den Systemeinstellungen deaktiviert. Zum Ändern antippen."
      usePermission={Location.useForegroundPermissions}
    />
  );
}
