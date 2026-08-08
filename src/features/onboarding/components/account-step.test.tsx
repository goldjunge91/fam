import { fireEvent, render, screen } from '@testing-library/react-native';
import { AccountStepForm } from './account-step';

const mockSignUp = jest.fn();
const mockSignIn = jest.fn();

jest.mock('@/features/auth/api', () => ({
  authErrorMessage: jest.fn((err) => err?.message || 'Fehler'),
  signIn: (...args: unknown[]) => mockSignIn(...args),
  signUp: (...args: unknown[]) => mockSignUp(...args),
}));

jest.mock('@/features/auth/components/pending-auth-banner', () => ({
  PendingAuthBanner: ({ email }: { email: string }) => {
    const { Text } = require('react-native');
    return <Text>Warteraum: {email}</Text>;
  },
}));

jest.mock('@/features/auth/session-provider', () => ({
  useSession: () => ({ session: null }),
}));

jest.mock('@/hooks/use-theme', () => ({
  useTheme: () => ({
    text: '#000000',
    textSecondary: '#666666',
    accent: '#208AEF',
    danger: '#C62828',
    border: '#CCCCCC',
    backgroundElement: '#F0F0F3',
  }),
}));

async function fillAndSubmit() {
  await fireEvent.changeText(screen.getByLabelText('E-Mail Adresse'), 'family@example.com');
  await fireEvent.changeText(screen.getByLabelText('Passwort'), 'supersecret');
  await fireEvent.press(screen.getByRole('button', { name: 'Konto erstellen & weiter' }));
}

describe('AccountStepForm', () => {
  beforeEach(() => {
    mockSignUp.mockReset();
    mockSignIn.mockReset();
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
});
