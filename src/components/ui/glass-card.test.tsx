import { render, screen } from '@testing-library/react-native';
import { isGlassEffectAPIAvailable } from 'expo-glass-effect';
import type { ReactNode } from 'react';
import { Text } from 'react-native';

import { uiShadowStyles } from '@/constants/ui-shadow';

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

  it.each([
    ['card', uiShadowStyles.cardBottom],
    ['prominent', uiShadowStyles.prominentCard],
    ['floatingControl', uiShadowStyles.floatingControlBottom],
  ] as const)('applies the explicitly selected %s shadow while tinted', async (shadow, style) => {
    await render(
      <GlassCard
        accessibilityRole="button"
        accessibilityLabel="Schattenkarte"
        glassStyle={{}}
        shadow={shadow}
        tinted>
        <Text>Inhalt</Text>
      </GlassCard>,
    );

    const card = screen.getByLabelText('Schattenkarte');
    expect(card.props.style).toContain(style);
    expect(card.props.style).not.toContain(
      uiShadowStyles.prominentCard === style
        ? uiShadowStyles.cardBottom
        : uiShadowStyles.prominentCard,
    );

    if (glassAvailable) {
      expect(screen.getByTestId('mock-glass-view')).toBeOnTheScreen();
    } else {
      expect(screen.queryByTestId('mock-glass-view')).toBeNull();
    }
  });
});
