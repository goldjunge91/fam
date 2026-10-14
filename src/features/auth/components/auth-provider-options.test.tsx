import { render, screen, userEvent } from '@testing-library/react-native';
import { i18n } from '@/i18n';
import { AuthProviderOptions } from './auth-provider-options';

const mockSignInWithOAuthProvider = jest.fn();

jest.mock('@/features/auth/components/apple-sign-in-button', () => {
  const { Pressable, Text } = require('react-native');
  return {
    AppleSignInButton: ({
      onAuthStart,
      onError,
    }: {
      onAuthStart?: () => void;
      onError: (error: string) => void;
    }) => (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Apple sign-in"
        onPress={() => {
          onAuthStart?.();
          onError('Apple failed');
        }}>
        <Text>Apple sign-in</Text>
      </Pressable>
    ),
  };
});

jest.mock('@/features/auth/components/auth-provider-icon-button', () => {
  const { Pressable, Text } = require('react-native');
  return {
    AuthProviderIconButton: ({
      accessibilityLabel,
      onPress,
    }: {
      accessibilityLabel: string;
      onPress: () => void;
    }) => (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        onPress={onPress}>
        <Text>{accessibilityLabel}</Text>
      </Pressable>
    ),
  };
});

jest.mock('@/features/auth/oauth-provider-actions', () => ({
  signInWithOAuthProvider: (...args: unknown[]) => mockSignInWithOAuthProvider(...args),
}));

jest.mock('@/features/auth/domain/auth-error-message', () => ({
  authErrorMessage: () => 'OAuth failed',
}));

describe('AuthProviderOptions', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await i18n.changeLanguage('de');
    mockSignInWithOAuthProvider.mockResolvedValue({ error: null });
  });

  it('shows provider actions and announces a sign-in attempt', async () => {
    const user = userEvent.setup();
    const onAuthAttempt = jest.fn();
    await render(<AuthProviderOptions mode="sign_in" onAuthAttempt={onAuthAttempt} />);

    await user.press(screen.getByRole('button', { name: i18n.t('auth.providers.googleSignIn') }));
    expect(onAuthAttempt).toHaveBeenCalledTimes(1);
    expect(mockSignInWithOAuthProvider).toHaveBeenCalledWith('google');
  });

  it('maps OAuth and Apple failures and clears a previous OAuth failure on retry', async () => {
    const user = userEvent.setup();
    const onAuthAttempt = jest.fn();
    mockSignInWithOAuthProvider.mockResolvedValueOnce({ error: new Error('provider error') });
    await render(<AuthProviderOptions mode="sign_up" onAuthAttempt={onAuthAttempt} />);

    await user.press(screen.getByRole('button', { name: i18n.t('auth.providers.googleSignIn') }));
    expect(screen.getByText('OAuth failed')).toBeOnTheScreen();

    await user.press(screen.getByRole('button', { name: i18n.t('auth.providers.googleSignIn') }));
    expect(screen.queryByText('OAuth failed')).not.toBeOnTheScreen();
    await user.press(screen.getByRole('button', { name: 'Apple sign-in' }));
    expect(screen.getByText('Apple failed')).toBeOnTheScreen();
    expect(onAuthAttempt).toHaveBeenCalledTimes(3);
  });
});
