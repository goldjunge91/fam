import { render, screen, userEvent, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ResetPasswordScreen } from '@/features/auth/screens/reset-password-screen';

const mockUpdatePassword = jest.fn();
const mockReplace = jest.fn();

jest.mock('expo-router', () => ({
  router: { replace: (...args: unknown[]) => mockReplace(...args) },
}));

jest.mock('@/features/auth/api', () => ({
  updatePassword: (...args: unknown[]) => mockUpdatePassword(...args),
}));

jest.mock('@/features/auth/domain/auth-error-message', () => ({
  authErrorMessage: (error: { message: string }) => error.message,
}));

describe('ResetPasswordScreen', () => {
  async function renderScreen() {
    return render(
      <SafeAreaProvider
        initialMetrics={{
          frame: { x: 0, y: 0, width: 390, height: 844 },
          insets: { top: 47, left: 0, right: 0, bottom: 34 },
        }}>
        <ResetPasswordScreen />
      </SafeAreaProvider>,
    );
  }

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rendert Felder für neues Passwort und Bestätigung', async () => {
    await renderScreen();

    expect(screen.getByRole('button', { name: 'Passwort speichern' })).toBeTruthy();
  });

  it('validiert abweichende Passwort-Bestätigung', async () => {
    await renderScreen();

    const user = userEvent.setup();
    const passInput = screen.getByLabelText('Neues Passwort');
    const confirmInput = screen.getByLabelText('Passwort wiederholen');

    await user.type(passInput, 'geheim1234');
    await user.type(confirmInput, 'anders1234');

    const submitBtn = screen.getByRole('button', { name: 'Passwort speichern' });
    await user.press(submitBtn);

    expect(mockUpdatePassword).not.toHaveBeenCalled();
    expect(await screen.findByText('Die Passwörter stimmen nicht überein.')).toBeTruthy();
  });

  it('speichert neues Passwort und leitet zur Startseite weiter', async () => {
    mockUpdatePassword.mockResolvedValue({ error: null });

    await renderScreen();

    const user = userEvent.setup();
    const passInput = screen.getByLabelText('Neues Passwort');
    const confirmInput = screen.getByLabelText('Passwort wiederholen');

    await user.type(passInput, 'geheim1234');
    await user.type(confirmInput, 'geheim1234');

    const submitBtn = screen.getByRole('button', { name: 'Passwort speichern' });
    await user.press(submitBtn);

    await waitFor(() => {
      expect(mockUpdatePassword).toHaveBeenCalledWith('geheim1234');
      expect(mockReplace).toHaveBeenCalledWith('/');
    });
  });
});
