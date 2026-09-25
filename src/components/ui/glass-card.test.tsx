import { render, screen } from '@testing-library/react-native';
import { isGlassEffectAPIAvailable } from 'expo-glass-effect';
import type { ReactNode } from 'react';
import { Text } from 'react-native';

import { GlassCard } from './glass-card';

jest.mock('expo-glass-effect', () => {
  const React = require('react');
  const { View } = require('react-native');

  return {
    GlassView: ({ children, ...props }: { children: ReactNode }) =>
      React.createElement(View, { ...props, testID: 'mock-glass-view' }, children),
    isGlassEffectAPIAvailable: jest.fn(() => false),
  };
});

const glassApiAvailableMock = jest.mocked(isGlassEffectAPIAvailable);

describe.each([
  ['fallback', false],
  ['glass', true],
] as const)('GlassCard %s rendering', (_rendering, glassAvailable) => {
  beforeEach(() => {
    glassApiAvailableMock.mockReturnValue(glassAvailable);
  });

  it('renders without a shadow while tinted', async () => {
    await render(
      <GlassCard
        accessibilityRole="button"
        accessibilityLabel="Schattenkarte"
        glassStyle={{}}
        tinted>
        <Text>Inhalt</Text>
      </GlassCard>,
    );

    const card = screen.getByLabelText('Schattenkarte');
    expect(card.props.style.flat().some((style: { boxShadow?: string }) => style?.boxShadow)).toBe(
      false,
    );

    if (glassAvailable) {
      expect(screen.getByTestId('mock-glass-view')).toBeOnTheScreen();
    } else {
      expect(screen.queryByTestId('mock-glass-view')).toBeNull();
    }
  });
});
