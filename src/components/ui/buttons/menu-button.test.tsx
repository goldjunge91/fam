import { render, screen } from '@testing-library/react-native';

import { colorsLight as mockColorsLight, makeAccent as mockMakeAccent } from '@/components/theme';

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

jest.mock('@/lib/haptics', () => ({
  heavy: jest.fn(),
  light: jest.fn(),
  medium: jest.fn(),
  selection: jest.fn(),
  success: jest.fn(),
}));

jest.mock('@/components/theme/ThemeProvider', () => ({
  useTheme: () => ({
    mode: 'light',
    pref: 'light',
    colors: mockColorsLight,
    accent: mockMakeAccent(mockColorsLight),
  }),
  useThemedStyles: (
    factory: (colors: typeof mockColorsLight, accent: ReturnType<typeof mockMakeAccent>) => unknown,
  ) => factory(mockColorsLight, mockMakeAccent(mockColorsLight)),
}));

import { MenuButton } from './menu-button';

describe('MenuButton', () => {
  it('uses the visible semantic soft background in the light theme', async () => {
    await render(<MenuButton onPress={jest.fn()} />);

    expect(screen.getByRole('button', { name: 'Menü öffnen' })).toHaveStyle({
      backgroundColor: mockColorsLight.backgroundSoft,
    });
  });
});
