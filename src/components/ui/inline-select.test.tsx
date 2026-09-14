import { render, screen, userEvent } from '@testing-library/react-native';

import { colorsLight as mockColorsLight } from '@/components/theme';

jest.mock('@/components/theme/ThemeProvider', () => ({
  useTheme: () => ({ colors: mockColorsLight }),
}));

import { InlineSelect } from './inline-select';

const options = [
  { value: 'food', label: 'Lebensmittel', icon: '🥕' },
  { value: 'dish', label: 'Gerichte', disabled: true, disabledHint: 'bald' },
  { value: 'recent', label: 'Zuletzt', icon: '🔁' },
] as const;

describe('InlineSelect', () => {
  it('exposes an expanded native trigger with a static 44-point touch target', async () => {
    const user = userEvent.setup();

    await render(
      <InlineSelect
        value="food"
        options={options}
        onChange={jest.fn()}
        accessibilityLabel="Quelle auswählen"
      />,
    );

    const trigger = screen.getByRole('button', { name: 'Quelle auswählen' });
    expect(trigger).toHaveStyle({ height: 44 });
    expect(typeof trigger.props.style).not.toBe('function');
    expect(trigger.props.accessibilityState).toEqual({ expanded: false });

    await user.press(trigger);

    expect(
      screen.getByRole('button', { name: 'Quelle auswählen' }).props.accessibilityState,
    ).toEqual({ expanded: true });
  });

  it('exposes option selection and disabled state natively', async () => {
    const onChange = jest.fn();
    const user = userEvent.setup();

    await render(
      <InlineSelect
        value="food"
        options={options}
        onChange={onChange}
        accessibilityLabel="Quelle auswählen"
      />,
    );

    await user.press(screen.getByRole('button', { name: 'Quelle auswählen' }));

    const selected = screen.getByRole('menuitem', { name: '🥕 Lebensmittel', selected: true });
    const disabled = screen.getByRole('menuitem', { name: 'Gerichte bald', disabled: true });

    expect(selected).toHaveStyle({ minHeight: 44 });
    expect(disabled.props.accessibilityState).toEqual(
      expect.objectContaining({ disabled: true, selected: false }),
    );

    await user.press(disabled);
    await user.press(screen.getByRole('menuitem', { name: '🔁 Zuletzt' }));

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith('recent');
    expect(screen.queryByRole('menuitem', { name: '🔁 Zuletzt' })).not.toBeOnTheScreen();
  });
});
