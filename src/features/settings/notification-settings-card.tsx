import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { type StyleProp, View, type ViewStyle } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { Card } from '@/components/ui/card';
import { Press, Txt } from '@/constants/ui';
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
  rowWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.space.sm,
  },
  chip: {
    paddingHorizontal: theme.space.lg,
    paddingVertical: theme.space.xs + theme.space.xs / 2,
    borderRadius: theme.radius.lg,
    borderWidth: theme.borderWidth.base,
  },
  chipSelected: {
    backgroundColor: theme.accent,
    borderColor: theme.accent,
  },
  chipIdle: {
    backgroundColor: theme.backgroundElement,
    borderColor: theme.border,
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
            <View
              accessibilityRole="radiogroup"
              accessibilityLabel={t('settings.groups.app.notifications.reminderThresholdLabel')}
              style={styles.rowWrap}>
              {THRESHOLD_OPTIONS.map((days) => {
                const isSelected = settings.daysThreshold === days;
                return (
                  <Press
                    key={days}
                    onPress={() => void updateSettings({ ...settings, daysThreshold: days })}
                    accessibilityRole="radio"
                    accessibilityLabel={`${days} ${t('settings.groups.app.notifications.day', { count: days })}`}
                    accessibilityState={{ selected: isSelected }}
                    haptic="selection"
                    style={[styles.chip, isSelected ? styles.chipSelected : styles.chipIdle]}>
                    <Txt variant="caption" tone={isSelected ? 'onAccent' : 'secondary'}>
                      {days} {t('settings.groups.app.notifications.day', { count: days })}
                    </Txt>
                  </Press>
                );
              })}
            </View>
          </View>

          <View style={styles.group}>
            <Txt variant="label" weight="700">
              {t('settings.groups.app.notifications.reminderTimeLabel')}
            </Txt>
            <View
              accessibilityRole="radiogroup"
              accessibilityLabel={t('settings.groups.app.notifications.reminderTimeLabel')}
              style={styles.rowWrap}>
              {TIME_OPTIONS.map((time) => {
                const isSelected =
                  settings.reminderHour === time.hour && settings.reminderMinute === time.minute;
                return (
                  <Press
                    key={time.time}
                    onPress={() =>
                      void updateSettings({
                        ...settings,
                        reminderHour: time.hour,
                        reminderMinute: time.minute,
                      })
                    }
                    accessibilityRole="radio"
                    accessibilityLabel={t('settings.groups.app.notifications.timeLabel', {
                      time: time.time,
                    })}
                    accessibilityState={{ selected: isSelected }}
                    haptic="selection"
                    style={[styles.chip, isSelected ? styles.chipSelected : styles.chipIdle]}>
                    <Txt variant="caption" tone={isSelected ? 'onAccent' : 'secondary'}>
                      {t('settings.groups.app.notifications.timeLabel', { time: time.time })}
                    </Txt>
                  </Press>
                );
              })}
            </View>
          </View>
        </View>
      </Card>
    </View>
  );
}
