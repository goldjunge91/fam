import { render, screen, userEvent } from '@testing-library/react-native';
import { router } from 'expo-router';
import type { ReactNode } from 'react';

import { AuthPreviewScreen } from './auth-preview-screen';

let mockHasAccess = true;

jest.mock('expo-router', () => ({
  router: { push: jest.fn() },
  Redirect: ({ href }: { href: string }) => {
    const React = require('react');
    const { Text: MockText } = require('react-native');
    return React.createElement(MockText, null, `Redirect: ${href}`);
  },
}));

jest.mock('@/hooks/use-dev-tools-access', () => ({
  useDevToolsAccess: () => mockHasAccess,
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
  beforeEach(() => {
    mockHasAccess = true;
    jest.mocked(router.push).mockClear();
  });

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

  it('leitet ohne Entwickler-Zugriff zu den Einstellungen um', async () => {
    mockHasAccess = false;
    await render(<AuthPreviewScreen />);

    expect(screen.getByText('Redirect: /settings')).toBeOnTheScreen();
    expect(router.push).not.toHaveBeenCalled();
  });
});
