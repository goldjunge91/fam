import { fireEvent, render, screen } from '@testing-library/react-native';
import { saveNotificationSettings } from '@/lib/notifications';
import { NotificationSettingsCard } from './notification-settings-card';

jest.mock('@/lib/notifications', () => ({
  DEFAULT_NOTIFICATION_SETTINGS: {
    enabled: false,
    daysThreshold: 3,
    reminderHour: 9,
    reminderMinute: 0,
  },
  getNotificationSettings: jest.fn().mockResolvedValue({
    enabled: false,
    daysThreshold: 3,
    reminderHour: 9,
    reminderMinute: 0,
  }),
  saveNotificationSettings: jest.fn().mockResolvedValue(undefined),
  requestNotificationPermissions: jest.fn().mockResolvedValue(true),
}));

describe('NotificationSettingsCard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('sollte den Titel "Benachrichtigungen" und Schalter rendern', async () => {
    await render(<NotificationSettingsCard />);

    expect(screen.getByText('Benachrichtigungen')).toBeTruthy();
    expect(screen.getByText('Erinnerung aktivieren')).toBeTruthy();
  });

  it('sollte bei Schalter-Aktivierung Optionen einblenden und saveNotificationSettings aufrufen', async () => {
    await render(<NotificationSettingsCard />);

    const switchEl = screen.getByRole('switch');
    await fireEvent(switchEl, 'valueChange', true);

    expect(saveNotificationSettings).toHaveBeenCalledWith(
      expect.objectContaining({ enabled: true }),
    );
    expect(screen.getByText('Erinnern ab (Tage im Voraus):')).toBeTruthy();
    expect(screen.getByText('Uhrzeit der Erinnerung:')).toBeTruthy();
  });
});
