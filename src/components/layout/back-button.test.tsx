import { fireEvent, render, screen } from '@testing-library/react-native';

import {
  colorsLight as mockColorsLight,
  makeAccent as mockMakeAccent,
  radius,
  space,
} from '@/components/theme';

let mockCanGoBack = false;
const mockBack = jest.fn();
const mockReplace = jest.fn();

jest.mock('expo-router', () => ({
  router: {
    canGoBack: () => mockCanGoBack,
    back: () => mockBack(),
    replace: (href: string) => mockReplace(href),
  },
  useNavigation: () => ({
    canGoBack: () => mockCanGoBack,
    addListener: () => () => undefined,
  }),
}));

jest.mock('@/components/theme/ThemeProvider', () => ({
  useTheme: () => ({
    mode: 'light',
    pref: 'light',
    colors: mockColorsLight,
    accent: mockMakeAccent(mockColorsLight),
  }),
}));

import { BackButton } from './back-button';

describe('BackButton', () => {
  beforeEach(() => {
    mockCanGoBack = false;
    mockBack.mockClear();
    mockReplace.mockClear();
  });

  it.each([
    { variant: 'arrow' as const, name: 'Zurück zu Vorrat' },
    { variant: 'header' as const, name: 'Vorrat' },
  ])('keeps the $variant face static and accessible', async ({ variant, name }) => {
    await render(<BackButton label="Vorrat" variant={variant} onPress={jest.fn()} />);

    const button = screen.getByRole('button', { name });

    expect(button.props.className).toBeUndefined();
    expect(typeof button.props.style).not.toBe('function');
    expect(button).toHaveStyle({
      width: 45,
      height: 45,
      borderRadius: radius.lg,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: mockColorsLight.backgroundSoft,
    });
  });

  it('keeps the text action in a 44-point touch area and fires once', async () => {
    const onPress = jest.fn();
    await render(<BackButton label="Einstellungen" onPress={onPress} />);

    const button = screen.getByRole('button', { name: 'Zurück zu Einstellungen' });

    expect(button.props.className).toBeUndefined();
    expect(typeof button.props.style).not.toBe('function');
    expect(button).toHaveStyle({
      alignSelf: 'flex-start',
      minHeight: 44,
      paddingTop: space.sm,
      paddingBottom: space.xs,
      paddingRight: space.lg,
    });

    await fireEvent.press(button);

    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
