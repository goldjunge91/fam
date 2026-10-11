import { render, screen, userEvent } from '@testing-library/react-native';
import type React from 'react';
import { DesignSystemScreen } from './design-system-screen';

let mockHasAccess = true;
let mockMode: 'light' | 'dark' = 'light';

jest.mock('expo-router', () => {
  const React = require('react');
  const { Text } = require('react-native');

  return {
    Redirect: ({ href }: { href: string }) => React.createElement(Text, null, `Redirect: ${href}`),
  };
});

jest.mock('react-native-keyboard-controller', () => {
  const React = require('react');
  const { Text, View } = require('react-native');
  const KeyboardToolbar = Object.assign(
    ({ children }: { children: React.ReactNode }) => React.createElement(View, null, children),
    { Done: ({ text }: { text: string }) => React.createElement(Text, null, text) },
  );
  return { KeyboardToolbar };
});

jest.mock('@/components/layout/screen', () => {
  const React = require('react');
  const { Text, View } = require('react-native');

  return {
    Screen: ({ title, children }: { title: string; children: React.ReactNode }) =>
      React.createElement(View, null, React.createElement(Text, null, title), children),
  };
});

jest.mock('@/components/theme/ThemeProvider', () => ({
  useTheme: () => ({ mode: mockMode }),
}));

jest.mock('@/components/ui/filter-chip-bar', () => {
  const React = require('react');
  const { Pressable, Text, View } = require('react-native');

  return {
    FilterChipBar: ({
      label,
      options,
      onSelect,
    }: {
      label: string;
      options: { value: string; label: string }[];
      onSelect: (value: string) => void;
    }) =>
      React.createElement(
        View,
        null,
        options.map((option) =>
          React.createElement(
            Pressable,
            {
              key: option.value,
              accessibilityRole: 'button',
              accessibilityLabel: `${label}: ${option.label}`,
              onPress: () => onSelect(option.value),
            },
            React.createElement(Text, null, option.label),
          ),
        ),
      ),
  };
});

jest.mock('@/constants/ui', () => {
  const React = require('react');
  const { Text } = require('react-native');
  const renderText = ({ children, label }: { children?: React.ReactNode; label?: string }) =>
    React.createElement(Text, null, children ?? label);
  return { Badge: renderText, Txt: renderText };
});

jest.mock('@/hooks/use-dev-tools-access', () => ({
  useDevToolsAccess: () => mockHasAccess,
}));

jest.mock('./showcase-components', () => ({
  ComponentsShowcase: ({ category }: { category: string }) => {
    const React = require('react');
    const { Text } = require('react-native');
    return React.createElement(Text, null, `Components ${category}`);
  },
}));

jest.mock('./showcase-foundations', () => ({
  FoundationsShowcase: ({ category }: { category: string }) => {
    const React = require('react');
    const { Text } = require('react-native');
    return React.createElement(Text, null, `Foundations ${category}`);
  },
}));

jest.mock('./showcase-modals', () => ({
  ModalsShowcase: () => {
    const React = require('react');
    const { Text } = require('react-native');
    return React.createElement(Text, null, 'Modals showcase');
  },
}));

jest.mock('./showcase-patterns', () => ({
  PatternsShowcase: ({ category }: { category: string }) => {
    const React = require('react');
    const { Text } = require('react-native');
    return React.createElement(Text, null, `Patterns ${category}`);
  },
}));

jest.mock('./showcase-reanimated', () => ({
  ReanimatedShowcase: () => {
    const React = require('react');
    const { Text } = require('react-native');
    return React.createElement(Text, null, 'Reanimated showcase');
  },
}));

jest.mock('./showcase-shadows', () => ({
  ShadowsShowcase: () => {
    const React = require('react');
    const { Text } = require('react-native');
    return React.createElement(Text, null, 'Shadows showcase');
  },
}));

describe('DesignSystemScreen', () => {
  beforeEach(() => {
    mockHasAccess = true;
    mockMode = 'light';
  });

  it('routes each category to its matching showcase and updates the category count', async () => {
    const user = userEvent.setup();
    await render(<DesignSystemScreen />);

    expect(screen.getByText('Kategorie 1 von 13')).toBeOnTheScreen();
    expect(screen.getByText('Hell')).toBeOnTheScreen();
    expect(screen.getByText('Foundations theme')).toBeOnTheScreen();

    const categories = [
      ['Farben', 'Foundations colors'],
      ['Typografie', 'Foundations typography'],
      ['Tokens', 'Foundations tokens'],
      ['Schatten', 'Shadows showcase'],
      ['Flächen', 'Components surfaces'],
      ['Bedienung', 'Components controls'],
      ['Feedback', 'Components feedback'],
      ['Screens', 'Patterns screens'],
      ['Hybrid', 'Patterns hybrid'],
      ['Zustände', 'Patterns accessibility'],
      ['Reanimated', 'Reanimated showcase'],
      ['Modale', 'Modals showcase'],
    ] as const;

    for (const [label, expectedShowcase] of categories) {
      await user.press(screen.getByRole('button', { name: `Design-System-Kategorie: ${label}` }));
      expect(screen.getByText(expectedShowcase)).toBeOnTheScreen();
      expect(
        screen.getByText(
          `Kategorie ${categories.findIndex(([name]) => name === label) + 2} von 13`,
        ),
      ).toBeOnTheScreen();
    }
  });

  it('uses dark appearance and redirects users without developer access', async () => {
    mockMode = 'dark';
    const view = await render(<DesignSystemScreen />);
    expect(screen.getByText('Dunkel')).toBeOnTheScreen();
    await view.unmount();

    mockHasAccess = false;
    await render(<DesignSystemScreen />);

    expect(screen.getByText('Redirect: /settings')).toBeOnTheScreen();
  });
});
