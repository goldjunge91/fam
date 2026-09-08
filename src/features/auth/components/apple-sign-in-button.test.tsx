import { render, screen } from '@testing-library/react-native';
import { AppleAuthenticationButtonStyle } from 'expo-apple-authentication';
import type { ComponentProps } from 'react';
import type { View } from 'react-native';

import { AppleSignInButton } from './apple-sign-in-button';

type AppleButtonMockProps = ComponentProps<typeof View> & {
  buttonStyle: AppleAuthenticationButtonStyle;
};

let mockThemeMode: 'light' | 'dark' = 'light';

jest.mock('expo-apple-authentication', () => ({
  AppleAuthenticationButton: (props: AppleButtonMockProps) => {
    const { View: MockView } = require('react-native');
    return <MockView {...props} testID="apple-sign-in-button" />;
  },
  AppleAuthenticationButtonStyle: {
    BLACK: 'black',
    WHITE: 'white',
  },
  AppleAuthenticationButtonType: {
    SIGN_IN: 'sign-in',
  },
}));

jest.mock('@/components/theme/ThemeProvider', () => ({
  useTheme: () => ({ mode: mockThemeMode }),
}));

jest.mock('@/features/auth/domain/auth-error-message', () => ({
  authErrorMessage: jest.fn(),
}));

jest.mock('@/features/auth/provider-auth', () => ({
  signInWithApple: jest.fn(),
}));

describe('AppleSignInButton', () => {
  it('uses the light Apple button style for the light app theme', async () => {
    mockThemeMode = 'light';

    await render(<AppleSignInButton />);

    expect(screen.getByTestId('apple-sign-in-button')).toHaveProp(
      'buttonStyle',
      AppleAuthenticationButtonStyle.BLACK,
    );
  });

  it('uses the white Apple button style for the dark app theme', async () => {
    mockThemeMode = 'dark';

    await render(<AppleSignInButton />);

    expect(screen.getByTestId('apple-sign-in-button')).toHaveProp(
      'buttonStyle',
      AppleAuthenticationButtonStyle.WHITE,
    );
  });
});
