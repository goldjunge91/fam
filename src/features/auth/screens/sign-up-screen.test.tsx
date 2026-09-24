import { fireEvent, render, screen, userEvent, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { i18n } from '@/i18n';
import { SignUpScreen } from './sign-up-screen';

const initialMetrics = {
  frame: { x: 0, y: 0, width: 320, height: 640 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

function renderScreen() {
  return render(
    <SafeAreaProvider initialMetrics={initialMetrics}>
      <SignUpScreen />
    </SafeAreaProvider>,
  );
}

const mockSignUp = jest.fn();

jest.mock('expo-router', () => ({
  router: { replace: jest.fn(), back: jest.fn(), canGoBack: jest.fn(() => false) },
}));

jest.mock('@/features/auth/api', () => ({
  signUp: (...args: unknown[]) => mockSignUp(...args),
}));

jest.mock('@/features/auth/domain/auth-error-message', () => ({
  authErrorMessage: jest.fn((error) => error?.message || 'Fehler'),
}));

jest.mock('@/features/auth/oauth-provider-actions', () => ({
  signInWithOAuthProvider: jest.fn().mockResolvedValue({ error: null }),
  signInWithApple: jest.fn().mockResolvedValue({ error: null }),
}));

jest.mock('@/features/auth/components/email-verification-panel', () => ({
  EmailVerificationPanel: ({ email }: { email: string }) => {
    const { Text } = require('react-native');
    return <Text>Warteraum: {email}</Text>;
  },
}));

async function fillAndSubmit() {
  await fireEvent.changeText(screen.getByLabelText('E-Mail'), 'family@example.com');
  await fireEvent.changeText(screen.getByLabelText('Passwort'), 'supersecret');
  await fireEvent.changeText(screen.getByLabelText('Passwort wiederholen'), 'supersecret');
  await fireEvent.press(screen.getByRole('button', { name: 'Konto erstellen' }));
}

describe('SignUpScreen', () => {
  beforeEach(async () => {
    mockSignUp.mockReset();
    (router.replace as jest.Mock).mockReset();
    await i18n.changeLanguage('de');
  });

  it('rendert Formular für die Registrierung auf Englisch', async () => {
    await i18n.changeLanguage('en');
    await renderScreen();

    expect(screen.getByText('For you and your household')).toBeTruthy();
    expect(screen.getByLabelText('Email')).toBeTruthy();
    expect(screen.getByLabelText('Repeat password')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Create account' })).toBeTruthy();
    expect(screen.getByText('or continue with')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Sign in with Google' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Sign in with Apple' })).toBeTruthy();
  });

  it('wechselt aus der Card zur Anmeldung', async () => {
    await renderScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'Ich habe schon ein Konto' }));

    expect(router.replace).toHaveBeenCalledWith('/sign-in');
  });

  it('zeigt den Warteraum, wenn signUp ohne Session zurueckkommt (E-Mail-Bestaetigung noetig)', async () => {
    mockSignUp.mockResolvedValue({ data: { session: null }, error: null });

    await renderScreen();
    await fillAndSubmit();

    expect(await screen.findByText('Warteraum: family@example.com')).toBeTruthy();
    expect(router.replace).not.toHaveBeenCalled();
  });

  it('kann Passwort und Bestätigung beim Erstellen eines Kontos anzeigen', async () => {
    const user = userEvent.setup();
    await renderScreen();

    const passwordInput = screen.getByLabelText('Passwort');
    const confirmationInput = screen.getByLabelText('Passwort wiederholen');

    await user.type(passwordInput, 'supersecret');
    await user.type(confirmationInput, 'supersecret');
    expect(passwordInput).toHaveProp('secureTextEntry', true);
    expect(confirmationInput).toHaveProp('secureTextEntry', true);

    await user.press(screen.getByRole('button', { name: 'Passwort anzeigen' }));
    expect(passwordInput).toHaveProp('secureTextEntry', false);
    expect(passwordInput).toHaveDisplayValue('supersecret');
    expect(screen.getByRole('button', { name: 'Passwort verbergen' })).toBeOnTheScreen();

    await user.press(screen.getByRole('button', { name: 'Passwortbestätigung anzeigen' }));
    expect(confirmationInput).toHaveProp('secureTextEntry', false);
    expect(confirmationInput).toHaveDisplayValue('supersecret');
    expect(screen.getByRole('button', { name: 'Passwortbestätigung verbergen' })).toBeOnTheScreen();
  });

  it('navigiert direkt weiter, wenn signUp mit aktiver Session zurueckkommt', async () => {
    mockSignUp.mockResolvedValue({ data: { session: { access_token: 'x' } }, error: null });

    await renderScreen();
    await fillAndSubmit();

    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/onboarding'));
  });
});
