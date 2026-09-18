import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { Screen } from '@/components/layout/screen';
import { CameraPermissionCard } from '@/features/settings/camera-permission-card';
import { LocationPermissionCard } from '@/features/settings/location-permission-card';
import { MicrophonePermissionCard } from '@/features/settings/microphone-permission-card';
import { NotificationPermissionCard } from '@/features/settings/notification-permission-card';

const styles = StyleSheet.create((theme) => ({
  list: {
    gap: theme.space.lg,
  },
}));

export function PermissionsScreen() {
  const { t } = useTranslation();

  return (
    <Screen
      title={t('settings.groups.app.permissions.label')}
      back={{ label: t('settings.backToSettings'), href: '/settings' }}
      backStyle="icon">
      <View style={styles.list}>
        <CameraPermissionCard />
        <MicrophonePermissionCard />
        <NotificationPermissionCard />
        <LocationPermissionCard />
      </View>
    </Screen>
  );
}
