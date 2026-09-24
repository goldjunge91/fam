import { fireEvent, render, screen } from '@testing-library/react-native';

import { i18n } from '@/i18n';

import { AppleSignInButton } from './apple-sign-in-button';

const mockSignInWithApple = jest.fn();

jest.mock('@/features/auth/oauth-provider-actions', () => ({
  signInWithApple: (...args: unknown[]) => mockSignInWithApple(...args),
}));

jest.mock('@/features/auth/domain/auth-error-message', () => ({
  authErrorMessage: jest.fn(),
}));

describe('AppleSignInButton', () => {
  beforeEach(async () => {
    mockSignInWithApple.mockReset();
    mockSignInWithApple.mockResolvedValue({ error: null });
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
});
