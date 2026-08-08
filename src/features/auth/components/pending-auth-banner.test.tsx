import { fireEvent, render, screen } from '@testing-library/react-native';
import { PendingAuthBanner } from './pending-auth-banner';

jest.mock('@/features/auth/api', () => ({
  authErrorMessage: jest.fn((err) => err?.message || 'Fehler'),
  resendConfirmationEmail: jest.fn().mockResolvedValue({ error: null }),
  signIn: jest.fn().mockResolvedValue({ data: { session: null }, error: null }),
}));

jest.mock('@/lib/supabase', () => ({
  getSupabase: () => ({
    auth: {
      getSession: jest.fn().mockResolvedValue({ data: { session: null } }),
      onAuthStateChange: jest.fn().mockReturnValue({
        data: { subscription: { unsubscribe: jest.fn() } },
      }),
    },
  }),
}));

jest.mock('@/hooks/use-theme', () => ({
  useTheme: () => ({
    background: '#FFFFFF',
    backgroundElement: '#F0F0F3',
    backgroundSelected: '#E0E1E6',
    text: '#000000',
    border: '#CCCCCC',
    textSecondary: '#666666',
    accent: '#208AEF',
    danger: '#C62828',
  }),
}));

describe('PendingAuthBanner (Apple Liquid UI)', () => {
  it('sollte E-Mail-Adresse und Bestätigungs-Hinweis rendern', async () => {
    await render(
      <PendingAuthBanner
        email="test@example.com"
        onConfirmed={jest.fn()}
        onChangeEmail={jest.fn()}
      />,
    );

    expect(screen.getByText('Bestätigung ausstehend')).toBeTruthy();
    expect(screen.getByText('test@example.com')).toBeTruthy();
    expect(screen.getByText('Bestätigungs-E-Mail erneut senden')).toBeTruthy();
    expect(screen.getByText('Andere E-Mail-Adresse verwenden')).toBeTruthy();
  });

  it('sollte Re-Send E-Mail auslösen bei Klick auf den Button', async () => {
    const { resendConfirmationEmail } = require('@/features/auth/api');

    await render(<PendingAuthBanner email="test@example.com" onConfirmed={jest.fn()} />);

    const resendBtn = screen.getByText('Bestätigungs-E-Mail erneut senden');
    await fireEvent.press(resendBtn);

    expect(resendConfirmationEmail).toHaveBeenCalledWith('test@example.com');
  });

  it('sollte onChangeEmail auslösen wenn angeklickt', async () => {
    const onChangeEmailMock = jest.fn();

    await render(
      <PendingAuthBanner
        email="test@example.com"
        onConfirmed={jest.fn()}
        onChangeEmail={onChangeEmailMock}
      />,
    );

    const changeBtn = screen.getByText('Andere E-Mail-Adresse verwenden');
    await fireEvent.press(changeBtn);

    expect(onChangeEmailMock).toHaveBeenCalled();
  });
});
