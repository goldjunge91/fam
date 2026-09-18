import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { SignInScreen } from '@/features/auth/screens/sign-in-screen';
import { i18n } from '@/i18n';

const mockSignIn = jest.fn();
const mockDebugLogEvent = jest.fn();

jest.mock('expo-router', () => {
  const actual = jest.requireActual<typeof import('expo-router')>('expo-router');

  return {
    ...actual,
    router: { replace: jest.fn() },
  };
});
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

jest.mock('@/lib/observability/debug-log', () => ({
  debugLogEvent: (...args: unknown[]) => mockDebugLogEvent(...args),
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

  beforeEach(async () => {
    jest.clearAllMocks();
    (router.replace as jest.Mock).mockReset();
    await i18n.changeLanguage('de');
  });

  it('rendert Formular für die Anmeldung', async () => {
    await renderScreen();

    expect(screen.getByText('Schön, dass du wieder da bist')).toBeTruthy();
    expect(screen.getByLabelText('E-Mail')).toBeTruthy();
    expect(screen.getByLabelText('Passwort')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Anmelden' })).toBeTruthy();
  });

  it('rendert Formular für die Anmeldung auf Englisch', async () => {
    await i18n.changeLanguage('en');
    await renderScreen();

    expect(screen.getByText('Welcome back')).toBeTruthy();
    expect(screen.getByLabelText('Email')).toBeTruthy();
    expect(screen.getByLabelText('Password')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeTruthy();
    expect(screen.getByText('or sign in with')).toBeTruthy();
    expect(screen.getByText('🌐  Sign in with Google')).toBeTruthy();
  });

  it('validiert leere Eingaben', async () => {
    await renderScreen();

    const submitBtn = screen.getByRole('button', { name: 'Anmelden' });
    await fireEvent.press(submitBtn);

    expect(mockSignIn).not.toHaveBeenCalled();
  });

  it('zeigt Validierungsfehler auf Englisch an', async () => {
    await i18n.changeLanguage('en');
    await renderScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByText('Please enter your email address.')).toBeOnTheScreen();
    expect(await screen.findByText('The password needs at least 8 characters.')).toBeOnTheScreen();
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
    expect(mockDebugLogEvent).toHaveBeenCalledWith('auth.sign-in.button-clicked', {
      source: 'button',
      identifierPresent: true,
      credentialPresent: true,
    });
    expect(mockDebugLogEvent).toHaveBeenCalledWith('auth.sign-in.submit.started', {
      source: 'button',
      identifierPresent: true,
      credentialPresent: true,
    });
    expect(mockDebugLogEvent).toHaveBeenCalledWith('auth.sign-in.submit.succeeded', {
      source: 'button',
    });
  });

  it('navigiert nach erfolgreicher Anmeldung zum App-Einstieg', async () => {
    mockSignIn.mockResolvedValue({ data: { session: {} }, error: null });

    await renderScreen();
    await fireEvent.changeText(screen.getByLabelText('E-Mail'), 'max@test.fam');
    await fireEvent.changeText(screen.getByLabelText('Passwort'), 'password123');
    await fireEvent.press(screen.getByRole('button', { name: 'Anmelden' }));

    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/'));
  });

  it('submit mit der Tastatur löst keinen Button-Click aus', async () => {
    mockSignIn.mockResolvedValue({ data: { session: {} }, error: null });

    await renderScreen();

    await fireEvent.changeText(screen.getByLabelText('E-Mail'), 'max@test.fam');
    const passwordInput = screen.getByLabelText('Passwort');
    await fireEvent.changeText(passwordInput, 'password123');
    await fireEvent(passwordInput, 'submitEditing');

    expect(mockSignIn).toHaveBeenCalledWith('max@test.fam', 'password123');
    expect(mockDebugLogEvent).not.toHaveBeenCalledWith(
      'auth.sign-in.button-clicked',
      expect.anything(),
    );
    expect(mockDebugLogEvent).toHaveBeenCalledWith('auth.sign-in.submit.started', {
      source: 'keyboard',
      identifierPresent: true,
      credentialPresent: true,
    });
    expect(mockDebugLogEvent).toHaveBeenCalledWith('auth.sign-in.submit.succeeded', {
      source: 'keyboard',
    });
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
