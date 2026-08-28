import { useEffect, useState } from 'react';
import { AppState, Linking, type StyleProp, Switch, View, type ViewStyle } from 'react-native';
import { ThemedText } from '@/components/theme/themed-text';
import { Card } from '@/components/ui/card';
// `trackColor` benötigt echte Farbwerte statt CSS-Variablen.
import { useTheme } from '@/hooks/use-theme';
import {
  disableNotificationReminders,
  getNotificationPermissionStatus,
  requestNotificationPermissions,
} from '@/lib/notifications';

type NotificationPermissionCardProps = {
  style?: StyleProp<ViewStyle>;
};

export function NotificationPermissionCard({ style }: NotificationPermissionCardProps) {
  const theme = useTheme();
  const [status, setStatus] = useState({ granted: false, canAskAgain: true });

  useEffect(() => {
    let active = true;

    async function refresh() {
      const nextStatus = await getNotificationPermissionStatus();
      if (active) setStatus(nextStatus);
    }

    void refresh();
    const subscription = AppState.addEventListener('change', (appState) => {
      if (appState === 'active') void refresh();
    });

    return () => {
      active = false;
      subscription.remove();
    };
  }, []);

  async function handleToggle(value: boolean) {
    if (!value) {
      await disableNotificationReminders();
      return;
    }
    if (!status.canAskAgain) {
      Linking.openSettings();
      return;
    }
    const granted = await requestNotificationPermissions();
    if (granted) {
      setStatus((prev) => ({ ...prev, granted: true }));
      return;
    }
    await disableNotificationReminders();
  }

  return (
    <View style={style}>
      <Card title="Benachrichtigungen">
        <View className="row-between">
          <View className="row-text">
            <ThemedText type="bodyBold">Benachrichtigungs-Zugriff</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {status.canAskAgain
                ? 'Damit Erinnerungen an ablaufende Vorräte ankommen.'
                : 'In den Systemeinstellungen deaktiviert. Zum Ändern antippen.'}
            </ThemedText>
          </View>
          <Switch
            value={status.granted}
            onValueChange={handleToggle}
            trackColor={{ false: theme.border, true: theme.accent }}
          />
        </View>
      </Card>
    </View>
  );
}
