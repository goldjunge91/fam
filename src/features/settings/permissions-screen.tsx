import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { Screen } from '@/components/layout/screen';
import { CameraPermissionCard } from '@/features/settings/camera-permission-card';
import { LocationPermissionCard } from '@/features/settings/location-permission-card';
import { NotificationPermissionCard } from '@/features/settings/notification-permission-card';

export function PermissionsScreen() {
  const { t } = useTranslation();

  return (
    <Screen
      title={t('settings.groups.app.permissions.label')}
      back={{ label: t('settings.backToSettings'), href: '/settings' }}
      backStyle="icon">
      <View className="gap-three">
        <CameraPermissionCard />
        <NotificationPermissionCard />
        <LocationPermissionCard />
      </View>
    </Screen>
  );
}
