import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { type StyleProp, View, type ViewStyle } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { Card } from '@/components/ui/card';
import { SegmentedControl, Txt } from '@/constants/ui';
import {
  DEFAULT_NOTIFICATION_SETTINGS,
  getNotificationSettings,
  type NotificationSettings,
  saveNotificationSettings,
} from '@/lib/notifications';

const THRESHOLD_OPTIONS = [1, 3, 5, 7];
const TIME_OPTIONS = [
  { time: '08:00', hour: 8, minute: 0 },
  { time: '09:00', hour: 9, minute: 0 },
  { time: '18:00', hour: 18, minute: 0 },
];

const styles = StyleSheet.create((theme) => ({
  content: {
    gap: theme.space.lg,
  },
  group: {
    gap: theme.space.sm,
  },
}));

type NotificationSettingsCardProps = {
  style?: StyleProp<ViewStyle>;
};

export function NotificationSettingsCard({ style }: NotificationSettingsCardProps) {
  const { t } = useTranslation();
  const [settings, setSettings] = useState<NotificationSettings>(DEFAULT_NOTIFICATION_SETTINGS);

  useEffect(() => {
    getNotificationSettings().then(setSettings);
  }, []);

  async function updateSettings(newSettings: NotificationSettings) {
    setSettings(newSettings);
    await saveNotificationSettings(newSettings);
  }

  return (
    <View style={style}>
      <Card title={t('settings.groups.app.notifications.label')}>
        <View style={styles.content}>
          <View style={styles.group}>
            <Txt variant="label" weight="700">
              {t('settings.groups.app.notifications.reminderThresholdLabel')}
            </Txt>
            <SegmentedControl
              label={t('settings.groups.app.notifications.reminderThresholdLabel')}
              selected={String(settings.daysThreshold)}
              options={THRESHOLD_OPTIONS.map((days) => ({
                value: String(days),
                label: `${days} ${t('settings.groups.app.notifications.day', { count: days })}`,
              }))}
              onSelect={(value) =>
                void updateSettings({ ...settings, daysThreshold: Number(value) })
              }
            />
          </View>

          <View style={styles.group}>
            <Txt variant="label" weight="700">
              {t('settings.groups.app.notifications.reminderTimeLabel')}
            </Txt>
            <SegmentedControl
              label={t('settings.groups.app.notifications.reminderTimeLabel')}
              selected={`${settings.reminderHour.toString().padStart(2, '0')}:${settings.reminderMinute.toString().padStart(2, '0')}`}
              options={TIME_OPTIONS.map((time) => ({
                value: time.time,
                label: t('settings.groups.app.notifications.timeLabel', { time: time.time }),
              }))}
              onSelect={(value) => {
                const time = TIME_OPTIONS.find((option) => option.time === value);
                if (!time) return;
                void updateSettings({
                  ...settings,
                  reminderHour: time.hour,
                  reminderMinute: time.minute,
                });
              }}
            />
          </View>
        </View>
      </Card>
    </View>
  );
}
