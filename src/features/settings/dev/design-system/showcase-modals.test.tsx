import { render, screen, userEvent } from '@testing-library/react-native';
import type React from 'react';
import { ModalsShowcase } from './showcase-modals';

jest.mock('@expo/ui', () => {
  const React = require('react');
  const { View } = require('react-native');
  const Container = ({ children }: { children?: React.ReactNode }) =>
    React.createElement(View, null, children);
  const BottomSheet = ({
    children,
    isPresented,
  }: {
    children?: React.ReactNode;
    isPresented: boolean;
  }) => React.createElement(View, null, isPresented ? children : null);
  return { BottomSheet, Host: Container, RNHostView: Container };
});

jest.mock('@expo/ui/swift-ui', () => {
  const React = require('react');
  const { Pressable, Text, View } = require('react-native');
  const Container = ({ children }: { children?: React.ReactNode }) =>
    React.createElement(View, null, children);
  const BottomSheet = ({
    children,
    onIsPresentedChange,
  }: {
    children?: React.ReactNode;
    onIsPresentedChange: (isPresented: boolean) => void;
  }) =>
    React.createElement(
      View,
      null,
      children,
      React.createElement(
        Pressable,
        {
          accessibilityRole: 'button',
          accessibilityLabel: 'Native sheet dismiss',
          onPress: () => onIsPresentedChange(false),
        },
        React.createElement(Text, null, 'Native sheet dismiss'),
      ),
      React.createElement(
        Pressable,
        {
          accessibilityRole: 'button',
          accessibilityLabel: 'Native sheet stays presented',
          onPress: () => onIsPresentedChange(true),
        },
        React.createElement(Text, null, 'Native sheet stays presented'),
      ),
    );
  return {
    BottomSheet,
    Group: Container,
    Host: Container,
    RNHostView: Container,
    Button: ({ label, onPress }: { label: string; onPress: () => void }) =>
      React.createElement(
        Pressable,
        { accessibilityRole: 'button', accessibilityLabel: label, onPress },
        React.createElement(Text, null, label),
      ),
  };
});

jest.mock('@/hooks/use-sheet-shadow-style', () => ({
  useSheetShadowStyle: () => [],
}));

jest.mock('@expo/ui/swift-ui/modifiers', () => ({
  frame: jest.fn(() => 'frame'),
  presentationBackground: jest.fn(() => 'background'),
  presentationDetents: jest.fn(() => 'detents'),
  presentationDragIndicator: jest.fn(() => 'drag-indicator'),
}));

describe('ModalsShowcase', () => {
  it('opens the universal, SwiftUI, and custom modal examples', async () => {
    const user = userEvent.setup();
    await render(<ModalsShowcase />);

    expect(screen.getByText('Modalvergleich')).toBeOnTheScreen();
    const openButtons = screen.getAllByRole('button', { name: 'Modal öffnen' });
    expect(openButtons).toHaveLength(3);
    expect(screen.getAllByText('Passt das so?')).toHaveLength(1);

    await user.press(openButtons[0]);
    expect(screen.getAllByText('Passt das so?')).toHaveLength(2);

    const swiftUiOpenButton = screen.getAllByRole('button', { name: 'Modal öffnen' })[1];
    await user.press(swiftUiOpenButton);
    expect(screen.getAllByText('Passt das so?')).toHaveLength(2);

    const customOpenButton = screen.getAllByRole('button', { name: 'Modal öffnen' })[2];
    await user.press(customOpenButton);
    expect(screen.getAllByText('Passt das so?')).toHaveLength(3);
    await user.press(screen.getByRole('button', { name: 'Eigenbau-Modal schließen' }));
    await user.press(screen.getAllByRole('button', { name: 'Später' })[1]);
    await user.press(screen.getByRole('button', { name: 'Native sheet stays presented' }));
    await user.press(screen.getByRole('button', { name: 'Native sheet dismiss' }));

    const voiceButtons = screen.getAllByRole('button', { name: 'Voice' });
    await user.press(voiceButtons[1]);
    expect(screen.getByText('Artikel sprechen')).toBeOnTheScreen();
    await user.press(screen.getByRole('button', { name: 'Spracheingabe' }));
    await user.press(screen.getByRole('button', { name: 'Artikel prüfen' }));
    expect(screen.getAllByText('Passt das so?')).toHaveLength(2);

    await user.press(screen.getAllByRole('button', { name: 'Voice' })[0]);
    expect(screen.getByText('Artikel sprechen')).toBeOnTheScreen();
    await user.press(screen.getByRole('button', { name: 'Spracheingabe' }));
    await user.press(screen.getByRole('button', { name: 'Artikel prüfen' }));
    expect(screen.getAllByText('Passt das so?')).toHaveLength(2);
    await user.press(screen.getAllByRole('button', { name: 'Schließen' })[1]);

    await user.press(screen.getAllByRole('button', { name: 'Voice' })[2]);
    expect(screen.getByText('Artikel sprechen')).toBeOnTheScreen();
    await user.press(screen.getByRole('button', { name: 'Spracheingabe' }));
    await user.press(screen.getByRole('button', { name: 'Artikel prüfen' }));
    expect(screen.getAllByText('Passt das so?')).toHaveLength(3);
    await user.press(screen.getByRole('button', { name: 'Eigenbau-Modal schließen' }));
  });
});
