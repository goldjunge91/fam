import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

const NOTIF_SETTINGS_KEY = 'fam_notification_settings_v1';

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

// Configure Notification Handler for Foreground Notifications
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

/**
 * Lädt die Benachrichtigungs-Einstellungen des Nutzers aus dem lokalen Speicher.
 */
export async function getNotificationSettings(): Promise<NotificationSettings> {
  try {
    const json = await AsyncStorage.getItem(NOTIF_SETTINGS_KEY);
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
    await AsyncStorage.setItem(NOTIF_SETTINGS_KEY, JSON.stringify(settings));
  } catch (err) {
    console.error('Fehler beim Speichern der Benachrichtigungs-Einstellungen:', err);
  }
}

/**
 * Fragt Push-Berechtigungen ab (auf iOS/Android).
 */
export async function requestNotificationPermissions(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  return finalStatus === 'granted';
}

/**
 * Plant die tägliche lokale Erinnerung für ablaufende Vorräte.
 */
export async function scheduleExpiryNotificationReminder(
  expiringItemsCount: number,
  settings: NotificationSettings,
): Promise<void> {
  if (Platform.OS === 'web') return;

  // Bestehende geplante Benachrichtigungen löschen
  await Notifications.cancelAllScheduledNotificationsAsync();

  if (!settings.enabled || expiringItemsCount <= 0) return;

  const hasPermission = await requestNotificationPermissions();
  if (!hasPermission) return;

  // Tägliche Benachrichtigung zur eingestellten Uhrzeit planen
  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Vorräte laufen bald ab! 🫙',
      body: `${expiringItemsCount} Produkt(e) laufen in den nächsten ${settings.daysThreshold} Tag(en) oder sind bereits abgelaufen.`,
      sound: true,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour: settings.reminderHour,
      minute: settings.reminderMinute,
    },
  });
}
