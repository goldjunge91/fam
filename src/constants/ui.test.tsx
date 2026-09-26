import { fireEvent, render, screen, userEvent } from '@testing-library/react-native';
import { createRef } from 'react';
import { Text } from 'react-native';
import * as Reanimated from 'react-native-reanimated';
import {
  colorsDark,
  font,
  colorsLight as mockColorsLight,
  makeAccent as mockMakeAccent,
  radius,
  space,
} from '@/components/theme/index';

const mockAccent = mockMakeAccent(mockColorsLight);

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

jest.mock(
  'expo-symbols',
  () => {
    const { View: NativeView } = require('react-native');
    return {
      SymbolView: ({ name, ...props }: { name: string }) => (
        <NativeView {...props} accessibilityLabel={name} />
      ),
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
    mode: 'light',
    pref: 'light',
    colors: mockColorsLight,
    accent: mockAccent,
  }),
  useThemedStyles: (
    factory: (colors: typeof mockColorsLight, accent: ReturnType<typeof mockMakeAccent>) => unknown,
  ) => factory(mockColorsLight, mockAccent),
}));

import { Card as ProductCard } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import {
  Badge,
  Button,
  Card,
  CloseButton,
  IconButton,
  Pill,
  Press,
  SectionHeading,
  SegmentedControl,
  Surface,
  TextField,
  Txt,
} from './ui';

const mockHaptics = jest.requireMock('@/lib/platform/haptics') as Record<
  'heavy' | 'light' | 'medium' | 'selection' | 'success',
  jest.Mock
>;
const reducedMotionMock = Reanimated.useReducedMotion as jest.MockedFunction<
  typeof Reanimated.useReducedMotion
>;
const withSpringSpy = jest.spyOn(Reanimated, 'withSpring');
const withTimingSpy = jest.spyOn(Reanimated, 'withTiming');

function contrastRatio(background: string, foreground: string) {
  const relativeLuminance = (hex: string) => {
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

  const backgroundLuminance = relativeLuminance(background);
  const foregroundLuminance = relativeLuminance(foreground);
  return (
    (Math.max(backgroundLuminance, foregroundLuminance) + 0.05) /
    (Math.min(backgroundLuminance, foregroundLuminance) + 0.05)
  );
}

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
    expect(text).toHaveStyle({ color: mockColorsLight.accent, fontWeight: '700' });
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
      backgroundColor: mockColorsLight.background,
    });
    expect(screen.getByLabelText('soft surface')).toHaveStyle({
      backgroundColor: mockColorsLight.backgroundSoft,
    });
    expect(screen.getByLabelText('accent surface')).toHaveStyle({
      backgroundColor: mockColorsLight.accent,
    });
  });

  it('presses an enabled Button and emits its default medium haptic', async () => {
    const onPress = jest.fn();
    const user = userEvent.setup();
    await render(<Button title="Speichern" onPress={onPress} />);

    const button = screen.getByRole('button', { name: 'Speichern' });
    expect(button).toBeEnabled();
    expect(button).toHaveStyle({ borderCurve: 'continuous' });
    await user.press(button);

    expect(onPress).toHaveBeenCalledTimes(1);
    expect(mockHaptics.medium).toHaveBeenCalledTimes(1);
  });

  it('forwards Press callbacks once and skips motion under Reduced Motion', async () => {
    reducedMotionMock.mockReturnValue(true);
    const onPress = jest.fn();
    const onPressIn = jest.fn();
    const onPressOut = jest.fn();
    await render(
      <Press
        accessibilityRole="button"
        accessibilityLabel="Aktion"
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
      />,
    );

    const button = screen.getByRole('button', { name: 'Aktion' });
    await fireEvent(button, 'pressIn');
    expect(button.parent).toHaveStyle({ opacity: 0.78 });
    await fireEvent(button, 'pressOut');
    await fireEvent.press(button);

    expect(onPressIn).toHaveBeenCalledTimes(1);
    expect(onPressOut).toHaveBeenCalledTimes(1);
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(button.parent).not.toHaveStyle({ opacity: 0.78 });
    expect(withTimingSpy).not.toHaveBeenCalled();
    expect(withSpringSpy).not.toHaveBeenCalled();
  });

  it('keeps selected and idle surfaces in the central Press recipe', async () => {
    await render(
      <>
        <Press selected accessibilityRole="button" accessibilityLabel="Ausgewählt" />
        <Press selected={false} accessibilityRole="button" accessibilityLabel="Nicht ausgewählt" />
      </>,
    );

    expect(screen.getByRole('button', { name: 'Ausgewählt' })).toHaveStyle({
      backgroundColor: mockColorsLight.backgroundSoft,
      borderColor: mockColorsLight.accent,
      borderRadius: radius.md,
    });
    expect(screen.getByRole('button', { name: 'Nicht ausgewählt' })).toHaveStyle({
      backgroundColor: mockColorsLight.backgroundElement,
      borderColor: mockColorsLight.border,
      borderRadius: radius.md,
    });
  });

  it('keeps selected-surface text readable in both palettes', () => {
    expect(
      contrastRatio(mockColorsLight.backgroundSoft, mockColorsLight.text),
    ).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(colorsDark.backgroundSoft, colorsDark.text)).toBeGreaterThanOrEqual(4.5);
  });

  it('keeps status text, status fills, and filled actions readable in both palettes', () => {
    const statusRoles = [
      { fill: 'success', text: 'successText', foreground: 'onSuccess' },
      { fill: 'warning', text: 'warningText', foreground: 'onWarning' },
      { fill: 'danger', text: 'dangerText', foreground: 'onDanger' },
    ] as const;
    const surfaces = ['background', 'backgroundElement', 'backgroundSoft'] as const;

    for (const colors of [mockColorsLight, colorsDark]) {
      for (const status of statusRoles) {
        for (const surface of surfaces) {
          expect(contrastRatio(colors[surface], colors[status.text])).toBeGreaterThanOrEqual(4.5);
          expect(contrastRatio(colors[surface], colors[status.fill])).toBeGreaterThanOrEqual(3);
        }
        expect(
          contrastRatio(colors[status.fill], colors[status.foreground]),
        ).toBeGreaterThanOrEqual(4.5);
      }
    }

    for (const accent of [mockMakeAccent(mockColorsLight), mockMakeAccent(colorsDark)]) {
      for (const { main, on } of Object.values(accent)) {
        expect(contrastRatio(main, on)).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it('keeps success surfaces in the central Press and TextField recipes', async () => {
    await render(
      <>
        <Txt tone="success">Erfolgsstatus</Txt>
        <Txt tone="warning">Warnstatus</Txt>
        <Txt tone="danger">Gefahrenstatus</Txt>
        <Press success accessibilityRole="button" accessibilityLabel="Erfolg">
          <Txt tone="onSuccess">Speichern</Txt>
        </Press>
        <TextField success accessibilityLabel="Menge" value="2" onChangeText={jest.fn()} />
      </>,
    );

    expect(screen.getByRole('button', { name: 'Erfolg' })).toHaveStyle({
      backgroundColor: mockColorsLight.success,
      borderRadius: radius.lg,
      paddingHorizontal: space.lg,
      paddingVertical: space.xs,
    });
    expect(screen.getByText('Erfolgsstatus')).toHaveStyle({ color: mockColorsLight.successText });
    expect(screen.getByText('Warnstatus')).toHaveStyle({ color: mockColorsLight.warningText });
    expect(screen.getByText('Gefahrenstatus')).toHaveStyle({ color: mockColorsLight.dangerText });
    expect(screen.getByText('Speichern')).toHaveStyle({ color: mockColorsLight.onSuccess });
    expect(screen.getByDisplayValue('2')).toHaveStyle({
      backgroundColor: mockColorsLight.success,
      color: mockColorsLight.onSuccess,
    });
  });

  it('renders a themed accessible CloseButton and forwards activation', async () => {
    const onPress = jest.fn();
    const user = userEvent.setup();
    await render(<CloseButton accessibilityLabel="Dialog schließen" onPress={onPress} />);

    const button = screen.getByRole('button', { name: 'Dialog schließen' });
    expect(button.props.hitSlop).toBe(6);
    expect(button).toHaveStyle({
      minWidth: space.xxl + space.md + space.xs,
      minHeight: space.xxl + space.md + space.xs,
      borderRadius: radius.sm,
      backgroundColor: mockColorsLight.backgroundSoft,
    });

    await user.press(button);

    expect(onPress).toHaveBeenCalledTimes(1);
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

    await fireEvent(disabled, 'pressIn');
    await fireEvent(loading, 'pressIn');
    expect(disabled).toHaveStyle({ opacity: 0.6 });
    expect(loading).toHaveStyle({ opacity: 0.6 });

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
        <Button title="Großer Link" variant="link" size="lg" onPress={jest.fn()} />
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
    expect(screen.getByText('Großer Link')).toHaveStyle({
      color: mockColorsLight.accent,
      fontSize: font.sizes.base,
      lineHeight: font.lineHeights.body,
      fontWeight: '600',
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

  it.each(
    buttonVariants.flatMap((variant) =>
      [false, true].flatMap((flat) =>
        [false, true].map((reducedMotion) => ({ variant, flat, reducedMotion })),
      ),
    ),
  )(
    'shows and clears pressed feedback for $variant (flat: $flat, reduced motion: $reducedMotion)',
    async ({ variant, flat, reducedMotion }) => {
      reducedMotionMock.mockReturnValue(reducedMotion);
      const onPress = jest.fn();
      await render(<Button title="Aktion" variant={variant} flat={flat} onPress={onPress} />);

      const button = screen.getByRole('button', { name: 'Aktion' });
      await fireEvent(button, 'pressIn');
      expect(button).toHaveStyle({ opacity: 0.78 });

      const hasDepth = !flat && ['primary', 'danger', 'accent'].includes(variant);
      const animatesDepth = hasDepth && !reducedMotion;
      expect(withTimingSpy).toHaveBeenCalledTimes(animatesDepth ? 1 : 0);
      await fireEvent(button, 'pressOut');
      expect(button).toHaveStyle({ opacity: 1 });
      expect(withSpringSpy).toHaveBeenCalledTimes(animatesDepth ? 1 : 0);

      await fireEvent.press(button);
      expect(onPress).toHaveBeenCalledTimes(1);
      expect(mockHaptics.medium).toHaveBeenCalledTimes(1);
    },
  );

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
        paddingHorizontal: space.xl,
        paddingVertical: space.md,
      }),
    );
    expect(secondary).toHaveStyle({
      backgroundColor: mockColorsLight.backgroundSoft,
      borderRadius: radius.md,
      minHeight: 44,
      minWidth: 44,
      paddingHorizontal: space.xl,
      paddingVertical: space.md,
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
    expect(screen.getByText('Gefährlich')).toHaveStyle({ color: mockColorsLight.onDanger });

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
      paddingHorizontal: space.xl,
      paddingVertical: space.md,
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
      backgroundColor: mockColorsLight.backgroundElement,
      borderColor: mockColorsLight.border,
    });
    expect(screen.getByText('Name')).toBeOnTheScreen();
    expect(screen.getByPlaceholderText('Dein Name')).toHaveStyle({ borderColor: '#123456' });
  });

  it('renders Card without a default shadow', async () => {
    await render(
      <Card accessibilityLabel="Schattenkarte" accessible>
        <Text>Inhalt</Text>
      </Card>,
    );

    expect(
      screen
        .getByLabelText('Schattenkarte')
        .props.style.flat()
        .some((style: { boxShadow?: string }) => style?.boxShadow),
    ).toBe(false);
  });

  it('keeps the product Card composition contract for titles and footers', async () => {
    await render(
      <ProductCard title="Produkt" footer={<Text>Footer</Text>}>
        <Text>Inhalt</Text>
      </ProductCard>,
    );

    expect(screen.getByText('Produkt')).toBeOnTheScreen();
    expect(screen.getByText('Inhalt')).toBeOnTheScreen();
    expect(screen.getByText('Footer')).toBeOnTheScreen();
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

  it('renders a selected surface SegmentedControl option', async () => {
    await render(
      <SegmentedControl
        label="Darstellung"
        options={[
          { label: 'Liste', value: 'list' },
          { label: 'Raster', value: 'grid' },
        ]}
        selected="list"
        onSelect={jest.fn()}
        appearance="surface"
      />,
    );

    const selected = screen.getByRole('radio', { name: 'Liste', selected: true });
    expect(selected).toHaveStyle({ backgroundColor: mockColorsLight.backgroundElement });
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
        <EmptyState
          symbol="archivebox"
          title="Leer"
          hint="Noch keine Einträge"
          action={<Text accessibilityRole="button">Eintrag anlegen</Text>}
        />
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
    expect(screen.getByRole('button', { name: 'Eintrag anlegen' })).toBeOnTheScreen();
  });

  it('exposes Pill selection and disabled state to assistive technology', async () => {
    await render(
      <>
        <Pill label="Ausgewählt" selected onPress={jest.fn()} />
        <Pill label="Deaktiviert" selected={false} disabled onPress={jest.fn()} />
      </>,
    );

    expect(screen.getByRole('button', { name: 'Ausgewählt', selected: true })).toBeOnTheScreen();
    expect(
      screen.getByRole('button', { name: 'Deaktiviert', selected: false, disabled: true }),
    ).toBeOnTheScreen();
  });

  it('renders an eyebrow, a selected title variant and a long title', async () => {
    await render(
      <SectionHeading
        eyebrow="Wochenplan"
        title="Eine sehr lange Abschnittsüberschrift bleibt vollständig erreichbar"
        titleVariant="body"
      />,
    );

    expect(screen.getByText('Wochenplan')).toHaveStyle({
      textTransform: 'uppercase',
      letterSpacing: 0.76,
      color: mockColorsLight.textSecondary,
      fontWeight: '600',
    });
    expect(
      screen.getByText('Eine sehr lange Abschnittsüberschrift bleibt vollständig erreichbar'),
    ).toHaveStyle({
      fontSize: font.sizes.base,
      fontWeight: '700',
    });
  });

  it('renders a native accessible action with a static touch target and forwards activation', async () => {
    const onAction = jest.fn();
    const user = userEvent.setup();
    await render(<SectionHeading title="Listen" action="Alle anzeigen" onAction={onAction} />);

    const action = screen.getByRole('button', { name: 'Alle anzeigen' });
    expect(action).toHaveAccessibleName('Alle anzeigen');
    expect(action.props.accessibilityRole).toBe('button');
    expect(action.props.hitSlop).toBe(8);
    expect(action).toHaveStyle({ minHeight: 44, minWidth: 44 });
    expect(typeof action.props.style).not.toBe('function');

    await user.press(action);

    expect(onAction).toHaveBeenCalledTimes(1);
    expect(mockHaptics.selection).toHaveBeenCalledTimes(1);
  });

  it('keeps section actions visibly pressed when Reduced Motion is enabled', async () => {
    reducedMotionMock.mockReturnValue(true);
    await render(<SectionHeading title="Listen" action="Alle anzeigen" onAction={jest.fn()} />);

    const action = screen.getByRole('button', { name: 'Alle anzeigen' });
    await fireEvent(action, 'pressIn');
    expect(action.parent).toHaveStyle({ opacity: 0.78 });

    await fireEvent(action, 'pressOut');
    expect(action.parent).not.toHaveStyle({ opacity: 0.78 });
  });

  it('does not render an action without a callback and keeps local style last', async () => {
    await render(
      <>
        <SectionHeading title="Ohne Callback" action="Nicht ausführen" />
        <SectionHeading title="Mit Override" style={{ marginBottom: 99 }} />
      </>,
    );

    expect(screen.queryByRole('button', { name: 'Nicht ausführen' })).not.toBeOnTheScreen();
    expect(screen.queryByText('Nicht ausführen')).not.toBeOnTheScreen();

    const root = screen.getByText('Mit Override').parent?.parent;
    expect(root).toHaveStyle({ marginBottom: 99 });
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

  it('keeps icon-only actions named and at least 44 points by default', async () => {
    await render(<IconButton icon="heart" accessibilityLabel="Favorit" onPress={jest.fn()} />);

    const button = screen.getByRole('button', { name: 'Favorit' });

    expect(button).toHaveAccessibleName('Favorit');
    expect(button).toHaveStyle({ width: 44, height: 44 });
    expect(typeof button.props.style).not.toBe('function');
  });

  it('uses the paired foreground when an icon action has a danger surface', async () => {
    await render(
      <IconButton
        icon="x"
        accessibilityLabel="Schließen"
        bg={mockColorsLight.danger}
        color={mockColorsLight.onDanger}
      />,
    );

    expect(screen.getByText(/./u)).toHaveProp('color', mockColorsLight.onDanger);
  });

  it('clamps explicit compact icon sizes and exposes disabled state', async () => {
    await render(
      <IconButton icon="x" size={40} accessibilityLabel="Schließen" disabled onPress={jest.fn()} />,
    );

    const button = screen.getByRole('button', { name: 'Schließen', disabled: true });

    expect(button).toHaveStyle({ width: 44, height: 44 });
    expect(button.props.accessibilityState).toEqual({ disabled: true });
    expect(button).toBeDisabled();
  });
});
