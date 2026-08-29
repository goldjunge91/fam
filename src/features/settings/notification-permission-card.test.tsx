import { render } from '@testing-library/react-native';
import { getNotificationPermissionStatus } from '@/lib/notifications';
import { NotificationPermissionCard } from './notification-permission-card';
import { PermissionCard } from './permission-card';

jest.mock('@/lib/notifications', () => ({
  disableNotificationReminders: jest.fn().mockResolvedValue(undefined),
  getNotificationPermissionStatus: jest.fn().mockResolvedValue({
    granted: false,
    canAskAgain: true,
  }),
  requestNotificationPermissions: jest.fn().mockResolvedValue(false),
}));

jest.mock('./permission-card', () => ({
  PermissionCard: jest.fn(() => null),
}));

describe('NotificationPermissionCard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(getNotificationPermissionStatus).mockResolvedValue({
      granted: false,
      canAskAgain: true,
    });
  });

  it('reicht Benachrichtigungs-Copy und die Benachrichtigungs-Berechtigungsfunktionen an das geteilte Muster weiter', async () => {
    await render(<NotificationPermissionCard />);

    const props = jest.mocked(PermissionCard).mock.calls[0]?.[0];
    expect(props).toMatchObject({
      title: 'Benachrichtigungen',
      label: 'Benachrichtigungs-Zugriff',
      grantedCopy: expect.stringContaining('Erinnerungen'),
      deniedCopy: expect.stringContaining('Systemeinstellungen'),
    });
    expect(props?.usePermission).toEqual(expect.any(Function));
    expect(props?.onDisable).toEqual(expect.any(Function));
  });
});
