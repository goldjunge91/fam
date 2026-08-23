import { Platform } from 'react-native';

const NOTIF_SETTINGS_KEY = 'fam_notification_settings_v1';

export type NotificationSettings = {
  enabled: boolean;
  daysThreshold: number;
  reminderHour: number;
  reminderMinute: number;
};

export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  enabled: true,
  daysThreshold: 3,
  reminderHour: 9,
  reminderMinute: 0,
};

// Native Module fehlen in Expo Go und im Web.
// biome-ignore lint/suspicious/noExplicitAny: Dynamic AsyncStorage module
let AsyncStorageModule: any = null;
try {
  AsyncStorageModule = require('@react-native-async-storage/async-storage').default;
} catch {
  AsyncStorageModule = null;
}

// biome-ignore lint/suspicious/noExplicitAny: Dynamic Notifications module
let NotificationsModule: any = null;
try {
  NotificationsModule = require('expo-notifications');
  if (NotificationsModule?.setNotificationHandler) {
    NotificationsModule.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
        shouldShowList: true,
      }),
    });
  }
} catch {
  NotificationsModule = null;
}

const memoryStorage = new Map<string, string>();

async function storageGetItem(key: string): Promise<string | null> {
  try {
    if (AsyncStorageModule) {
      const res = await AsyncStorageModule.getItem(key);
      if (res !== null) return res;
    }
  } catch {}
  return memoryStorage.get(key) ?? null;
}

async function storageSetItem(key: string, value: string): Promise<void> {
  memoryStorage.set(key, value);
  try {
    if (AsyncStorageModule) {
      await AsyncStorageModule.setItem(key, value);
    }
  } catch {}
}

export async function getNotificationSettings(): Promise<NotificationSettings> {
  try {
    const json = await storageGetItem(NOTIF_SETTINGS_KEY);
    if (!json) return DEFAULT_NOTIFICATION_SETTINGS;
    return { ...DEFAULT_NOTIFICATION_SETTINGS, ...JSON.parse(json) };
  } catch {
    return DEFAULT_NOTIFICATION_SETTINGS;
  }
}

export async function saveNotificationSettings(settings: NotificationSettings): Promise<void> {
  try {
    await storageSetItem(NOTIF_SETTINGS_KEY, JSON.stringify(settings));
  } catch (err) {
    console.error('Fehler beim Speichern der Benachrichtigungs-Einstellungen:', err);
  }
}

export type NotificationPermissionStatus = {
  granted: boolean;
  /** `false` erfordert eine Aenderung in den Systemeinstellungen. */
  canAskAgain: boolean;
};

export async function getNotificationPermissionStatus(): Promise<NotificationPermissionStatus> {
  if (Platform.OS === 'web' || !NotificationsModule) return { granted: false, canAskAgain: false };
  try {
    const { status, canAskAgain } = await NotificationsModule.getPermissionsAsync();
    return { granted: status === 'granted', canAskAgain: canAskAgain ?? true };
  } catch (err) {
    console.error('Fehler bei getNotificationPermissionStatus:', err);
    return { granted: false, canAskAgain: true };
  }
}

export async function requestNotificationPermissions(): Promise<boolean> {
  if (Platform.OS === 'web' || !NotificationsModule) return false;
  try {
    const { status: existingStatus } = await NotificationsModule.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await NotificationsModule.requestPermissionsAsync({
        ios: {
          allowAlert: true,
          allowBadge: true,
          allowSound: true,
        },
      });
      finalStatus = status;
    }

    return finalStatus === 'granted';
  } catch (err) {
    console.error('Fehler bei requestNotificationPermissions:', err);
    return false;
  }
}

export async function scheduleExpiryNotificationReminder(
  expiringItemsCount: number,
  settings: NotificationSettings,
): Promise<void> {
  if (Platform.OS === 'web' || !NotificationsModule) return;

  try {
    await NotificationsModule.cancelAllScheduledNotificationsAsync();

    if (!settings.enabled || expiringItemsCount <= 0) return;

    const hasPermission = await requestNotificationPermissions();
    if (!hasPermission) return;

    await NotificationsModule.scheduleNotificationAsync({
      content: {
        title: 'Vorräte laufen bald ab! 🫙',
        body: `${expiringItemsCount} Produkt(e) laufen in den nächsten ${settings.daysThreshold} Tag(en) oder sind bereits abgelaufen.`,
        sound: true,
      },
      trigger: {
        type: NotificationsModule.SchedulableTriggerInputTypes.DAILY,
        hour: settings.reminderHour,
        minute: settings.reminderMinute,
      },
    });
  } catch {}
}

export type TestNotificationResult = {
  success: boolean;
  message: string;
};

export async function sendTestNotification(): Promise<TestNotificationResult> {
  if (Platform.OS === 'web') {
    return {
      success: false,
      message: 'Benachrichtigungen werden im Web-Browser nicht unterstützt.',
    };
  }

  if (!NotificationsModule) {
    return {
      success: false,
      message:
        'Das `expo-notifications` Modul steht in diesem Build nicht zur Verfügung. Bitte erstelle einen Native Dev Build (`bun run ios` / `bun run android`).',
    };
  }

  try {
    const hasPermission = await requestNotificationPermissions();
    if (!hasPermission) {
      return {
        success: false,
        message:
          'Kamera/Push-Berechtigung wurde verweigert oder ist in den Systemeinstellungen deaktiviert.',
      };
    }

    await NotificationsModule.scheduleNotificationAsync({
      content: {
        title: '🔔 Test-Benachrichtigung (Fam App)',
        body: 'Super! Die lokalen Push-Benachrichtigungen funktionieren einwandfrei.',
        sound: true,
      },
      trigger: null,
    });
    return { success: true, message: 'Test-Benachrichtigung wurde erfolgreich gesendet!' };
  } catch (err) {
    return {
      success: false,
      message: err instanceof Error ? err.message : 'Fehler beim Senden der Benachrichtigung.',
    };
  }
}
