import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { type StyleProp, View, type ViewStyle } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { TimeWheelField } from '@/components/forms/time-wheel-field';
import { Card } from '@/components/ui/card';
import { SegmentedControl, Txt } from '@/constants/ui';
import {
  DEFAULT_NOTIFICATION_SETTINGS,
  getNotificationSettings,
  type NotificationSettings,
  saveNotificationSettings,
} from '@/lib/notifications';

const THRESHOLD_OPTIONS = [1, 3, 5, 7];

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

function formatReminderTime(hour: number, minute: number): string {
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

function parseReminderTime(value: string): { hour: number; minute: number } | null {
  const match = /^(?:[01]\d|2[0-3]):[0-5]\d$/.exec(value);
  if (!match) return null;

  const [hour, minute] = value.split(':').map(Number);
  return { hour, minute };
}

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

  function handleReminderTimeChange(value: string) {
    const parsed = parseReminderTime(value);
    if (!parsed) return;
    void updateSettings({ ...settings, reminderHour: parsed.hour, reminderMinute: parsed.minute });
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
            <TimeWheelField
              label={t('settings.groups.app.notifications.reminderTimeLabel')}
              value={formatReminderTime(settings.reminderHour, settings.reminderMinute)}
              onChange={handleReminderTimeChange}
            />
          </View>
        </View>
      </Card>
    </View>
  );
}
