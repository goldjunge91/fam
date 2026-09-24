import { render, screen } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import type { StyleProp, ViewProps, ViewStyle } from 'react-native';
import { View } from 'react-native';

jest.mock('expo-glass-effect', () => {
  const React = require('react');
  const { View: NativeView } = require('react-native');

  return {
    GlassView: ({ children, ...props }: MockGlassViewProps) =>
      React.createElement(NativeView, { ...props, testID: 'glass-view' }, children),
    isGlassEffectAPIAvailable: () => true,
  };
});

jest.mock('@/components/ui/glass-card', () => ({
  useGlassAvailable: () => true,
}));

import { colorsLight } from '@/components/theme';

import { InventoryIconButton } from './inventory-icon-button';

type MockGlassViewProps = ViewProps & {
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
};

describe('InventoryIconButton', () => {
  it('zentriert den Inhalt auch innerhalb der GlassView', async () => {
    await render(
      <InventoryIconButton label="Artikel suchen" onPress={jest.fn()}>
        <View />
      </InventoryIconButton>,
    );

    expect(screen.getByRole('button', { name: 'Artikel suchen' })).toBeOnTheScreen();
    expect(screen.getByTestId('glass-view')).toHaveStyle({
      alignItems: 'center',
      justifyContent: 'center',
    });
  });

  it('zeigt den aktiven Zustand mit eigener Fläche und Kontur', async () => {
    await render(
      <InventoryIconButton label="Artikel suchen" onPress={jest.fn()} active>
        <View />
      </InventoryIconButton>,
    );

    expect(screen.getByRole('button', { name: 'Artikel suchen' })).toHaveStyle({
      backgroundColor: colorsLight.accent,
      borderColor: colorsLight.accent,
    });
  });

  it('verwendet eine neutrale Tiefe für den geschlossenen Vorrats-Button', async () => {
    await render(
      <InventoryIconButton label="Artikel suchen" onPress={jest.fn()}>
        <View />
      </InventoryIconButton>,
    );

    const button = screen.getByRole('button', { name: 'Artikel suchen' });
    expect(button.parent?.parent).toHaveStyle({
      backgroundColor: colorsLight.border,
    });
  });
});
