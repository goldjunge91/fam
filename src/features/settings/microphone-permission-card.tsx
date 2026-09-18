import { useTranslation } from 'react-i18next';
import type { StyleProp, ViewStyle } from 'react-native';
import { useMicrophonePermission } from '@/lib/platform/microphone-permissions';
import { PermissionCard } from './permission-card';

type MicrophonePermissionCardProps = {
  style?: StyleProp<ViewStyle>;
};

export function MicrophonePermissionCard({ style }: MicrophonePermissionCardProps) {
  const { t } = useTranslation();

  return (
    <PermissionCard
      style={style}
      title={t('settings.groups.app.permissions.microphone.title')}
      label={t('settings.groups.app.permissions.microphone.label')}
      grantedCopy={t('settings.groups.app.permissions.microphone.grantedHint')}
      deniedCopy={t('settings.groups.app.permissions.deniedHint')}
      usePermission={useMicrophonePermission}
    />
  );
}
