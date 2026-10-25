import { render, screen } from '@testing-library/react-native';
import { ResetPasswordScreen } from '@/features/auth/screens/reset-password-screen';

jest.mock('@/features/auth/screens/password-recovery-screen', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { Text } = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    PasswordRecoveryScreen: () =>
      React.createElement(Text, { testID: 'password-recovery-flow' }, 'Code entry'),
  };
});

describe('ResetPasswordScreen', () => {
  it('keeps the old route attached to the code-based recovery flow', async () => {
    await render(<ResetPasswordScreen />);

    expect(screen.getByTestId('password-recovery-flow')).toHaveTextContent('Code entry');
  });
});
