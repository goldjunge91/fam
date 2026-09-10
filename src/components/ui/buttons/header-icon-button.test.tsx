import { render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import {
  colorsLight as mockColorsLight,
  makeAccent as mockMakeAccent,
  radius,
  withAlpha,
} from '@/components/theme';

jest.mock('@/components/theme/ThemeProvider', () => ({
  useTheme: () => ({
    mode: 'light',
    pref: 'light',
    colors: mockColorsLight,
    accent: mockMakeAccent(mockColorsLight),
  }),
}));

import { HeaderIconButton } from './header-icon-button';

describe('HeaderIconButton', () => {
  it('renders the standard header variant without NativeWind classes', async () => {
    await render(
      <HeaderIconButton label="Filter öffnen" onPress={jest.fn()}>
        <Text>Filter</Text>
      </HeaderIconButton>,
    );

    const button = screen.getByRole('button', { name: 'Filter öffnen' });
    expect(button.props.className).toBeUndefined();
    expect(button).toHaveStyle({
      width: 39,
      height: 39,
      borderRadius: radius.sm,
      backgroundColor: mockColorsLight.backgroundElement,
    });
  });

  it('keeps the compact modal-close variant explicit', async () => {
    await render(
      <HeaderIconButton label="Schließen" onPress={jest.fn()} variant="modal-close">
        <Text>×</Text>
      </HeaderIconButton>,
    );

    expect(screen.getByRole('button', { name: 'Schließen' })).toHaveStyle({
      width: 32,
      height: 32,
      borderRadius: radius.sm,
      backgroundColor: mockColorsLight.backgroundElement,
    });
  });

  it('accepts an explicit bg prop', async () => {
    await render(
      <HeaderIconButton
        label="Filter öffnen"
        onPress={jest.fn()}
        bg={withAlpha(mockColorsLight.backgroundElement, 1)}>
        <Text>Filter</Text>
      </HeaderIconButton>,
    );

    expect(screen.getByRole('button', { name: 'Filter öffnen' })).toHaveStyle({
      backgroundColor: withAlpha(mockColorsLight.backgroundElement, 1),
    });
  });
});
