import { fireEvent, render, screen } from '@testing-library/react-native';

import {
  colorsLight as mockColorsLight,
  makeAccent as mockMakeAccent,
  radius,
  space,
} from '@/components/theme';

jest.mock('@/components/theme/ThemeProvider', () => ({
  useTheme: () => ({
    mode: 'light',
    pref: 'light',
    colors: mockColorsLight,
    accent: mockMakeAccent(mockColorsLight),
  }),
}));

import { CompactActionButton } from './compact-action-button';

describe('CompactActionButton', () => {
  it('keeps its compact face static with the expanded state exposed', async () => {
    await render(
      <CompactActionButton
        label="Sortierung"
        expanded
        accessibilityLabel="Sortierung öffnen"
        onPress={jest.fn()}
      />,
    );

    const button = screen.getByRole('button', { name: 'Sortierung öffnen' });

    expect(button.props.className).toBeUndefined();
    expect(typeof button.props.style).not.toBe('function');
    expect(button.props.hitSlop).toBe(5);
    expect(button.props.accessibilityState).toEqual({ expanded: true });
    expect(button).toHaveStyle({
      width: '100%',
      height: 34,
      minHeight: 34,
      borderWidth: 1,
      borderRadius: radius.sm,
      paddingHorizontal: space.lg,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: mockColorsLight.backgroundElement,
      borderColor: mockColorsLight.border,
    });
  });

  it('preserves one activation for the compact action', async () => {
    const onPress = jest.fn();
    await render(<CompactActionButton label="Sortierung" onPress={onPress} />);

    await fireEvent.press(screen.getByRole('button', { name: 'Sortierung' }));

    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
