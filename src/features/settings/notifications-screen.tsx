import { Screen } from '@/components/layout/screen';
import { NotificationSettingsCard } from '@/features/settings/notification-settings-card';

export function NotificationsScreen() {
  return (
    <Screen
      title="Benachrichtigungen"
      back={{ label: 'Einstellungen', href: '/settings' }}
      backStyle="icon">
      <NotificationSettingsCard />
    </Screen>
  );
}
