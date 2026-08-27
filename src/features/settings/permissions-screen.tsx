import { View } from 'react-native';
import { Screen } from '@/components/layout/screen';
import { CameraPermissionCard } from '@/features/settings/camera-permission-card';
import { LocationPermissionCard } from '@/features/settings/location-permission-card';
import { NotificationPermissionCard } from '@/features/settings/notification-permission-card';

export function PermissionsScreen() {
  return (
    <Screen
      title="Berechtigungen"
      back={{ label: 'Einstellungen', href: '/settings' }}
      backStyle="icon">
      <View className="gap-three">
        <CameraPermissionCard />
        <NotificationPermissionCard />
        <LocationPermissionCard />
      </View>
    </Screen>
  );
}
