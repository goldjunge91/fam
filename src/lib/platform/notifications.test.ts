import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ExpoNotifications from 'expo-notifications';
import { Platform } from 'react-native';
import {
  cancelLocalReminder,
  cancelUserNotificationReminders,
  DEFAULT_NOTIFICATION_SETTINGS,
  disableNotificationReminders,
  EXPIRY_NOTIFICATION_IDENTIFIER,
  getNotificationPermissionStatus,
  getNotificationSettings,
  type NotificationSettings,
  requestNotificationPermissions,
  saveNotificationSettings,
  scheduleExpiryNotificationReminder,
  scheduleLocalReminder,
  sendTestNotification,
} from './notifications';

jest.mock('@react-native-async-storage/async-storage', () => {
  const storage = jest.requireActual(
    '@react-native-async-storage/async-storage/jest/async-storage-mock',
  );
  return { ...storage, __esModule: true, default: storage };
});

const notifications = jest.mocked(
  jest.requireMock('expo-notifications') as typeof ExpoNotifications,
);
const getAllScheduledNotificationsAsync = jest.fn<
  Promise<ExpoNotifications.NotificationRequest[]>,
  []
>();

Object.defineProperty(notifications, 'getAllScheduledNotificationsAsync', {
  configurable: true,
  value: getAllScheduledNotificationsAsync,
});

function scheduledNotification(identifier: string): ExpoNotifications.NotificationRequest {
  return {
    identifier,
    content: {
      title: null,
      subtitle: null,
      body: null,
      categoryIdentifier: null,
      sound: null,
    },
    trigger: null,
  };
}

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
  getAllScheduledNotificationsAsync.mockResolvedValue([]);
  notifications.getPermissionsAsync.mockResolvedValue({
    status: ExpoNotifications.PermissionStatus.GRANTED,
    canAskAgain: true,
    expires: 'never',
    granted: true,
    ios: undefined,
    android: undefined,
  });
});

it('deaktiviert alle bekannten App-Erinnerungen ohne fremde Reminder zu löschen', async () => {
  getAllScheduledNotificationsAsync.mockResolvedValue([
    scheduledNotification(EXPIRY_NOTIFICATION_IDENTIFIER),
    scheduledNotification('fam.glp1.injection-due.v1.user-1'),
    scheduledNotification('fam.unrelated.reminder.v1'),
    scheduledNotification('another-app.reminder.v1'),
  ]);

  await disableNotificationReminders();

  expect(getAllScheduledNotificationsAsync).toHaveBeenCalledTimes(1);
  expect(notifications.cancelScheduledNotificationAsync.mock.calls).toEqual([
    [EXPIRY_NOTIFICATION_IDENTIFIER],
    ['fam.glp1.injection-due.v1.user-1'],
  ]);
  expect(notifications.cancelAllScheduledNotificationsAsync).not.toHaveBeenCalled();
});

it('entfernt die bekannte Ablauf-Erinnerung auch wenn geplante Requests nicht lesbar sind', async () => {
  getAllScheduledNotificationsAsync.mockRejectedValue(new Error('notifications unavailable'));

  await disableNotificationReminders();

  expect(notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith(
    EXPIRY_NOTIFICATION_IDENTIFIER,
  );
});

it('entfernt beim Account-Cleanup nur die GLP-1-Erinnerung des Nutzers', async () => {
  await cancelUserNotificationReminders('user-1');

  expect(notifications.cancelScheduledNotificationAsync.mock.calls).toEqual([
    ['fam.glp1.injection-due.v1.user-1'],
  ]);
});

it('ersetzt nur die eigene Ablauf-Erinnerung', async () => {
  await scheduleExpiryNotificationReminder(2, {
    enabled: true,
    daysThreshold: 3,
    reminderHour: 9,
    reminderMinute: 0,
  });

  expect(notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith(
    EXPIRY_NOTIFICATION_IDENTIFIER,
  );
  expect(notifications.cancelAllScheduledNotificationsAsync).not.toHaveBeenCalled();
  expect(notifications.scheduleNotificationAsync).toHaveBeenCalledWith(
    expect.objectContaining({ identifier: EXPIRY_NOTIFICATION_IDENTIFIER }),
  );
});

it('plant und entfernt eine lokale Erinnerung mit stabiler ID', async () => {
  const date = new Date('2026-09-01T08:00:00.000Z');

  await scheduleLocalReminder({
    identifier: 'fam.glp1.injection-due.v1.user-1',
    date,
    title: 'Injektion fällig',
    body: 'Deine Injektion ist fällig.',
  });

  expect(notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith(
    'fam.glp1.injection-due.v1.user-1',
  );
  expect(notifications.scheduleNotificationAsync).toHaveBeenCalledWith({
    identifier: 'fam.glp1.injection-due.v1.user-1',
    content: {
      title: 'Injektion fällig',
      body: 'Deine Injektion ist fällig.',
      sound: true,
    },
    trigger: {
      type: ExpoNotifications.SchedulableTriggerInputTypes.DATE,
      date,
    },
  });

  await cancelLocalReminder('fam.glp1.injection-due.v1.user-1');
  expect(notifications.cancelScheduledNotificationAsync).toHaveBeenLastCalledWith(
    'fam.glp1.injection-due.v1.user-1',
  );
});

it('entfernt eine deaktivierte Ablauf-Erinnerung ohne andere IDs anzufassen', async () => {
  await scheduleExpiryNotificationReminder(2, {
    enabled: false,
    daysThreshold: 3,
    reminderHour: 9,
    reminderMinute: 0,
  });

  expect(notifications.cancelScheduledNotificationAsync).toHaveBeenCalledTimes(1);
  expect(notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith(
    EXPIRY_NOTIFICATION_IDENTIFIER,
  );
  expect(notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
});

it('plant bei fehlender Berechtigung nichts und nutzt den bestehenden Adapter-Fallback', async () => {
  notifications.getPermissionsAsync.mockResolvedValue({
    status: ExpoNotifications.PermissionStatus.DENIED,
    canAskAgain: false,
    expires: 'never',
    granted: false,
    ios: undefined,
    android: undefined,
  });
  notifications.requestPermissionsAsync.mockResolvedValue({
    status: ExpoNotifications.PermissionStatus.DENIED,
    canAskAgain: false,
    expires: 'never',
    granted: false,
    ios: undefined,
    android: undefined,
  });

  await expect(
    scheduleLocalReminder({
      identifier: 'fam.glp1.injection-due.v1.user-1',
      date: new Date('2099-09-01T08:00:00.000Z'),
      title: 'Injektion fällig',
      body: 'Deine Injektion ist fällig.',
    }),
  ).resolves.toBe(false);
  expect(notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
});

it('speichert und lädt die vollständigen Benachrichtigungseinstellungen', async () => {
  const settings: NotificationSettings = {
    enabled: false,
    daysThreshold: 5,
    reminderHour: 8,
    reminderMinute: 30,
  };

  await saveNotificationSettings(settings);

  await expect(getNotificationSettings()).resolves.toEqual(settings);
  expect(AsyncStorage.setItem).toHaveBeenCalledWith(
    'fam_notification_settings_v1',
    JSON.stringify(settings),
  );
});

it('uses safe defaults for malformed stored settings and permission lookup failures', async () => {
  await AsyncStorage.setItem('fam_notification_settings_v1', '{not-json');
  await expect(getNotificationSettings()).resolves.toEqual(DEFAULT_NOTIFICATION_SETTINGS);

  notifications.getPermissionsAsync.mockRejectedValueOnce(new Error('permission lookup failed'));
  await expect(getNotificationPermissionStatus()).resolves.toEqual({
    granted: false,
    canAskAgain: true,
  });
});

it('returns the current notification permission without opening a system prompt', async () => {
  notifications.getPermissionsAsync.mockResolvedValueOnce({
    status: ExpoNotifications.PermissionStatus.DENIED,
    canAskAgain: false,
    expires: 'never',
    granted: false,
    ios: undefined,
    android: undefined,
  });

  await expect(getNotificationPermissionStatus()).resolves.toEqual({
    granted: false,
    canAskAgain: false,
  });
  expect(notifications.requestPermissionsAsync).not.toHaveBeenCalled();
});

it('returns granted when existing iOS authorization is provisional', async () => {
  notifications.getPermissionsAsync.mockResolvedValueOnce({
    status: ExpoNotifications.PermissionStatus.UNDETERMINED,
    canAskAgain: true,
    expires: 'never',
    granted: false,
    ios: {
      status: ExpoNotifications.IosAuthorizationStatus.PROVISIONAL,
      allowsAlert: false,
      allowsBadge: false,
      allowsSound: false,
      allowsCriticalAlerts: false,
      allowsDisplayInCarPlay: false,
      allowsAnnouncements: false,
      providesAppNotificationSettings: false,
      allowsDisplayInNotificationCenter: false,
      allowsDisplayOnLockScreen: false,
      alertStyle: 0,
      allowsPreviews: 0,
    },
    android: undefined,
  });

  await expect(requestNotificationPermissions()).resolves.toBe(true);
  expect(notifications.requestPermissionsAsync).not.toHaveBeenCalled();
});

it('sends the immediate test notification and reports provider failures', async () => {
  await expect(sendTestNotification()).resolves.toEqual({
    success: true,
    message: 'Test-Benachrichtigung wurde erfolgreich gesendet!',
  });
  expect(notifications.scheduleNotificationAsync).toHaveBeenCalledWith(
    expect.objectContaining({ trigger: null }),
  );

  notifications.scheduleNotificationAsync.mockRejectedValueOnce(new Error('scheduler offline'));
  await expect(sendTestNotification()).resolves.toEqual({
    success: false,
    message: 'scheduler offline',
  });
});

it('returns false when scheduling or cancelling a local reminder fails', async () => {
  notifications.scheduleNotificationAsync.mockRejectedValueOnce(new Error('scheduler offline'));
  await expect(
    scheduleLocalReminder({
      identifier: 'fam.glp1.injection-due.v1.user-1',
      date: new Date('2099-09-01T08:00:00.000Z'),
      title: 'Injektion fällig',
      body: 'Deine Injektion ist fällig.',
    }),
  ).resolves.toBe(false);

  notifications.cancelScheduledNotificationAsync.mockRejectedValueOnce(
    new Error('notifications unavailable'),
  );
  await expect(cancelLocalReminder('fam.glp1.injection-due.v1.user-1')).resolves.toBeUndefined();
});

it('does not schedule expiry reminders when there are no expiring items', async () => {
  await scheduleExpiryNotificationReminder(0, DEFAULT_NOTIFICATION_SETTINGS);

  expect(notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith(
    EXPIRY_NOTIFICATION_IDENTIFIER,
  );
  expect(notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
});

it('creates an Android notification channel before requesting permission', async () => {
  const originalDescriptor = Object.getOwnPropertyDescriptor(Platform, 'OS');
  Object.defineProperty(Platform, 'OS', { configurable: true, value: 'android' });

  try {
    await expect(requestNotificationPermissions()).resolves.toBe(true);
    expect(notifications.setNotificationChannelAsync).toHaveBeenCalledWith('reminders', {
      name: 'Erinnerungen',
      importance: ExpoNotifications.AndroidImportance.DEFAULT,
    });
  } finally {
    if (originalDescriptor) Object.defineProperty(Platform, 'OS', originalDescriptor);
  }
});
