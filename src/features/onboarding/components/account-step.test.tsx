import { fireEvent, render, screen, userEvent } from '@testing-library/react-native';
import { i18n } from '@/i18n';
import { AccountStepForm } from './account-step';

const mockSignUp = jest.fn();
const mockSignIn = jest.fn();
const mockPush = jest.fn();
let mockSession: { user: { email: string } } | null = null;

jest.mock('expo-router', () => ({
  router: { push: (...args: unknown[]) => mockPush(...args) },
}));

jest.mock('@/features/auth/api', () => ({
  signIn: (...args: unknown[]) => mockSignIn(...args),
  signUp: (...args: unknown[]) => mockSignUp(...args),
}));

jest.mock('@/features/auth/domain/auth-error-message', () => ({
  authErrorMessage: jest.fn((error) => error?.message || 'Fehler'),
}));

jest.mock('@/features/auth/oauth-provider-actions', () => ({
  signInWithOAuthProvider: jest.fn().mockResolvedValue({ error: null }),
}));

jest.mock('@/features/auth/components/email-verification-panel', () => ({
  EmailVerificationPanel: ({
    email,
    onConfirmed,
    onChangeEmail,
  }: {
    email: string;
    onConfirmed: () => void;
    onChangeEmail: () => void;
  }) => {
    const { Button, Text, View } = require('react-native');
    return (
      <View>
        <Text>Warteraum: {email}</Text>
        <Button title="E-Mail bestätigt" onPress={onConfirmed} />
        <Button title="E-Mail ändern" onPress={onChangeEmail} />
      </View>
    );
  },
}));

jest.mock('@/features/auth/components/apple-sign-in-button', () => ({
  AppleSignInButton: () => {
    const { Button } = require('react-native');
    return <Button title="Mit Apple anmelden" onPress={jest.fn()} />;
  },
}));

jest.mock('@/features/auth/session-provider', () => ({
  useSession: () => ({ session: mockSession }),
}));

async function fillAndSubmit() {
  await fireEvent.changeText(screen.getByLabelText('E-Mail'), 'family@example.com');
  await fireEvent.changeText(screen.getByLabelText('Passwort'), 'supersecret');
  await fireEvent.changeText(screen.getByLabelText('Passwort wiederholen'), 'supersecret');
  await fireEvent.press(screen.getByRole('button', { name: 'Konto erstellen' }));
}

describe('AccountStepForm', () => {
  beforeEach(async () => {
    mockSignUp.mockReset();
    mockSignIn.mockReset();
    mockPush.mockReset();
    mockSession = null;
    await i18n.changeLanguage('de');
  });

  it('zeigt keine entfernte Unterzeile als Übersetzungs-ID an', async () => {
    await render(<AccountStepForm onNext={jest.fn()} />);

    expect(screen.queryByText('auth.signUp.subtitle')).not.toBeOnTheScreen();
  });

  it('bietet Apple und Google sowie beim Anmelden den Passwort-Reset an', async () => {
    await render(<AccountStepForm onNext={jest.fn()} />);

    expect(screen.getByRole('button', { name: 'Mit Apple anmelden' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Mit Google anmelden' })).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'Ich habe schon ein Konto' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Passwort vergessen' }));

    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/forgot-password',
      params: { from: 'onboarding' },
    });
  });

  it('zeigt den Warteraum statt onNext aufzurufen, wenn sign_up ohne Session zurueckkommt', async () => {
    mockSignUp.mockResolvedValue({ data: { session: null }, error: null });
    const onNext = jest.fn();

    await render(<AccountStepForm onNext={onNext} />);
    await fillAndSubmit();

    expect(await screen.findByText('Warteraum: family@example.com')).toBeTruthy();
    expect(onNext).not.toHaveBeenCalled();
  });

  it('ruft onNext auf, wenn sign_up direkt eine Session liefert', async () => {
    mockSignUp.mockResolvedValue({ data: { session: { access_token: 'x' } }, error: null });
    const onNext = jest.fn();

    await render(<AccountStepForm onNext={onNext} />);
    await fillAndSubmit();

    expect(onNext).toHaveBeenCalled();
  });

  it('wechselt nach Google-Login weiter, sobald die OAuth-Session eintrifft', async () => {
    const user = userEvent.setup();
    const onNext = jest.fn();
    const view = await render(<AccountStepForm onNext={onNext} />);

    await user.press(screen.getByRole('button', { name: 'Mit Google anmelden' }));
    expect(onNext).not.toHaveBeenCalled();

    mockSession = { user: { email: 'family@example.com' } };
    await view.rerender(<AccountStepForm onNext={onNext} />);

    expect(onNext).toHaveBeenCalledTimes(1);
  });

  it('zeigt ein bereits angemeldetes Konto und kann direkt fortfahren', async () => {
    const user = userEvent.setup();
    const onNext = jest.fn();
    mockSession = { user: { email: 'family@example.com' } };

    await render(<AccountStepForm onNext={onNext} />);

    expect(screen.getByText('✓ Angemeldet als: family@example.com')).toBeOnTheScreen();
    await user.press(screen.getByRole('button', { name: 'Weiter' }));
    expect(onNext).toHaveBeenCalledTimes(1);
  });

  it('geht aus der E-Mail-Verifizierung weiter oder zurück zur Kontoerstellung', async () => {
    const user = userEvent.setup();
    mockSignUp.mockResolvedValue({ data: { session: null }, error: null });
    const onNext = jest.fn();

    await render(<AccountStepForm onNext={onNext} />);
    await fillAndSubmit();
    await user.press(await screen.findByRole('button', { name: 'E-Mail ändern' }));

    expect(screen.getByRole('button', { name: 'Konto erstellen' })).toBeOnTheScreen();
    await fillAndSubmit();
    await user.press(await screen.findByRole('button', { name: 'E-Mail bestätigt' }));
    expect(onNext).toHaveBeenCalledTimes(1);
  });
});
