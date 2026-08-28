import { fireEvent, render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { SignInScreen } from '@/features/auth/screens/sign-in-screen';

const mockSignIn = jest.fn();

jest.mock('@/features/auth/api', () => ({
  signIn: (...args: unknown[]) => mockSignIn(...args),
}));

jest.mock('@/features/auth/provider-auth', () => ({
  signInWithOAuthProvider: jest.fn(),
  signInWithApple: jest.fn(),
}));

jest.mock('@/features/auth/domain/auth-error-message', () => ({
  authErrorMessage: (error: { message: string }) => error.message,
}));

describe('SignInScreen', () => {
  async function renderScreen() {
    return render(
      <SafeAreaProvider
        initialMetrics={{
          frame: { x: 0, y: 0, width: 390, height: 844 },
          insets: { top: 47, left: 0, right: 0, bottom: 34 },
        }}>
        <SignInScreen />
      </SafeAreaProvider>,
    );
  }

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rendert Formular für die Anmeldung', async () => {
    await renderScreen();

    expect(screen.getByText('Schön, dass du wieder da bist')).toBeTruthy();
    expect(screen.getByLabelText('E-Mail')).toBeTruthy();
    expect(screen.getByLabelText('Passwort')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Anmelden' })).toBeTruthy();
  });

  it('validiert leere Eingaben', async () => {
    await renderScreen();

    const submitBtn = screen.getByRole('button', { name: 'Anmelden' });
    await fireEvent.press(submitBtn);

    expect(mockSignIn).not.toHaveBeenCalled();
  });

  it('ruft signIn bei gültigen Zugangsdaten auf', async () => {
    mockSignIn.mockResolvedValue({ data: { session: {} }, error: null });

    await renderScreen();

    const emailInput = screen.getByLabelText('E-Mail');
    const passInput = screen.getByLabelText('Passwort');

    await fireEvent.changeText(emailInput, 'max@test.fam');
    await fireEvent.changeText(passInput, 'password123');

    const submitBtn = screen.getByRole('button', { name: 'Anmelden' });
    await fireEvent.press(submitBtn);

    expect(mockSignIn).toHaveBeenCalledWith('max@test.fam', 'password123');
  });

  it('zeigt Fehler an wenn Anmeldung fehlschlägt', async () => {
    mockSignIn.mockResolvedValue({
      data: { session: null },
      error: { message: 'Ungültige Zugangsdaten' },
    });

    await renderScreen();

    const emailInput = screen.getByLabelText('E-Mail');
    const passInput = screen.getByLabelText('Passwort');

    await fireEvent.changeText(emailInput, 'max@test.fam');
    await fireEvent.changeText(passInput, 'wrongpassword');

    const submitBtn = screen.getByRole('button', { name: 'Anmelden' });
    await fireEvent.press(submitBtn);

    expect(await screen.findByText('Ungültige Zugangsdaten')).toBeTruthy();
  });
});
