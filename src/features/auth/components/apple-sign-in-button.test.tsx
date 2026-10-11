import { fireEvent, render, screen } from '@testing-library/react-native';

import { i18n } from '@/i18n';

import { AppleSignInButton } from './apple-sign-in-button';

const mockSignInWithApple = jest.fn();
const mockAuthErrorMessage = jest.fn();

jest.mock('@/features/auth/oauth-provider-actions', () => ({
  signInWithApple: (...args: unknown[]) => mockSignInWithApple(...args),
}));

jest.mock('@/features/auth/domain/auth-error-message', () => ({
  authErrorMessage: (...args: unknown[]) => mockAuthErrorMessage(...args),
}));

describe('AppleSignInButton', () => {
  beforeEach(async () => {
    mockSignInWithApple.mockReset();
    mockSignInWithApple.mockResolvedValue({ error: null });
    mockAuthErrorMessage.mockReset();
    mockAuthErrorMessage.mockReturnValue('Anmeldung fehlgeschlagen');
    await i18n.changeLanguage('de');
  });

  it('renders an accessible icon-only Apple button', async () => {
    await render(<AppleSignInButton />);

    expect(screen.getByTestId('apple-sign-in-button')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Mit Apple anmelden' })).toBeTruthy();
  });

  it('starts the Apple sign-in flow when pressed', async () => {
    await render(<AppleSignInButton />);

    await fireEvent.press(screen.getByRole('button', { name: 'Mit Apple anmelden' }));

    expect(mockSignInWithApple).toHaveBeenCalledTimes(1);
  });

  it('announces the start and reports a sign-in error', async () => {
    const onError = jest.fn();
    const onAuthStart = jest.fn();
    mockSignInWithApple.mockResolvedValueOnce({ error: { message: 'network' } });

    await render(<AppleSignInButton onError={onError} onAuthStart={onAuthStart} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Mit Apple anmelden' }));

    expect(onError).toHaveBeenNthCalledWith(1, null);
    expect(onAuthStart).toHaveBeenCalledTimes(1);
    expect(mockAuthErrorMessage).toHaveBeenCalledWith({ message: 'network' }, expect.any(Function));
    expect(onError).toHaveBeenLastCalledWith('Anmeldung fehlgeschlagen');
  });

  it('ignores a sign-in error when no error callback was provided', async () => {
    mockSignInWithApple.mockResolvedValueOnce({ error: { message: 'network' } });

    await render(<AppleSignInButton />);
    await fireEvent.press(screen.getByRole('button', { name: 'Mit Apple anmelden' }));

    expect(mockAuthErrorMessage).not.toHaveBeenCalled();
  });
});
