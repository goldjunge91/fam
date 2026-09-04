import { useEffect, useState } from 'react';
import { Pressable, type StyleProp, View, type ViewStyle } from 'react-native';
import { useTheme } from '@/components/theme/ThemeProvider';
import { Card } from '@/components/ui/card';
import { Txt } from '@/constants/ui';
import {
  DEFAULT_NOTIFICATION_SETTINGS,
  getNotificationSettings,
  type NotificationSettings,
  saveNotificationSettings,
} from '@/lib/notifications';

const THRESHOLD_OPTIONS = [1, 3, 5, 7];
const TIME_OPTIONS = [
  { label: '08:00 Uhr', hour: 8, minute: 0 },
  { label: '09:00 Uhr', hour: 9, minute: 0 },
  { label: '18:00 Uhr', hour: 18, minute: 0 },
];

type NotificationSettingsCardProps = {
  style?: StyleProp<ViewStyle>;
};

export function NotificationSettingsCard({ style }: NotificationSettingsCardProps) {
  const { colors } = useTheme();
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
      <Card title="Benachrichtigungen">
        <View className="gap-three">
          <View className="gap-two">
            <Txt variant="label" weight="700">Erinnern ab (Tage im Voraus):</Txt>
            <View className="row-wrap">
              {THRESHOLD_OPTIONS.map((days) => {
                const isSelected = settings.daysThreshold === days;
                return (
                  <Pressable
                    key={days}
                    onPress={() => updateSettings({ ...settings, daysThreshold: days })}
                    className="chip"
                    style={{
                      backgroundColor: isSelected ? colors.basil : colors.surface,
                      borderColor: isSelected ? colors.basil : colors.border,
                      borderWidth: 1,
                    }}>
                    <Txt variant="caption" tone={isSelected ? 'onAccent' : 'secondary'}>
                      {days} {days === 1 ? 'Tag' : 'Tage'}
                    </Txt>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View className="gap-two">
            <Txt variant="label" weight="700">Uhrzeit der Erinnerung:</Txt>
            <View className="row-wrap">
              {TIME_OPTIONS.map((time) => {
                const isSelected =
                  settings.reminderHour === time.hour && settings.reminderMinute === time.minute;
                return (
                  <Pressable
                    key={time.label}
                    onPress={() =>
                      updateSettings({
                        ...settings,
                        reminderHour: time.hour,
                        reminderMinute: time.minute,
                      })
                    }
                    className="chip"
                    style={{
                      backgroundColor: isSelected ? colors.basil : colors.surface,
                      borderColor: isSelected ? colors.basil : colors.border,
                      borderWidth: 1,
                    }}>
                    <Txt variant="caption" tone={isSelected ? 'onAccent' : 'secondary'}>
                      {time.label}
                    </Txt>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </View>
      </Card>
    </View>
  );
}
