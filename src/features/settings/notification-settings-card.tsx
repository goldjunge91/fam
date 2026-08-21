import { useEffect, useState } from 'react';
import { Pressable, type StyleProp, View, type ViewStyle } from 'react-native';
import { ThemedText } from '@/components/theme/themed-text';
import { Card } from '@/components/ui/card';
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

/**
 * Legt nur noch fest, WANN erinnert wird (Schwellenwert, Uhrzeit) — OB die
 * App überhaupt Benachrichtigungen anzeigen darf, ist eine reine
 * OS-Berechtigung und lebt in `NotificationPermissionCard` unter
 * /settings/permissions. `settings.enabled` bleibt intern immer `true`;
 * `scheduleExpiryNotificationReminder` prüft die echte OS-Berechtigung
 * ohnehin selbst, bevor etwas geplant wird.
 */
export function NotificationSettingsCard({ style }: NotificationSettingsCardProps) {
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
            <ThemedText type="smallBold">Erinnern ab (Tage im Voraus):</ThemedText>
            <View className="row-wrap">
              {THRESHOLD_OPTIONS.map((days) => {
                const isSelected = settings.daysThreshold === days;
                return (
                  <Pressable
                    key={days}
                    onPress={() => updateSettings({ ...settings, daysThreshold: days })}
                    className={`chip ${isSelected ? 'chip-selected' : 'chip-idle'}`}>
                    <ThemedText type={isSelected ? 'smallSelected' : 'small'}>
                      {days} {days === 1 ? 'Tag' : 'Tage'}
                    </ThemedText>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View className="gap-two">
            <ThemedText type="smallBold">Uhrzeit der Erinnerung:</ThemedText>
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
                    className={`chip ${isSelected ? 'chip-selected' : 'chip-idle'}`}>
                    <ThemedText type={isSelected ? 'smallSelected' : 'small'}>
                      {time.label}
                    </ThemedText>
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
