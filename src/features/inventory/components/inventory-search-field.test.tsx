import { fireEvent, render, screen } from '@testing-library/react-native';
import type React from 'react';

import { InventorySearchField, InventorySearchInput } from './inventory-search-field';

jest.mock('expo-glass-effect', () => {
  const React = require('react') as typeof import('react');
  const { View: NativeView } = require('react-native') as typeof import('react-native');
  return {
    GlassView: ({ children, ...props }: { children?: React.ReactNode }) =>
      React.createElement(NativeView, { ...props, testID: 'search-glass-view' }, children),
    isGlassEffectAPIAvailable: () => true,
  };
});
jest.mock('@/components/ui/glass-card', () => ({ useGlassAvailable: () => true }));
jest.mock('@/lib/platform/haptics', () => ({ medium: jest.fn() }));

describe('InventorySearchField', () => {
  it('renders the editable search row and forwards text changes', async () => {
    const onChangeText = jest.fn();
    await render(<InventorySearchField value="Milch" onChangeText={onChangeText} />);

    const input = screen.getByLabelText('Artikel suchen');
    expect(input).toHaveDisplayValue('Milch');
    await fireEvent.changeText(input, 'Hafermilch');
    expect(onChangeText).toHaveBeenCalledWith('Hafermilch');
  });

  it('uses a no-op text handler when none is provided', async () => {
    await render(<InventorySearchField />);

    await fireEvent.changeText(screen.getByLabelText('Artikel suchen'), 'Brot');
    expect(screen.getByLabelText('Artikel suchen')).toHaveDisplayValue('');
  });

  it('renders a closed icon button and invokes the search action', async () => {
    const onPress = jest.fn();
    await render(<InventorySearchField onPress={onPress} />);

    const button = screen.getByRole('button', { name: 'Artikel suchen' });
    expect(button.props.accessibilityState).toEqual({ expanded: false });
    expect(screen.getByTestId('search-glass-view')).toBeOnTheScreen();
    await fireEvent.press(button);
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('renders the active icon state without the glass wrapper', async () => {
    await render(<InventorySearchField onPress={jest.fn()} isOpen />);

    expect(screen.getByRole('button', { name: 'Artikel suchen' }).props.accessibilityState).toEqual(
      {
        expanded: true,
      },
    );
    expect(screen.queryByTestId('search-glass-view')).toBeNull();
  });

  it('renders the standalone input component with a controlled value', async () => {
    const onChangeText = jest.fn();
    await render(<InventorySearchInput value="Müsli" onChangeText={onChangeText} />);

    const input = screen.getByLabelText('Artikel suchen');
    expect(input).toHaveDisplayValue('Müsli');
    await fireEvent.changeText(input, 'Granola');
    expect(onChangeText).toHaveBeenCalledWith('Granola');
  });
});
