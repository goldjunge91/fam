import { render, screen, userEvent } from '@testing-library/react-native';

import {
  colorsDark as mockColorsDark,
  colorsLight as mockColorsLight,
  type Palette,
  radius,
  space,
} from '@/components/theme';

let mockThemeColors: Palette = mockColorsLight;

jest.mock('@/components/theme/ThemeProvider', () => ({
  useTheme: () => ({
    mode: 'light',
    pref: 'light',
    colors: mockThemeColors,
    accent: {},
  }),
}));

import { FilterChipBar } from './filter-chip-bar';

const options = [
  { value: 'all', label: 'Alle' },
  { value: 'open', label: 'Offen' },
] as const;

describe('FilterChipBar', () => {
  beforeEach(() => {
    mockThemeColors = mockColorsLight;
  });

  it('exposes each option with native role and an understandable name', async () => {
    await render(
      <FilterChipBar label="Status" options={options} selected="all" onSelect={jest.fn()} />,
    );

    const selectedOption = screen.getByRole('button', { name: 'Status: Alle' });
    const unselectedOption = screen.getByRole('button', { name: 'Status: Offen' });

    expect(selectedOption.props.accessibilityRole).toBe('button');
    expect(selectedOption.props.accessibilityLabel).toBe('Status: Alle');
    expect(unselectedOption.props.accessibilityRole).toBe('button');
    expect(unselectedOption.props.accessibilityLabel).toBe('Status: Offen');
  });

  it('reports the selected state natively for selected and unselected options', async () => {
    await render(
      <FilterChipBar label="Status" options={options} selected="all" onSelect={jest.fn()} />,
    );

    expect(screen.getByRole('button', { name: 'Status: Alle', selected: true })).toBeSelected();
    expect(
      screen.getByRole('button', { name: 'Status: Offen', selected: false }),
    ).not.toBeSelected();
    expect(screen.getByRole('button', { name: 'Status: Alle' }).props.accessibilityState).toEqual({
      selected: true,
    });
    expect(screen.getByRole('button', { name: 'Status: Offen' }).props.accessibilityState).toEqual({
      selected: false,
    });
  });

  it.each([
    { theme: 'light', colors: mockColorsLight },
    { theme: 'dark', colors: mockColorsDark },
  ])('keeps the $theme chip face static and at least 44 points high', async ({ colors }) => {
    mockThemeColors = colors;

    await render(
      <FilterChipBar label="Status" options={options} selected="all" onSelect={jest.fn()} />,
    );

    const selectedOption = screen.getByRole('button', { name: 'Status: Alle' });
    const unselectedOption = screen.getByRole('button', { name: 'Status: Offen' });

    expect(typeof selectedOption.props.style).not.toBe('function');
    expect(typeof unselectedOption.props.style).not.toBe('function');
    expect(selectedOption).toHaveStyle({
      minHeight: 44,
      justifyContent: 'center',
      paddingHorizontal: space.md,
      borderRadius: radius.sm,
      backgroundColor: colors.accent,
    });
    expect(unselectedOption).toHaveStyle({
      minHeight: 44,
      backgroundColor: colors.backgroundElement,
    });
  });

  it('keeps the group horizontally scrollable and natively labelled', async () => {
    await render(
      <FilterChipBar label="Status" options={options} selected="all" onSelect={jest.fn()} />,
    );

    const group = screen.getByLabelText('Status');

    expect(group).toHaveProp('horizontal', true);
    expect(group).toHaveProp('showsHorizontalScrollIndicator', false);
  });

  it('calls onSelect once with the pressed option value', async () => {
    const user = userEvent.setup();
    const onSelect = jest.fn();

    await render(
      <FilterChipBar label="Status" options={options} selected="all" onSelect={onSelect} />,
    );

    await user.press(screen.getByRole('button', { name: 'Status: Offen' }));

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith('open');
  });
});
