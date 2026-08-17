import { useEffect, useState } from 'react';
import { Pressable, type StyleProp, Switch, View, type ViewStyle } from 'react-native';

import { Card } from '@/components/card';
import { ThemedText } from '@/components/themed-text';
// Switch akzeptiert nur echte Farbwerte in trackColor, keine CSS-Variable/
// Tailwind-Klasse (s. docs/design-system/nativewind-liquid-glass-migration.md).
import { useTheme } from '@/hooks/use-theme';
import {
  DEFAULT_NOTIFICATION_SETTINGS,
  getNotificationSettings,
  type NotificationSettings,
  requestNotificationPermissions,
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
  const theme = useTheme();
  const [settings, setSettings] = useState<NotificationSettings>(DEFAULT_NOTIFICATION_SETTINGS);

  useEffect(() => {
    getNotificationSettings().then(setSettings);
  }, []);

  async function updateSettings(newSettings: NotificationSettings) {
    setSettings(newSettings);
    await saveNotificationSettings(newSettings);

    if (newSettings.enabled) {
      await requestNotificationPermissions();
    }
  }

  return (
    <View style={style}>
      <Card title="Benachrichtigungen">
        <View className="gap-three">
          <View className="row-between">
            <View className="row-text">
              <ThemedText type="bodyBold">Erinnerung aktivieren</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                Push-Mitteilung für bald ablaufende Vorräte erhalten.
              </ThemedText>
            </View>
            <Switch
              value={settings.enabled}
              onValueChange={(val) => updateSettings({ ...settings, enabled: val })}
              trackColor={{ false: theme.border, true: theme.accent }}
            />
          </View>

          {settings.enabled && (
            <>
              <View className="gap-two mt-one">
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

              <View className="gap-two mt-one">
                <ThemedText type="smallBold">Uhrzeit der Erinnerung:</ThemedText>
                <View className="row-wrap">
                  {TIME_OPTIONS.map((time) => {
                    const isSelected =
                      settings.reminderHour === time.hour &&
                      settings.reminderMinute === time.minute;
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
            </>
          )}
        </View>
      </Card>
    </View>
  );
}
