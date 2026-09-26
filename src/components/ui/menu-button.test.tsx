import { render, screen } from '@testing-library/react-native';

import {
  colorsDark as mockColorsDark,
  colorsLight as mockColorsLight,
  makeAccent as mockMakeAccent,
  type Palette,
} from '@/components/theme';

let mockThemeColors: Palette = mockColorsLight;

jest.mock(
  '@expo/vector-icons',
  () => {
    const { Text: NativeText } = require('react-native');
    return {
      Feather: ({ name, ...props }: { name: string }) => <NativeText {...props}>{name}</NativeText>,
    };
  },
  { virtual: true },
);

jest.mock('@/lib/platform/haptics', () => ({
  heavy: jest.fn(),
  light: jest.fn(),
  medium: jest.fn(),
  selection: jest.fn(),
  success: jest.fn(),
}));

jest.mock('@/components/theme/ThemeProvider', () => ({
  useTheme: () => ({
    mode: mockThemeColors === mockColorsDark ? 'dark' : 'light',
    pref: mockThemeColors === mockColorsDark ? 'dark' : 'light',
    colors: mockThemeColors,
    accent: mockMakeAccent(mockThemeColors),
  }),
  useThemedStyles: (
    factory: (colors: typeof mockColorsLight, accent: ReturnType<typeof mockMakeAccent>) => unknown,
  ) => factory(mockColorsLight, mockMakeAccent(mockColorsLight)),
}));

import { MenuButton } from './menu-button';

function contrastRatio(background: string, foreground: string) {
  const luminance = (hex: string) => {
    const channels = hex
      .slice(1)
      .match(/../g)
      ?.map((channel) => Number.parseInt(channel, 16) / 255);
    if (channels?.length !== 3) throw new Error(`Invalid color: ${hex}`);
    const linear = channels.map((channel) =>
      channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4,
    );
    return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
  };
  const backgroundLuminance = luminance(background);
  const foregroundLuminance = luminance(foreground);
  return (
    (Math.max(backgroundLuminance, foregroundLuminance) + 0.05) /
    (Math.min(backgroundLuminance, foregroundLuminance) + 0.05)
  );
}

describe('MenuButton', () => {
  beforeEach(() => {
    mockThemeColors = mockColorsLight;
  });

  it.each([
    { theme: 'light', colors: mockColorsLight },
    { theme: 'dark', colors: mockColorsDark },
  ])('uses a visible semantic icon and soft background in the $theme theme', async ({ colors }) => {
    mockThemeColors = colors;

    await render(<MenuButton onPress={jest.fn()} />);

    const button = screen.getByRole('button', { name: 'Menü öffnen' });
    expect(button).toHaveStyle({
      backgroundColor: colors.backgroundSoft,
    });
    expect(screen.getByText('menu').props.color).toBe(colors.accent);
    expect(contrastRatio(colors.backgroundSoft, colors.accent)).toBeGreaterThanOrEqual(3);
  });
});
