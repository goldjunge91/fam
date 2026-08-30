import * as ExpoNotifications from 'expo-notifications';
import {
  cancelLocalReminder,
  cancelUserNotificationReminders,
  disableNotificationReminders,
  EXPIRY_NOTIFICATION_IDENTIFIER,
  scheduleExpiryNotificationReminder,
  scheduleLocalReminder,
} from './notifications';

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

beforeEach(() => {
  jest.clearAllMocks();
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
