import { render, screen, userEvent } from '@testing-library/react-native';
import { useReducedMotion } from 'react-native-reanimated';
import { AuthProviderIconButton } from './auth-provider-icon-button';

describe('AuthProviderIconButton', () => {
  beforeEach(() => {
    jest.mocked(useReducedMotion).mockReturnValue(false);
  });

  it('renders and activates the Google provider', async () => {
    const user = userEvent.setup();
    const onPress = jest.fn();
    await render(
      <AuthProviderIconButton accessibilityLabel="Google" onPress={onPress} provider="google" />,
    );

    await user.press(screen.getByRole('button', { name: 'Google' }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('renders Apple and honors reduced motion while pressing', async () => {
    jest.mocked(useReducedMotion).mockReturnValue(true);
    const user = userEvent.setup();
    const onPress = jest.fn();
    await render(
      <AuthProviderIconButton accessibilityLabel="Apple" onPress={onPress} provider="apple" />,
    );

    await user.press(screen.getByRole('button', { name: 'Apple' }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
