import { render, screen, userEvent } from '@testing-library/react-native';
import { router } from 'expo-router';
import type React from 'react';
import { DevPreviewsScreen } from './dev-previews-screen';

let mockHasAccess = true;

jest.mock('expo-router', () => {
  const React = require('react');
  const { Text } = require('react-native');
  return {
    Redirect: ({ href }: { href: string }) => React.createElement(Text, null, `Redirect: ${href}`),
    router: { push: jest.fn() },
  };
});

jest.mock('@/components/layout/screen', () => {
  const React = require('react');
  const { Text, View } = require('react-native');
  return {
    Screen: ({ title, children }: { title: string; children: React.ReactNode }) =>
      React.createElement(View, null, React.createElement(Text, null, title), children),
  };
});

jest.mock('@/components/ui/content-card', () => {
  const React = require('react');
  const { Text, View } = require('react-native');
  return {
    ContentCard: ({ title, children }: { title: string; children: React.ReactNode }) =>
      React.createElement(View, null, React.createElement(Text, null, title), children),
  };
});

jest.mock('@/constants/ui', () => {
  const React = require('react');
  const { Pressable, Text } = require('react-native');
  return {
    Button: ({ title, onPress }: { title: string; onPress: () => void }) =>
      React.createElement(
        Pressable,
        { accessibilityRole: 'button', onPress },
        React.createElement(Text, null, title),
      ),
  };
});

jest.mock('@/hooks/use-dev-tools-access', () => ({
  useDevToolsAccess: () => mockHasAccess,
}));

describe('DevPreviewsScreen', () => {
  beforeEach(() => {
    mockHasAccess = true;
    jest.mocked(router.push).mockClear();
  });

  it('opens each available preview and paywall route', async () => {
    const user = userEvent.setup();
    await render(<DevPreviewsScreen />);

    const destinations = [
      ['Design-System-Referenz öffnen', '/settings/design-system'],
      ['Drax-Drag-Demo öffnen', '/settings/drax-demo'],
      ['Auth-Seiten testen', '/settings/auth-preview'],
      ['Beleg-Scanner-Dummy öffnen', '/settings/dev/dummy-receipt-screen'],
      [
        'Plus-Paywall öffnen (Test Store)',
        { pathname: '/settings/plus-and-ai', params: { tier: 'plus' } },
      ],
      [
        'KI-Paywall öffnen (Test Store)',
        { pathname: '/settings/plus-and-ai', params: { tier: 'ai' } },
      ],
    ] as const;

    for (const [label] of destinations) {
      await user.press(screen.getByRole('button', { name: label }));
    }

    expect(jest.mocked(router.push).mock.calls.map(([destination]) => destination)).toEqual(
      destinations.map(([, destination]) => destination),
    );
  });

  it('redirects when developer access is unavailable', async () => {
    mockHasAccess = false;
    await render(<DevPreviewsScreen />);

    expect(screen.getByText('Redirect: /settings')).toBeOnTheScreen();
  });
});
