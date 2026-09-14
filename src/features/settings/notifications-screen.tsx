import { useTranslation } from 'react-i18next';
import { Screen } from '@/components/layout/screen';
import { useSession } from '@/features/auth/session-provider';
import { InjectionReminderSettingsCard } from '@/features/glp1/components/injection-reminder-settings-card';
import { useProfile } from '@/features/profile/api';
import { NotificationSettingsCard } from '@/features/settings/notification-settings-card';

export function NotificationsScreen() {
  const { session } = useSession();
  const { data: profile } = useProfile(session?.user.id);
  const { t } = useTranslation();

  return (
    <Screen
      title={t('settings.groups.app.notifications.label')}
      back={{ label: t('settings.backToSettings'), href: '/settings' }}
      backStyle="icon">
      <NotificationSettingsCard />
      {profile?.tracking_method === 'glp1' ? (
        <InjectionReminderSettingsCard userId={session?.user.id} />
      ) : null}
    </Screen>
  );
}
