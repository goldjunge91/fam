import { render, screen, userEvent } from '@testing-library/react-native';
import { router } from 'expo-router';
import type { ReactNode } from 'react';

import { AuthPreviewScreen } from './auth-preview-screen';

jest.mock('expo-router', () => ({
  router: { push: jest.fn() },
}));

jest.mock('@/components/layout/screen', () => {
  const { Text: MockText, View: MockView } = jest.requireActual(
    'react-native',
  ) as typeof import('react-native');
  type MockProps = { children: ReactNode; title?: string };

  return {
    Screen: ({ children, title }: MockProps) => (
      <MockView>
        {title ? <MockText>{title}</MockText> : null}
        {children}
      </MockView>
    ),
  };
});

jest.mock('@/constants/ui', () => {
  const {
    Pressable: MockPressable,
    Text: MockText,
    View: MockView,
  } = jest.requireActual('react-native') as typeof import('react-native');
  type MockButtonProps = {
    accessibilityLabel?: string;
    onPress: () => void;
    title: string;
  };
  type MockTextProps = { children: ReactNode };
  type MockCardProps = { children: ReactNode };

  return {
    Button: ({ accessibilityLabel, onPress, title }: MockButtonProps) => (
      <MockPressable
        accessibilityLabel={accessibilityLabel ?? title}
        accessibilityRole="button"
        onPress={onPress}>
        <MockText>{title}</MockText>
      </MockPressable>
    ),
    Card: ({ children }: MockCardProps) => <MockView>{children}</MockView>,
    Txt: ({ children }: MockTextProps) => <MockText>{children}</MockText>,
  };
});

describe('AuthPreviewScreen', () => {
  it('öffnet alle echten Auth-Routen', async () => {
    const user = userEvent.setup();
    await render(<AuthPreviewScreen />);

    const routes = [
      ['Anmeldung öffnen', '/sign-in'],
      ['Registrierung öffnen', '/sign-up'],
      ['Passwort-Link anfordern', '/forgot-password'],
      ['Neues Passwort setzen', '/reset-password'],
    ] as const;

    for (const [title, route] of routes) {
      await user.press(screen.getByRole('button', { name: new RegExp(title) }));
      expect(router.push).toHaveBeenLastCalledWith(route);
    }
  });
});
