import * as ExpoNotifications from 'expo-notifications';
import {
  cancelLocalReminder,
  EXPIRY_NOTIFICATION_IDENTIFIER,
  scheduleExpiryNotificationReminder,
  scheduleLocalReminder,
} from './notifications';

const notifications = jest.mocked(ExpoNotifications);

beforeEach(() => {
  jest.clearAllMocks();
  notifications.getPermissionsAsync.mockResolvedValue({
    status: ExpoNotifications.PermissionStatus.GRANTED,
    canAskAgain: true,
    expires: 'never',
    granted: true,
    ios: undefined,
    android: undefined,
  });
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
