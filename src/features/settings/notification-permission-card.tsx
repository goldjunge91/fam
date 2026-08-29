import { useEffect, useState } from 'react';
import { AppState, type StyleProp, type ViewStyle } from 'react-native';
import {
  disableNotificationReminders,
  getNotificationPermissionStatus,
  requestNotificationPermissions,
} from '@/lib/notifications';
import { PermissionCard, type PermissionState } from './permission-card';

/**
 * expo-notifications bietet keinen `usePermissions`-Hook wie expo-camera/-location.
 * Dieser Hook bildet dieselbe `[status, request]`-Form nach: Status wird bei Fokus
 * (App-Vordergrund) neu geladen, `request` fragt an und fällt bei Ablehnung auf
 * `disableNotificationReminders` zurück, damit Erinnerungen nicht für eine
 * Berechtigung geplant bleiben, die der Nutzer gerade verweigert hat.
 */
function useNotificationPermission(): readonly [PermissionState, () => Promise<void>] {
  const [status, setStatus] = useState<PermissionState>({ granted: false, canAskAgain: true });

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

  async function request() {
    const granted = await requestNotificationPermissions();
    if (granted) {
      setStatus((prev) => ({ ...prev, granted: true }));
      return;
    }
    await disableNotificationReminders();
  }

  return [status, request];
}

type NotificationPermissionCardProps = {
  style?: StyleProp<ViewStyle>;
};

export function NotificationPermissionCard({ style }: NotificationPermissionCardProps) {
  return (
    <PermissionCard
      style={style}
      title="Benachrichtigungen"
      label="Benachrichtigungs-Zugriff"
      grantedCopy="Damit Erinnerungen an ablaufende Vorräte ankommen."
      deniedCopy="In den Systemeinstellungen deaktiviert. Zum Ändern antippen."
      usePermission={useNotificationPermission}
      onDisable={disableNotificationReminders}
    />
  );
}
