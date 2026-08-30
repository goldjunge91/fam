import { Platform } from 'react-native';

const NOTIF_SETTINGS_KEY = 'fam_notification_settings_v1';
export const EXPIRY_NOTIFICATION_IDENTIFIER = 'fam.inventory.expiry.v1';

export type NotificationSettings = {
  enabled: boolean;
  daysThreshold: number; // e.g. 3 days before expiry
  reminderHour: number; // e.g. 9 for 09:00
  reminderMinute: number; // e.g. 0
};

export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  enabled: true,
  daysThreshold: 3,
  reminderHour: 9,
  reminderMinute: 0,
};

// Defensiver Speicher-Wrapper: Verhindert App-Crashes ("AsyncStorage is null") in Expo Go / Web
// biome-ignore lint/suspicious/noExplicitAny: Dynamic AsyncStorage module
let AsyncStorageModule: any = null;
try {
  AsyncStorageModule = require('@react-native-async-storage/async-storage').default;
} catch {
  AsyncStorageModule = null;
}

// Defensiver Notifications-Wrapper: Verhindert App-Crashes ("Cannot find native module ExpoPushTokenManager") in Expo Go
// biome-ignore lint/suspicious/noExplicitAny: Dynamic Notifications module
let NotificationsModule: any = null;
try {
  NotificationsModule = require('expo-notifications');
  if (NotificationsModule?.setNotificationHandler) {
    NotificationsModule.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        // shouldShowAlert: true,
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
  } catch {
    // In-Memory Fallback nutzen
  }
  return memoryStorage.get(key) ?? null;
}

async function storageSetItem(key: string, value: string): Promise<void> {
  memoryStorage.set(key, value);
  try {
    if (AsyncStorageModule) {
      await AsyncStorageModule.setItem(key, value);
    }
  } catch {
    // In-Memory Fallback ist bereits gesetzt
  }
}

/**
 * Lädt die Benachrichtigungs-Einstellungen des Nutzers aus dem lokalen Speicher.
 */
export async function getNotificationSettings(): Promise<NotificationSettings> {
  try {
    const json = await storageGetItem(NOTIF_SETTINGS_KEY);
    if (!json) return DEFAULT_NOTIFICATION_SETTINGS;
    return { ...DEFAULT_NOTIFICATION_SETTINGS, ...JSON.parse(json) };
  } catch {
    return DEFAULT_NOTIFICATION_SETTINGS;
  }
}

/**
 * Speichert die Benachrichtigungs-Einstellungen.
 */
export async function saveNotificationSettings(settings: NotificationSettings): Promise<void> {
  try {
    await storageSetItem(NOTIF_SETTINGS_KEY, JSON.stringify(settings));
  } catch (err) {
    console.error('Fehler beim Speichern der Benachrichtigungs-Einstellungen:', err);
  }
}

/**
 * Deaktiviert die Nutzung von Erinnerungen in der App und entfernt geplante
 * lokale Benachrichtigungen. Die Systemberechtigung bleibt unverändert.
 */
export async function disableNotificationReminders(): Promise<void> {
  await saveNotificationSettings({ ...DEFAULT_NOTIFICATION_SETTINGS, enabled: false });
  await cancelLocalReminder(EXPIRY_NOTIFICATION_IDENTIFIER);
}

export type NotificationPermissionStatus = {
  granted: boolean;
  /** false = iOS hat den System-Dialog schon einmal verweigert bekommen und fragt nie wieder selbst — nur noch über die Systemeinstellungen änderbar. */
  canAskAgain: boolean;
};

/**
 * Liest den aktuellen Berechtigungsstatus, ohne einen Dialog auszulösen.
 * Für den Berechtigungen-Screen, der den Systemstatus nur anzeigen soll.
 */
export async function getNotificationPermissionStatus(): Promise<NotificationPermissionStatus> {
  if (Platform.OS === 'web' || !NotificationsModule) return { granted: false, canAskAgain: false };
  try {
    const permission = await NotificationsModule.getPermissionsAsync();
    return {
      granted: hasNotificationPermission(permission),
      canAskAgain: permission.canAskAgain ?? true,
    };
  } catch (err) {
    console.error('Fehler bei getNotificationPermissionStatus:', err);
    return { granted: false, canAskAgain: true };
  }
}

/**
 * Fragt Push-Berechtigungen ab (auf iOS/Android).
 */
export async function requestNotificationPermissions(): Promise<boolean> {
  if (Platform.OS === 'web' || !NotificationsModule) return false;
  try {
    if (Platform.OS === 'android' && NotificationsModule.setNotificationChannelAsync) {
      await NotificationsModule.setNotificationChannelAsync('reminders', {
        name: 'Erinnerungen',
        importance: NotificationsModule.AndroidImportance.DEFAULT,
      });
    }

    const existing = await NotificationsModule.getPermissionsAsync();
    if (hasNotificationPermission(existing)) return true;

    const requested = await NotificationsModule.requestPermissionsAsync({
      ios: {
        allowAlert: true,
        allowBadge: true,
        allowSound: true,
      },
    });

    return hasNotificationPermission(requested);
  } catch (err) {
    console.error('Fehler bei requestNotificationPermissions:', err);
    return false;
  }
}

function hasNotificationPermission(permission: {
  status?: string;
  ios?: { status?: number };
}): boolean {
  if (permission.status === 'granted') return true;
  const iosStatus = permission.ios?.status;
  return [
    NotificationsModule?.IosAuthorizationStatus?.AUTHORIZED,
    NotificationsModule?.IosAuthorizationStatus?.PROVISIONAL,
    NotificationsModule?.IosAuthorizationStatus?.EPHEMERAL,
  ].includes(iosStatus);
}

export type LocalReminderInput = {
  identifier: string;
  date: Date;
  title: string;
  body: string;
};

export async function cancelLocalReminder(identifier: string): Promise<void> {
  if (Platform.OS === 'web' || !NotificationsModule) return;
  try {
    await NotificationsModule.cancelScheduledNotificationAsync(identifier);
  } catch {
    // Graceful Fallback, wenn Notifications nicht unterstützt werden.
  }
}

export async function scheduleLocalReminder({
  identifier,
  date,
  title,
  body,
}: LocalReminderInput): Promise<boolean> {
  if (Platform.OS === 'web' || !NotificationsModule) return false;

  await cancelLocalReminder(identifier);
  const hasPermission = await requestNotificationPermissions();
  if (!hasPermission) return false;

  try {
    await NotificationsModule.scheduleNotificationAsync({
      identifier,
      content: { title, body, sound: true },
      trigger: {
        type: NotificationsModule.SchedulableTriggerInputTypes.DATE,
        date,
      },
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Plant die tägliche lokale Erinnerung für ablaufende Vorräte.
 */
export async function scheduleExpiryNotificationReminder(
  expiringItemsCount: number,
  settings: NotificationSettings,
): Promise<void> {
  if (Platform.OS === 'web' || !NotificationsModule) return;

  try {
    await cancelLocalReminder(EXPIRY_NOTIFICATION_IDENTIFIER);

    if (!settings.enabled || expiringItemsCount <= 0) return;

    const hasPermission = await requestNotificationPermissions();
    if (!hasPermission) return;

    // Tägliche Benachrichtigung zur eingestellten Uhrzeit planen
    await NotificationsModule.scheduleNotificationAsync({
      identifier: EXPIRY_NOTIFICATION_IDENTIFIER,
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
  } catch {
    // Graceful Fallback wenn Benachrichtigungen nicht unterstuetzt werden
  }
}

export type TestNotificationResult = {
  success: boolean;
  message: string;
};

/**
 * Sendet eine sofortige Test-Benachrichtigung für den Live-Test im Debug-Bereich.
 */
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
      trigger: null, // Sofortige Auslösung
    });
    return { success: true, message: 'Test-Benachrichtigung wurde erfolgreich gesendet!' };
  } catch (err) {
    return {
      success: false,
      message: err instanceof Error ? err.message : 'Fehler beim Senden der Benachrichtigung.',
    };
  }
}
