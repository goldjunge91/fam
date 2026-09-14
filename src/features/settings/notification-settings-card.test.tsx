import { fireEvent, render, screen, userEvent } from '@testing-library/react-native';
import { i18n } from '@/i18n';
import { getNotificationSettings, saveNotificationSettings } from '@/lib/platform/notifications';
import { NotificationSettingsCard } from './notification-settings-card';

jest.mock('@expo/ui/community/datetime-picker', () => {
  const { Pressable } = jest.requireActual('react-native') as typeof import('react-native');

  function MockDateTimePicker({
    onValueChange,
  }: {
    onValueChange?: (
      event: { nativeEvent: { timestamp: number; utcOffset: number } },
      date: Date,
    ) => void;
  }) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Testzeit 10:12 einstellen"
        onPress={() =>
          onValueChange?.(
            { nativeEvent: { timestamp: 0, utcOffset: 0 } },
            new Date(2026, 0, 1, 10, 12),
          )
        }
      />
    );
  }

  return MockDateTimePicker;
});

jest.mock('@/lib/platform/notifications', () => ({
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
  beforeEach(async () => {
    jest.clearAllMocks();
    await i18n.changeLanguage('de');
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

  it('sollte frei wählbare Stunden und Minuten exakt speichern', async () => {
    const user = userEvent.setup();
    jest.mocked(getNotificationSettings).mockResolvedValueOnce({
      enabled: true,
      daysThreshold: 3,
      reminderHour: 9,
      reminderMinute: 15,
    });

    await render(<NotificationSettingsCard />);

    await user.press(screen.getByRole('button', { name: 'Uhrzeit der Erinnerung: 09:15 ändern' }));
    await user.press(screen.getByRole('button', { name: 'Testzeit 10:12 einstellen' }));
    await user.press(screen.getByRole('button', { name: 'Übernehmen' }));

    expect(saveNotificationSettings).toHaveBeenCalledWith(
      expect.objectContaining({ reminderHour: 10, reminderMinute: 12 }),
    );
  });
});
