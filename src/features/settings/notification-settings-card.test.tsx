import { fireEvent, render, screen } from '@testing-library/react-native';
import { saveNotificationSettings } from '@/lib/notifications';
import { NotificationSettingsCard } from './notification-settings-card';

jest.mock('@/lib/notifications', () => ({
  DEFAULT_NOTIFICATION_SETTINGS: {
    enabled: true,
    daysThreshold: 3,
    reminderHour: 9,
    reminderMinute: 0,
  },
  getNotificationSettings: jest.fn().mockResolvedValue({
    enabled: true,
    daysThreshold: 3,
    reminderHour: 9,
    reminderMinute: 0,
  }),
  saveNotificationSettings: jest.fn().mockResolvedValue(undefined),
}));

describe('NotificationSettingsCard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('sollte Titel und Zeitplan-Optionen direkt rendern, ohne Berechtigungs-Schalter', async () => {
    await render(<NotificationSettingsCard />);

    expect(screen.getByText('Benachrichtigungen')).toBeTruthy();
    expect(screen.getByText('Erinnern ab (Tage im Voraus):')).toBeTruthy();
    expect(screen.getByText('Uhrzeit der Erinnerung:')).toBeTruthy();
    expect(screen.queryByRole('switch')).toBeNull();
  });

  it('sollte bei Auswahl eines Schwellenwerts saveNotificationSettings aufrufen', async () => {
    await render(<NotificationSettingsCard />);

    await fireEvent.press(screen.getByText('5 Tage'));

    expect(saveNotificationSettings).toHaveBeenCalledWith(
      expect.objectContaining({ daysThreshold: 5 }),
    );
  });
});
