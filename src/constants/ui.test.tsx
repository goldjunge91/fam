import { fireEvent, render, screen, userEvent } from '@testing-library/react-native';
import { createRef } from 'react';
import { Text } from 'react-native';
import * as Reanimated from 'react-native-reanimated';

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
  Pill,
  SectionHeading,
  SegmentedControl,
  Surface,
  TextField,
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

  it('keeps secondary and danger buttons on the themed render path', async () => {
    await render(
      <>
        <Button title="Sekundär" variant="secondary" onPress={jest.fn()} />
        <Button title="Gefährlich" variant="danger" onPress={jest.fn()} />
      </>,
    );

    const secondary = screen.getByRole('button', { name: 'Sekundär' });
    expect(secondary.props.style).toEqual(
      expect.objectContaining({
        backgroundColor: mockColorsLight.backgroundSoft,
        borderRadius: radius.md,
        minHeight: 44,
        minWidth: 44,
        paddingHorizontal: 18,
        paddingVertical: 13,
      }),
    );
    expect(secondary).toHaveStyle({
      backgroundColor: mockColorsLight.backgroundSoft,
      borderRadius: radius.md,
      minHeight: 44,
      minWidth: 44,
      paddingHorizontal: 18,
      paddingVertical: 13,
    });
    expect(screen.getByText('Sekundär')).toHaveStyle({
      color: mockColorsLight.text,
      fontSize: font.sizes.base,
      fontWeight: '700',
    });
    expect(screen.getByRole('button', { name: 'Gefährlich' })).toHaveStyle({
      backgroundColor: mockColorsLight.danger,
      borderRadius: radius.md,
      minHeight: 44,
    });

    const dangerDepth = screen.getByRole('button', { name: 'Gefährlich' }).parent?.parent?.props
      .style;
    expect(dangerDepth).toEqual(
      expect.objectContaining({
        backgroundColor: mockColorsLight.buttonDangerDepth,
        paddingBottom: 4,
      }),
    );
  });

  it('uses md as the canonical default baseline', async () => {
    await render(<Button title="Mittlere Aktion" onPress={jest.fn()} />);

    const button = screen.getByRole('button', { name: 'Mittlere Aktion' });
    expect(button).toHaveStyle({
      minHeight: 44,
      minWidth: 44,
      paddingHorizontal: 18,
      paddingVertical: 13,
      borderRadius: radius.md,
    });
    expect(screen.getByText('Mittlere Aktion')).toHaveStyle({
      color: mockColorsLight.onAccent,
      fontSize: font.sizes.base,
      fontWeight: '700',
    });
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
    expect(button).toHaveStyle({ opacity: 0.78 });
    await fireEvent(button, 'pressOut');
    expect(button).toHaveStyle({ opacity: 1 });
    await fireEvent.press(button);

    expect(withTimingSpy).not.toHaveBeenCalled();
    expect(withSpringSpy).not.toHaveBeenCalled();
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(mockHaptics.medium).toHaveBeenCalledTimes(1);
  });

  it('uses themed Card and TextField styles and keeps field caller overrides last', async () => {
    await render(
      <>
        <Card accessibilityLabel="card" accessible>
          <Text>Karte</Text>
        </Card>
        <TextField label="Name" placeholder="Dein Name" style={{ borderColor: '#123456' }} />
      </>,
    );

    expect(screen.getByLabelText('card')).toHaveStyle({
      backgroundColor: mockColorsLight.surface,
      borderColor: mockColorsLight.border,
    });
    expect(screen.getByText('Name')).toBeOnTheScreen();
    expect(screen.getByPlaceholderText('Dein Name')).toHaveStyle({ borderColor: '#123456' });
  });

  it('combines TextField focus, error, trailing action, accessibility and ref behavior', async () => {
    const inputRef = createRef<import('react-native').TextInput>();
    const onFocus = jest.fn();
    const onBlur = jest.fn();

    await render(
      <TextField
        ref={inputRef}
        label="Produktname"
        placeholder="Milch"
        error="Produktname fehlt"
        trailing={<Text accessibilityLabel="Produkt löschen">×</Text>}
        accessibilityLabel="Eigenes Produktlabel"
        accessibilityHint="Eigenen Hinweis verwenden"
        onFocus={onFocus}
        onBlur={onBlur}
      />,
    );

    const input = screen.getByLabelText('Eigenes Produktlabel');
    expect(input.props.accessibilityHint).toBe('Eigenen Hinweis verwenden');
    expect(inputRef.current).toBeTruthy();
    expect(screen.getByText('Produktname')).toBeOnTheScreen();
    expect(screen.getByText('Produktname fehlt')).toBeOnTheScreen();
    expect(screen.getByLabelText('Produkt löschen')).toBeOnTheScreen();
    expect(input).toHaveStyle({ borderWidth: 2, borderColor: mockColorsLight.danger });

    await fireEvent(input, 'focus');
    expect(input).toHaveStyle({ borderWidth: 2, borderColor: mockColorsLight.danger });
    expect(screen.getByText('Produktname')).toHaveStyle({ color: mockColorsLight.accent });
    expect(onFocus).toHaveBeenCalledTimes(1);

    await fireEvent(input, 'blur');
    expect(onBlur).toHaveBeenCalledTimes(1);
  });

  it('keeps disabled inputs accessible and does not force submit defaults on multiline fields', async () => {
    await render(
      <>
        <TextField label="Gesperrt" editable={false} />
        <TextField label="Notiz" multiline />
      </>,
    );

    const disabled = screen.getByLabelText('Gesperrt');
    expect(disabled).toBeDisabled();
    expect(disabled.props.accessibilityState).toEqual(expect.objectContaining({ disabled: true }));

    const multiline = screen.getByLabelText('Notiz');
    expect(multiline.props.returnKeyType).toBeUndefined();
    expect(multiline.props.submitBehavior).toBeUndefined();
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
          label="Zeitraum"
          options={[
            { label: 'Woche', value: 'week' },
            { label: 'Monat', value: 'month' },
          ]}
          selected="week"
          onSelect={onAction}
          selectionRole="radio"
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

  it('exposes single-selection state, disabled options and large touch targets', async () => {
    const onSelect = jest.fn();
    const user = userEvent.setup();
    await render(
      <SegmentedControl
        label="Zeitraum"
        options={[
          { label: 'Ein sehr langer Zeitraum', value: 'long' },
          { label: 'Noch nicht verfügbar', value: 'disabled', disabled: true },
        ]}
        selected="long"
        onSelect={onSelect}
        size="compact"
      />,
    );

    const selected = screen.getByRole('radio', {
      name: 'Ein sehr langer Zeitraum',
      selected: true,
    });
    const disabled = screen.getByRole('radio', {
      name: 'Noch nicht verfügbar',
      disabled: true,
    });

    expect(selected).toHaveStyle({ minHeight: 44 });
    expect(screen.getByText('Ein sehr langer Zeitraum').props.numberOfLines).toBeUndefined();
    expect(disabled).toBeDisabled();

    await user.press(disabled);
    await user.press(selected);

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith('long');
  });
});
