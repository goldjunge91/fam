import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import {
  disableNotificationReminders,
  getNotificationPermissionStatus,
  requestNotificationPermissions,
} from '@/lib/notifications';
import { NotificationPermissionCard } from './notification-permission-card';

jest.mock('@/lib/notifications', () => ({
  disableNotificationReminders: jest.fn().mockResolvedValue(undefined),
  getNotificationPermissionStatus: jest.fn().mockResolvedValue({
    granted: false,
    canAskAgain: true,
  }),
  requestNotificationPermissions: jest.fn().mockResolvedValue(false),
}));

const mockedGetNotificationPermissionStatus = jest.mocked(getNotificationPermissionStatus);
const mockedRequestNotificationPermissions = jest.mocked(requestNotificationPermissions);
const mockedDisableNotificationReminders = jest.mocked(disableNotificationReminders);

describe('NotificationPermissionCard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('aktiviert Nutzung und Status nach erteilter Berechtigung', async () => {
    mockedGetNotificationPermissionStatus.mockResolvedValue({
      granted: false,
      canAskAgain: true,
    });
    mockedRequestNotificationPermissions.mockResolvedValue(true);

    await render(<NotificationPermissionCard />);
    fireEvent(screen.getByRole('switch'), 'valueChange', true);

    await waitFor(() => {
      expect(mockedRequestNotificationPermissions).toHaveBeenCalledTimes(1);
      expect(mockedDisableNotificationReminders).not.toHaveBeenCalled();
    });
  });

  it('deaktiviert Nutzung nach abgelehnter Berechtigung', async () => {
    mockedGetNotificationPermissionStatus.mockResolvedValue({
      granted: false,
      canAskAgain: true,
    });
    mockedRequestNotificationPermissions.mockResolvedValue(false);

    await render(<NotificationPermissionCard />);
    fireEvent(screen.getByRole('switch'), 'valueChange', true);

    await waitFor(() => {
      expect(mockedDisableNotificationReminders).toHaveBeenCalledTimes(1);
    });
  });

  it('deaktiviert Nutzung, wenn der Nutzer den Schalter ausschaltet', async () => {
    mockedGetNotificationPermissionStatus.mockResolvedValue({
      granted: true,
      canAskAgain: true,
    });

    await render(<NotificationPermissionCard />);
    fireEvent(screen.getByRole('switch'), 'valueChange', false);

    await waitFor(() => {
      expect(mockedDisableNotificationReminders).toHaveBeenCalledTimes(1);
      expect(mockedRequestNotificationPermissions).not.toHaveBeenCalled();
    });
  });
});
