import { render, screen } from '@testing-library/react-native';
import { NotificationSettingsCard } from './notification-settings-card';

describe('NotificationSettingsCard', () => {
  it('sollte den Titel "Benachrichtigungen" und Schalter rendern', async () => {
    await render(<NotificationSettingsCard />);

    expect(screen.getByText('Benachrichtigungen')).toBeTruthy();
    expect(screen.getByText('Erinnerung aktivieren')).toBeTruthy();
  });
});
