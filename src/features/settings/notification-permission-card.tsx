import { useEffect, useState } from 'react';
import { Linking, type StyleProp, Switch, View, type ViewStyle } from 'react-native';
import { ThemedText } from '@/components/theme/themed-text';
import { Card } from '@/components/ui/card';
// Switch akzeptiert nur echte Farbwerte in trackColor, keine CSS-Variable/
// Tailwind-Klasse (s. docs/design-system/nativewind-liquid-glass-migration.md).
import { useTheme } from '@/hooks/use-theme';
import {
  getNotificationPermissionStatus,
  requestNotificationPermissions,
} from '@/lib/notifications';

type NotificationPermissionCardProps = {
  style?: StyleProp<ViewStyle>;
};

/** Verwaltet nur die OS-Berechtigung, nicht Zeitpunkt oder Vorlauf. */
export function NotificationPermissionCard({ style }: NotificationPermissionCardProps) {
  const theme = useTheme();
  const [status, setStatus] = useState({ granted: false, canAskAgain: true });

  useEffect(() => {
    getNotificationPermissionStatus().then(setStatus);
  }, []);

  async function handleToggle(value: boolean) {
    if (!value) return;
    if (!status.canAskAgain) {
      Linking.openSettings();
      return;
    }
    const granted = await requestNotificationPermissions();
    setStatus((prev) => ({ ...prev, granted }));
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
