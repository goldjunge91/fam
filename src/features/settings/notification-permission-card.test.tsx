import { act, render, renderHook, waitFor } from '@testing-library/react-native';
import { AppState } from 'react-native';
import { i18n } from '@/i18n';
import {
  disableNotificationReminders,
  getNotificationPermissionStatus,
  requestNotificationPermissions,
} from '@/lib/platform/notifications';
import { NotificationPermissionCard } from './notification-permission-card';
import { PermissionCard } from './permission-card';

jest.mock('@/lib/platform/notifications', () => ({
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
    await i18n.changeLanguage('de');
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

  it('aktualisiert den Status beim Zurückkehren und deaktiviert Erinnerungen nach einer Ablehnung', async () => {
    await i18n.changeLanguage('de');
    await render(<NotificationPermissionCard />);
    const usePermission = jest.mocked(PermissionCard).mock.calls[0]?.[0].usePermission;
    if (!usePermission) throw new Error('Benachrichtigungsberechtigung fehlt');

    const appStateSpy = jest.spyOn(AppState, 'addEventListener');
    const { result, unmount } = await renderHook(() => usePermission());
    await waitFor(() => expect(getNotificationPermissionStatus).toHaveBeenCalledTimes(1));
    expect(result.current[0]).toEqual({ granted: false, canAskAgain: true });

    const onAppStateChange = appStateSpy.mock.calls[0]?.[1];
    await act(async () => onAppStateChange?.('active'));
    await waitFor(() => expect(getNotificationPermissionStatus).toHaveBeenCalledTimes(2));
    await act(async () => onAppStateChange?.('background'));
    expect(getNotificationPermissionStatus).toHaveBeenCalledTimes(2);

    await act(async () => result.current[1]());
    expect(disableNotificationReminders).toHaveBeenCalledTimes(1);

    jest.mocked(requestNotificationPermissions).mockResolvedValueOnce(true);
    await act(async () => result.current[1]());
    expect(result.current[0]).toMatchObject({ granted: true });

    await unmount();
    appStateSpy.mockRestore();
  });
});
