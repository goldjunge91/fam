import * as Location from 'expo-location';
import { useTranslation } from 'react-i18next';
import type { StyleProp, ViewStyle } from 'react-native';
import { PermissionCard } from './permission-card';

type LocationPermissionCardProps = {
  style?: StyleProp<ViewStyle>;
};

export function LocationPermissionCard({ style }: LocationPermissionCardProps) {
  const { t } = useTranslation();

  return (
    <PermissionCard
      style={style}
      title={t('settings.groups.app.permissions.location.title')}
      label={t('settings.groups.app.permissions.location.label')}
      grantedCopy={t('settings.groups.app.permissions.location.grantedHint')}
      deniedCopy={t('settings.groups.app.permissions.deniedHint')}
      usePermission={Location.useForegroundPermissions}
    />
  );
}
