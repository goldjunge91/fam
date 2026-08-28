import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
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

jest.mock('@/features/auth/provider-auth', () => ({
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
  beforeEach(() => {
    mockSignUp.mockReset();
    (router.replace as jest.Mock).mockReset();
  });

  it('zeigt den Warteraum, wenn signUp ohne Session zurueckkommt (E-Mail-Bestaetigung noetig)', async () => {
    mockSignUp.mockResolvedValue({ data: { session: null }, error: null });

    await renderScreen();
    await fillAndSubmit();

    expect(await screen.findByText('Warteraum: family@example.com')).toBeTruthy();
    expect(router.replace).not.toHaveBeenCalled();
  });

  it('navigiert direkt weiter, wenn signUp mit aktiver Session zurueckkommt', async () => {
    mockSignUp.mockResolvedValue({ data: { session: { access_token: 'x' } }, error: null });

    await renderScreen();
    await fillAndSubmit();

    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/onboarding'));
  });
});
