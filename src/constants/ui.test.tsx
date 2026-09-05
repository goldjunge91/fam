import { fireEvent, render, screen, userEvent } from '@testing-library/react-native';
import { Text } from 'react-native';
import * as Reanimated from 'react-native-reanimated';
import type { TestInstance } from 'test-renderer';

import {
  font,
  colorsLight as mockColorsLight,
  makeAccent as mockMakeAccent,
  radius,
  space,
} from '@/components/theme/index';

jest.mock(
  '@expo/vector-icons',
  () => {
    const { Text: NativeText } = require('react-native');
    return {
      Feather: ({ name, ...props }: { name: string; size: number; color: string }) => (
        <NativeText {...props}>{name}</NativeText>
      ),
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

import {
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  Pill,
  SectionHeading,
  SegmentedControl,
  Surface,
  Txt,
} from './ui';

const mockHaptics = jest.requireMock('@/lib/haptics') as Record<
  'heavy' | 'light' | 'medium' | 'selection' | 'success',
  jest.Mock
>;
const reducedMotionMock = Reanimated.useReducedMotion as jest.MockedFunction<
  typeof Reanimated.useReducedMotion
>;
const withSpringSpy = jest.spyOn(Reanimated, 'withSpring');
const withTimingSpy = jest.spyOn(Reanimated, 'withTiming');

const buttonVariants = ['primary', 'secondary', 'ghost', 'danger', 'accent', 'link'] as const;
const buttonSizes = ['sm', 'md', 'lg'] as const;

type PressableStyle = (state: { pressed: boolean }) => unknown;

function findPressableStyle(button: TestInstance): PressableStyle {
  let fiber = button.unstable_fiber;
  while (fiber) {
    const style = fiber.memoizedProps?.style;
    if (typeof style === 'function') return style as PressableStyle;
    fiber = fiber.return;
  }
  throw new Error('Button Pressable style callback not found');
}

describe('core theme UI primitives', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    reducedMotionMock.mockReturnValue(false);
  });

  it('resolves Txt variants and tones while keeping caller styles last', async () => {
    await render(
      <Txt variant="heading" tone="accent" style={{ fontSize: 99 }}>
        Akzent
      </Txt>,
    );

    const text = screen.getByText('Akzent');
    expect(text).toHaveStyle({ color: mockColorsLight.basil, fontWeight: '700' });
    expect(text.props.style.at(-1)).toEqual({ fontSize: 99 });
  });

  it('uses semantic background colors for Surface tones', async () => {
    await render(
      <>
        <Surface tone="page" accessibilityLabel="page surface" accessible />
        <Surface tone="soft" accessibilityLabel="soft surface" accessible />
        <Surface tone="accent" accessibilityLabel="accent surface" accessible />
      </>,
    );

    expect(screen.getByLabelText('page surface')).toHaveStyle({
      backgroundColor: mockColorsLight.bg,
    });
    expect(screen.getByLabelText('soft surface')).toHaveStyle({
      backgroundColor: mockColorsLight.backgroundSoft,
    });
    expect(screen.getByLabelText('accent surface')).toHaveStyle({
      backgroundColor: mockColorsLight.basil,
    });
  });

  it('presses an enabled Button and emits its default medium haptic', async () => {
    const onPress = jest.fn();
    const user = userEvent.setup();
    await render(<Button title="Speichern" onPress={onPress} />);

    const button = screen.getByRole('button', { name: 'Speichern' });
    expect(button).toBeEnabled();
    await user.press(button);

    expect(onPress).toHaveBeenCalledTimes(1);
    expect(mockHaptics.medium).toHaveBeenCalledTimes(1);
  });

  it('keeps disabled and loading Buttons inactive and haptic-free', async () => {
    const disabledPress = jest.fn();
    const loadingPress = jest.fn();
    const user = userEvent.setup();
    await render(
      <>
        <Button title="Deaktiviert" disabled onPress={disabledPress} />
        <Button title="Lädt" loading onPress={loadingPress} />
      </>,
    );

    const disabled = screen.getByRole('button', { name: 'Deaktiviert' });
    const loading = screen.getByRole('button', { name: 'Lädt' });
    expect(disabled).toBeDisabled();
    expect(loading).toBeDisabled();
    expect(loading).toBeBusy();

    await user.press(disabled);
    await user.press(loading);

    expect(disabledPress).not.toHaveBeenCalled();
    expect(loadingPress).not.toHaveBeenCalled();
    expect(mockHaptics.medium).not.toHaveBeenCalled();
  });

  it('supports the link variant and flat depth override on the canonical Button', async () => {
    await render(
      <>
        <Button title="Mehr anzeigen" variant="link" onPress={jest.fn()} />
        <Button title="Flach" variant="primary" flat onPress={jest.fn()} />
        <Button title="Tief" variant="primary" onPress={jest.fn()} />
      </>,
    );

    const link = screen.getByRole('button', { name: 'Mehr anzeigen' });
    expect(link).toHaveStyle({
      minHeight: 44,
      minWidth: 44,
      backgroundColor: 'transparent',
      borderRadius: radius.sm,
      paddingHorizontal: space.md,
      paddingVertical: space.sm,
    });
    expect(screen.getByText('Mehr anzeigen')).toHaveStyle({
      color: mockColorsLight.accent,
      fontSize: font.sizes.sm,
      fontWeight: '400',
    });

    const flatDepth = screen.getByRole('button', { name: 'Flach' }).parent?.parent?.props.style;
    expect(flatDepth).toEqual(
      expect.objectContaining({ backgroundColor: 'transparent', paddingBottom: 0 }),
    );

    const raisedDepth = screen.getByRole('button', { name: 'Tief' }).parent?.parent?.props.style;
    expect(raisedDepth).toEqual(
      expect.objectContaining({
        backgroundColor: mockColorsLight.buttonPrimaryDepth,
        paddingBottom: 4,
      }),
    );
  });

  it.each(buttonVariants.flatMap((variant) => buttonSizes.map((size) => ({ variant, size }))))(
    'keeps $variant/$size at least 44px high',
    async ({ variant, size }) => {
      await render(
        <Button title={`${variant}-${size}`} variant={variant} size={size} onPress={jest.fn()} />,
      );

      expect(screen.getByRole('button', { name: `${variant}-${size}` })).toHaveStyle({
        minHeight: 44,
        minWidth: 44,
      });
    },
  );

  it('skips button animations under Reduced Motion while keeping press feedback and activation', async () => {
    reducedMotionMock.mockReturnValue(true);
    const onPress = jest.fn();
    await render(<Button title="Aktion" onPress={onPress} />);

    const button = screen.getByRole('button', { name: 'Aktion' });
    await fireEvent(button, 'pressIn');
    expect(findPressableStyle(button)({ pressed: true })).toEqual(
      expect.arrayContaining([expect.objectContaining({ opacity: 0.78 })]),
    );
    await fireEvent(button, 'pressOut');
    await fireEvent.press(button);

    expect(withTimingSpy).not.toHaveBeenCalled();
    expect(withSpringSpy).not.toHaveBeenCalled();
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(mockHaptics.medium).toHaveBeenCalledTimes(1);
  });

  it('uses themed Card and Field styles and keeps field caller overrides last', async () => {
    await render(
      <>
        <Card accessibilityLabel="card" accessible>
          <Text>Karte</Text>
        </Card>
        <Field label="Name" placeholder="Dein Name" style={{ borderColor: '#123456' }} />
      </>,
    );

    expect(screen.getByLabelText('card')).toHaveStyle({
      backgroundColor: mockColorsLight.surface,
      borderColor: mockColorsLight.border,
    });
    expect(screen.getByText('Name')).toBeOnTheScreen();
    expect(screen.getByPlaceholderText('Dein Name')).toHaveStyle({ borderColor: '#123456' });
  });

  it('keeps status primitives selectable and renders optional section actions', async () => {
    const onPillPress = jest.fn();
    const onAction = jest.fn();
    const user = userEvent.setup();
    await render(
      <>
        <Badge label="Vorrat" tone="pantry" />
        <Pill label="Ausgewählt" selected onPress={onPillPress} />
        <SegmentedControl
          options={[
            { label: 'Woche', value: 'week' },
            { label: 'Monat', value: 'month' },
          ]}
          value="week"
          onChange={onAction}
        />
        <SectionHeading title="Listen" action="Alle anzeigen" onAction={onAction} />
        <EmptyState emoji="🛒" title="Leer" subtitle="Noch keine Einträge" />
      </>,
    );

    expect(screen.getByText('Vorrat')).toBeOnTheScreen();
    await user.press(screen.getByText('Ausgewählt'));
    await user.press(screen.getByText('Monat'));
    await user.press(screen.getByText('Alle anzeigen'));

    expect(onPillPress).toHaveBeenCalledTimes(1);
    expect(onAction).toHaveBeenCalledWith('month');
    expect(onAction).toHaveBeenCalledTimes(2);
    expect(screen.getByText('Noch keine Einträge')).toBeOnTheScreen();
  });
});
