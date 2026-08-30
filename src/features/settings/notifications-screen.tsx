import { Screen } from '@/components/layout/screen';
import { useSession } from '@/features/auth/session-provider';
import { InjectionReminderSettingsCard } from '@/features/glp1/components/injection-reminder-settings-card';
import { NotificationSettingsCard } from '@/features/settings/notification-settings-card';

export function NotificationsScreen() {
  const { session } = useSession();

  return (
    <Screen
      title="Benachrichtigungen"
      back={{ label: 'Einstellungen', href: '/settings' }}
      backStyle="icon">
      <NotificationSettingsCard />
      <InjectionReminderSettingsCard userId={session?.user.id} />
    </Screen>
  );
}
