import { fireEvent, render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import {
  borderWidth,
  MIN_TOUCH_SIZE,
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
    expect(typeof button.props.style).not.toBe('function');
    expect(button.props.hitSlop).toBe(3);
    expect(MIN_TOUCH_SIZE).toBeGreaterThanOrEqual(44);
    expect(button).toHaveStyle({
      minWidth: MIN_TOUCH_SIZE,
      minHeight: MIN_TOUCH_SIZE,
      borderRadius: radius.sm,
      backgroundColor: mockColorsLight.backgroundElement,
      borderWidth: borderWidth.base,
      borderColor: mockColorsLight.border,
    });
  });

  it('misst den Treffercontainer statisch und verlaesst sich nicht auf hitSlop', async () => {
    await render(
      <HeaderIconButton label="Filter öffnen" onPress={jest.fn()}>
        <Text>Filter</Text>
      </HeaderIconButton>,
    );

    const button = screen.getByRole('button', { name: 'Filter öffnen' });

    // `hitSlop` allein ist laut Vertrag 07 kein Nachweis: bei einer
    // Nachbaraktion mit 12-Punkt-hitSlop (Profilgriff) verliert der
    // 3-Punkt-Randbereich. Auf dem Geraet gemessen traf ein Tap 2 Punkte
    // ausserhalb des 39-Punkt-Rahmens den Profilgriff.
    expect(button).toHaveStyle({ minWidth: MIN_TOUCH_SIZE, minHeight: MIN_TOUCH_SIZE });
    expect(button.props.style).not.toContainEqual(
      expect.objectContaining({ width: expect.any(Number) }),
    );
  });

  it('keeps the compact modal-close variant explicit', async () => {
    await render(
      <HeaderIconButton label="Schließen" onPress={jest.fn()} variant="modal-close">
        <Text>×</Text>
      </HeaderIconButton>,
    );

    const button = screen.getByRole('button', { name: 'Schließen' });
    expect(button.props.hitSlop).toBe(6);
    expect(button).toHaveStyle({
      minWidth: 44,
      minHeight: 44,
      borderRadius: radius.sm,
      backgroundColor: mockColorsLight.backgroundSoft,
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

  it('fires the supplied callback exactly once', async () => {
    const onPress = jest.fn();
    await render(
      <HeaderIconButton label="Filter öffnen" onPress={onPress}>
        <Text>Filter</Text>
      </HeaderIconButton>,
    );

    await fireEvent.press(screen.getByRole('button', { name: 'Filter öffnen' }));

    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('exposes the disabled state accessibly', async () => {
    await render(
      <HeaderIconButton label="Filter öffnen" onPress={jest.fn()} disabled>
        <Text>Filter</Text>
      </HeaderIconButton>,
    );

    expect(screen.getByRole('button', { name: 'Filter öffnen', disabled: true })).toBeTruthy();
  });
});
