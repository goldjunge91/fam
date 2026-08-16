import { useEffect, useState } from 'react';
import { Pressable, type StyleProp, StyleSheet, Switch, View, type ViewStyle } from 'react-native';

import { Card } from '@/components/card';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
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
        <View style={styles.content}>
          <View style={styles.settingRow}>
            <View style={styles.settingText}>
              <ThemedText style={{ fontWeight: 'bold' }}>Erinnerung aktivieren</ThemedText>
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
              <View style={styles.section}>
                <ThemedText type="smallBold">Erinnern ab (Tage im Voraus):</ThemedText>
                <View style={styles.chipRow}>
                  {THRESHOLD_OPTIONS.map((days) => {
                    const isSelected = settings.daysThreshold === days;
                    return (
                      <Pressable
                        key={days}
                        onPress={() => updateSettings({ ...settings, daysThreshold: days })}
                        style={[
                          styles.chip,
                          {
                            borderColor: isSelected ? theme.accent : theme.border,
                            backgroundColor: isSelected ? `${theme.accent}18` : 'transparent',
                          },
                        ]}>
                        <ThemedText
                          type="small"
                          style={{
                            color: isSelected ? theme.accent : theme.text,
                            fontWeight: isSelected ? 'bold' : 'normal',
                          }}>
                          {days} {days === 1 ? 'Tag' : 'Tage'}
                        </ThemedText>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              <View style={styles.section}>
                <ThemedText type="smallBold">Uhrzeit der Erinnerung:</ThemedText>
                <View style={styles.chipRow}>
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
                        style={[
                          styles.chip,
                          {
                            borderColor: isSelected ? theme.accent : theme.border,
                            backgroundColor: isSelected ? `${theme.accent}18` : 'transparent',
                          },
                        ]}>
                        <ThemedText
                          type="small"
                          style={{
                            color: isSelected ? theme.accent : theme.text,
                            fontWeight: isSelected ? 'bold' : 'normal',
                          }}>
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

const styles = StyleSheet.create({
  content: {
    gap: Spacing.three,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  settingText: {
    flex: 1,
    gap: 2,
  },
  section: {
    gap: Spacing.two,
    marginTop: Spacing.one,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  chip: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one + 2,
    borderRadius: Radius.sheet,
    borderWidth: 1,
  },
});
