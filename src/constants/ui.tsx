/**
 * ui UI kit — the Pantry Pop design-system primitives, native edition.
 * Big touch targets, rounded cards, 3D buttons, soft shadows, haptics.
 * Theme-aware: colors come from useTheme() so everything flips with dark mode.
 */

import { Feather } from '@expo/vector-icons';
import type React from 'react';
import type { ReactNode } from 'react';
import { forwardRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  type PressableProps,
  type PressableStateCallbackType,
  type StyleProp,
  Text,
  TextInput,
  type TextInputProps,
  type TextProps,
  type TextStyle,
  View,
  type ViewProps,
  type ViewStyle,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { StyleSheet } from 'react-native-unistyles';
import {
  type AccentKey,
  BUTTON_DEPTH,
  borderWidth,
  font,
  type Palette,
  radius,
  shadow,
  space,
  withAlpha,
} from '@/components/theme/index';
import { useTheme } from '@/components/theme/ThemeProvider';
import {
  heavy as hapticHeavy,
  light as hapticLight,
  medium as hapticMedium,
  selection as hapticSelection,
  success as hapticSuccess,
} from '@/lib/platform/haptics';

// Springs tuned for a satisfying, Duolingo-ish "pop" on press/release.
const PRESS_SPRING = { damping: 14, stiffness: 320, mass: 0.5 } as const;
const POP_SPRING = { damping: 9, stiffness: 380, mass: 0.5 } as const;

type ShadowTier = (typeof shadow)[keyof typeof shadow];

function makeThemeShadow(tier: ShadowTier, color: string) {
  return {
    shadowColor: color,
    shadowOffset: tier.shadowOffset,
    shadowOpacity: tier.shadowOpacity,
    shadowRadius: tier.shadowRadius,
    elevation: tier.elevation,
  };
}

const shadowStyles = StyleSheet.create((theme) => ({
  sm: makeThemeShadow(shadow.sm, theme.shadowCard),
  md: makeThemeShadow(shadow.md, theme.shadowCard),
  lg: makeThemeShadow(shadow.lg, theme.shadowCard),
}));

type HapticKind = 'none' | 'light' | 'medium' | 'heavy' | 'selection' | 'success';
function fireHaptic(kind: HapticKind) {
  switch (kind) {
    case 'light':
      return hapticLight();
    case 'medium':
      return hapticMedium();
    case 'heavy':
      return hapticHeavy();
    case 'selection':
      return hapticSelection();
    case 'success':
      return hapticSuccess();
    default:
      return;
  }
}

type FeatherName = React.ComponentProps<typeof Feather>['name'];

export const iconButtonStyles = StyleSheet.create((theme) => ({
  header: {
    borderRadius: theme.radius.sm,
    backgroundColor: theme.backgroundElement,
  },
  modalClose: {
    minWidth: theme.space.xxl + theme.space.md + theme.space.xs,
    minHeight: theme.space.xxl + theme.space.md + theme.space.xs,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.backgroundSoft,
  },
}));

export const floatingActionButtonStyles = StyleSheet.create((theme) => ({
  outer: {
    paddingBottom: BUTTON_DEPTH,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.buttonPrimaryDepth,
  },
  face: {
    width: 48,
    height: 48,
    minWidth: 48,
    minHeight: 48,
    borderRadius: theme.radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: theme.accent,
    boxShadow: `0 6px 14px ${withAlpha(theme.shadowSheet, 0.16)}`,
    borderCurve: 'continuous',
    elevation: 4,
    shadowColor: theme.shadowSheet,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.16,
    shadowRadius: 8,
  },
}));

export const compactActionButtonStyles = StyleSheet.create((theme) => ({
  button: {
    width: '100%',
    height: 34,
    minHeight: 34,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: theme.radius.sm,
    paddingHorizontal: theme.space.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: theme.backgroundElement,
    borderColor: theme.border,
  },
  chevronLine: {
    position: 'absolute',
    top: 2,
    width: 7,
    height: 1.5,
    borderRadius: 2,
    backgroundColor: theme.textSecondary,
  },
}));

export const backButtonStyles = StyleSheet.create((theme) => ({
  arrow: {
    width: 45,
    height: 45,
    borderRadius: theme.radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.backgroundSoft,
  },
  text: {
    alignSelf: 'flex-start',
    minHeight: 44,
    paddingTop: theme.space.sm,
    paddingBottom: theme.space.xs,
    paddingRight: theme.space.lg,
  },
}));

export const profileButtonStyles = StyleSheet.create((theme) => ({
  button: {
    width: 58,
    height: 58,
    borderRadius: theme.radius.famLarge,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: theme.accent,
  },
}));

export const moduleLockedOverlayStyles = StyleSheet.create((theme) => ({
  overlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: withAlpha(theme.backgroundElement, 0.4),
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space.xs,
    paddingHorizontal: theme.space.md,
    paddingVertical: 7,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.text,
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.warning,
  },
  label: {
    color: theme.background,
  },
}));

export const onboardingStyles = StyleSheet.create((theme) => ({
  activeHousehold: {
    borderWidth: theme.borderWidth.base,
    borderColor: theme.success,
    borderRadius: theme.radius.sm,
    backgroundColor: withAlpha(theme.success, 0.1),
  },
}));

const surfaceStyles = StyleSheet.create((theme) => ({
  page: { backgroundColor: theme.background },
  surface: { backgroundColor: theme.backgroundElement },
  soft: { backgroundColor: theme.backgroundSoft },
  accent: { backgroundColor: theme.accent },
}));

const dividerStyles = StyleSheet.create((theme) => ({
  root: { height: 1, backgroundColor: theme.border },
}));

const cardStyles = StyleSheet.create((theme) => ({
  base: {
    backgroundColor: theme.backgroundElement,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: theme.border,
  },
  soft: { backgroundColor: theme.backgroundSoft },
  padded: { padding: space.lg },
}));

const textToneStyles = StyleSheet.create((theme) => ({
  text: { color: theme.text },
  textSecondary: { color: theme.textSecondary },
  accent: { color: theme.accent },
  onAccent: { color: theme.onAccent },
  success: { color: theme.success },
  warning: { color: theme.warning },
  danger: { color: theme.danger },
}));

const pressSelectionStyles = StyleSheet.create((theme) => ({
  idle: {
    backgroundColor: theme.backgroundElement,
    borderColor: theme.border,
    borderWidth: theme.borderWidth.base,
    borderRadius: theme.radius.md,
  },
  selected: {
    backgroundColor: theme.backgroundSoft,
    borderColor: theme.accent,
    borderWidth: theme.borderWidth.base,
    borderRadius: theme.radius.md,
  },
}));

const pressSuccessStyles = StyleSheet.create((theme) => ({
  surface: {
    backgroundColor: theme.success,
    borderRadius: theme.radius.lg,
    paddingHorizontal: theme.space.lg,
    paddingVertical: theme.space.xs,
  },
  field: {
    backgroundColor: theme.success,
    borderRadius: theme.radius.lg,
  },
  foreground: {
    color: theme.onAccent,
  },
}));

// ─── Text ────────────────────────────────────────────────────────────────────

export type TxtVariant =
  | 'display'
  | 'title'
  | 'brand'
  | 'heading'
  | 'subheading'
  | 'body'
  | 'navigation'
  | 'label'
  | 'caption'
  | 'eyebrow'
  | 'glyph';

export type TxtTone =
  | 'primary'
  | 'secondary'
  | 'accent'
  | 'onAccent'
  | 'success'
  | 'warning'
  | 'danger'
  | 'inverse';

type TxtDefinition = {
  fontSize: number;
  lineHeight: number;
  fontWeight: TextStyle['fontWeight'];
  tone: 'text' | 'textSecondary' | 'accent';
  letterSpacing?: number;
  fontFamily?: TextStyle['fontFamily'];
};

const TXT: Record<TxtVariant, TxtDefinition> = {
  display: {
    fontSize: font.sizes.xxxl,
    lineHeight: font.lineHeights.display,
    fontWeight: '800',
    tone: 'text',
  },
  title: {
    fontSize: font.sizes.xxl,
    lineHeight: font.lineHeights.title,
    fontWeight: '800',
    tone: 'text',
  },
  brand: {
    fontSize: 27,
    lineHeight: 34,
    fontWeight: '600',
    tone: 'text',
  },
  heading: {
    fontSize: font.sizes.lg,
    lineHeight: font.lineHeights.heading,
    fontWeight: '700',
    tone: 'text',
  },
  subheading: {
    fontSize: font.sizes.md,
    lineHeight: font.lineHeights.subheading,
    fontWeight: '700',
    tone: 'text',
  },
  body: {
    fontSize: font.sizes.base,
    lineHeight: font.lineHeights.body,
    fontWeight: '400',
    tone: 'text',
  },
  navigation: {
    fontSize: 17,
    lineHeight: 21,
    fontWeight: '400',
    tone: 'text',
  },
  label: {
    fontSize: font.sizes.sm,
    lineHeight: font.lineHeights.label,
    fontWeight: '600',
    tone: 'text',
  },
  caption: {
    fontSize: font.sizes.xs,
    lineHeight: font.lineHeights.caption,
    fontWeight: '500',
    tone: 'text',
  },
  eyebrow: {
    fontSize: 12,
    lineHeight: 15,
    fontWeight: '400',
    tone: 'textSecondary',
    letterSpacing: 0.76,
  },
  glyph: {
    fontSize: 22,
    lineHeight: 26,
    fontWeight: '400',
    tone: 'textSecondary',
  },
};

type ThemeTextColor = keyof Pick<
  Palette,
  'text' | 'textSecondary' | 'accent' | 'onAccent' | 'success' | 'warning' | 'danger'
>;

const TEXT_TONE: Record<TxtTone, ThemeTextColor> = {
  primary: 'text',
  secondary: 'textSecondary',
  accent: 'accent',
  onAccent: 'onAccent',
  success: 'success',
  warning: 'warning',
  danger: 'danger',
  inverse: 'onAccent',
};

export type TxtProps = TextProps & {
  variant?: TxtVariant;
  tone?: TxtTone;
  color?: string;
  weight?: TextStyle['fontWeight'];
  center?: boolean;
  muted?: boolean;
};

export function Txt({
  variant = 'body',
  tone,
  color,
  weight,
  center,
  muted,
  style,
  children,
  ...rest
}: TxtProps) {
  const base = TXT[variant];
  const textTone = tone ? TEXT_TONE[tone] : muted ? 'textSecondary' : base.tone;
  return (
    <Text
      {...rest}
      style={[
        textToneStyles[textTone],
        {
          fontSize: base.fontSize,
          lineHeight: base.lineHeight,
          fontWeight: base.fontWeight,
          letterSpacing: base.letterSpacing,
          fontFamily: base.fontFamily,
        },
        color && { color },
        weight && { fontWeight: weight },
        center && { textAlign: 'center' },
        style,
      ]}>
      {children}
    </Text>
  );
}

// ─── Layout helpers ──────────────────────────────────────────────────────────

export function Row({
  gap = space.sm,
  align = 'center',
  justify,
  wrap,
  style,
  children,
  ...rest
}: ViewProps & {
  gap?: number;
  align?: 'center' | 'flex-start' | 'flex-end' | 'stretch' | 'baseline';
  justify?: 'flex-start' | 'center' | 'flex-end' | 'space-between' | 'space-around';
  wrap?: boolean;
}) {
  return (
    <View
      {...rest}
      style={[
        {
          flexDirection: 'row',
          alignItems: align,
          justifyContent: justify,
          gap,
          flexWrap: wrap ? 'wrap' : 'nowrap',
        },
        style,
      ]}>
      {children}
    </View>
  );
}

type SurfaceTone = 'page' | 'surface' | 'soft' | 'accent';

/** A semantic themed container. */
export function Surface({
  tone = 'page',
  style,
  children,
  ...rest
}: ViewProps & {
  tone?: SurfaceTone;
}) {
  return (
    <View {...rest} style={[surfaceStyles[tone], style]}>
      {children}
    </View>
  );
}

export function Spacer({ h = space.md }: { h?: number }) {
  return <View style={{ height: h }} />;
}

export function Divider({ style }: { style?: StyleProp<ViewStyle> }) {
  return <View style={[dividerStyles.root, style]} />;
}

// ─── Card ────────────────────────────────────────────────────────────────────

export function Card({
  style,
  padded = true,
  soft = false,
  elevation = 'sm',
  children,
  ...rest
}: Omit<ViewProps, 'style'> & {
  padded?: boolean;
  soft?: boolean;
  elevation?: 'none' | 'sm' | 'md' | 'lg';
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View
      {...rest}
      style={[
        cardStyles.base,
        soft && cardStyles.soft,
        padded && cardStyles.padded,
        elevation !== 'none' && shadowStyles[elevation],
        style,
      ]}>
      {children}
    </View>
  );
}

// ─── Pressable with scale + haptic ───────────────────────────────────────────

export function Press({
  onPress,
  onPressIn,
  onPressOut,
  haptic = 'light',
  scaleTo = 0.96,
  style,
  containerStyle,
  children,
  disabled,
  selected,
  success,
  ...rest
}: PressableProps & {
  haptic?: HapticKind;
  scaleTo?: number;
  /** Layout style for the animated wrapper (e.g. flex:1 so the item stretches). */
  containerStyle?: StyleProp<ViewStyle>;
  /** Applies the central selected/idle surface recipe when explicitly provided. */
  selected?: boolean;
  /** Applies the central semantic success surface recipe. */
  success?: boolean;
}) {
  const s = useSharedValue(1);
  const reducedMotion = useReducedMotion();
  const selectionStyle =
    selected === undefined
      ? undefined
      : selected
        ? pressSelectionStyles.selected
        : pressSelectionStyles.idle;
  const semanticStyle = success ? pressSuccessStyles.surface : undefined;
  const resolvedStyle: PressableProps['style'] =
    selectionStyle === undefined && semanticStyle === undefined
      ? style
      : typeof style === 'function'
        ? (state: PressableStateCallbackType) => [semanticStyle, selectionStyle, style(state)]
        : [semanticStyle, selectionStyle, style];
  const aStyle = useAnimatedStyle(() => ({
    transform: [{ scale: reducedMotion ? 1 : s.value }],
  }));
  return (
    <Animated.View style={[aStyle, containerStyle]}>
      <Pressable
        {...rest}
        disabled={disabled}
        onPressIn={(event) => {
          if (!reducedMotion) {
            s.value = withTiming(scaleTo, { duration: 70 });
          }
          onPressIn?.(event);
        }}
        onPressOut={(event) => {
          // spring back with a touch of overshoot — the "pop".
          if (reducedMotion) {
            s.value = 1;
          } else {
            s.value = withSpring(1, POP_SPRING);
          }
          onPressOut?.(event);
        }}
        onPress={(e) => {
          fireHaptic(haptic);
          onPress?.(e);
        }}
        style={resolvedStyle}>
        {children}
      </Pressable>
    </Animated.View>
  );
}

/** A themed, accessible close action for dialogs and sheets. */
export function CloseButton({
  onPress,
  accessibilityLabel,
  hitSlop = 6,
  style,
  ...rest
}: Omit<
  PressableProps,
  'accessibilityLabel' | 'accessibilityRole' | 'children' | 'onPress' | 'style'
> & {
  accessibilityLabel: string;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useTheme();

  return (
    <Press
      {...rest}
      onPress={onPress}
      hitSlop={hitSlop}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={[iconButtonStyles.modalClose, style]}>
      <Feather name="x" size={font.sizes.md} color={colors.textSecondary} />
    </Press>
  );
}

// ─── 3D Button ───────────────────────────────────────────────────────────────

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'accent' | 'link';
type ButtonSize = 'sm' | 'md' | 'lg';

export function Button({
  title,
  accessibilityLabel,
  onPress,
  variant = 'primary',
  size = 'md',
  icon,
  accentKey,
  loading,
  disabled,
  full,
  flat = false,
  haptic,
  style,
}: {
  title: string;
  accessibilityLabel?: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: FeatherName;
  accentKey?: AccentKey;
  loading?: boolean;
  disabled?: boolean;
  full?: boolean;
  /** Removes the visible 3D depth from filled variants. */
  flat?: boolean;
  /** Override the press haptic. Filled CTAs default to "medium", others "light". */
  haptic?: HapticKind;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors, accent } = useTheme();
  const depth = useSharedValue(0);
  const reducedMotion = useReducedMotion();
  const [isPressed, setIsPressed] = useState(false);
  const faceStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: reducedMotion ? 0 : depth.value }],
  }));

  const acc = accentKey ? accent[accentKey] : null;
  const main =
    variant === 'primary'
      ? colors.accent
      : variant === 'danger'
        ? colors.danger
        : variant === 'secondary'
          ? colors.backgroundSoft
          : variant === 'ghost'
            ? 'transparent'
            : variant === 'accent'
              ? (acc?.main ?? colors.accent)
              : 'transparent';
  const shade =
    variant === 'danger'
      ? colors.buttonDangerDepth
      : variant === 'accent'
        ? colors.buttonAccentDepth
        : colors.buttonPrimaryDepth;
  const isFilled = variant === 'primary' || variant === 'danger' || variant === 'accent';
  const fg =
    variant === 'link'
      ? colors.accent
      : isFilled
        ? variant === 'accent' && acc
          ? acc.on
          : colors.onAccent
        : variant === 'ghost'
          ? colors.accent
          : colors.text;

  const pad =
    size === 'sm'
      ? { paddingVertical: 9, paddingHorizontal: 14 }
      : size === 'lg'
        ? { paddingVertical: 16, paddingHorizontal: 22 }
        : { paddingVertical: 13, paddingHorizontal: 18 };
  const fSize =
    variant === 'link'
      ? size === 'lg'
        ? font.sizes.base
        : font.sizes.sm
      : size === 'sm'
        ? font.sizes.sm
        : size === 'lg'
          ? font.sizes.md
          : font.sizes.base;
  const isLargeLink = variant === 'link' && size === 'lg';
  const isDisabled = disabled || loading;
  const hasDepth = isFilled && !flat;
  const buttonFaceStyle: ViewStyle = {
    borderRadius: variant === 'link' ? radius.sm : radius.md,
    backgroundColor: main,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: variant === 'link' ? 'flex-end' : undefined,
    minHeight: 44,
    minWidth: 44,
    paddingHorizontal: variant === 'link' ? space.md : pad.paddingHorizontal,
    paddingVertical: variant === 'link' ? space.sm : pad.paddingVertical,
    opacity: isDisabled ? 0.6 : reducedMotion && isPressed ? 0.78 : 1,
    overflow: 'hidden',
  };

  return (
    <View style={[full && { alignSelf: 'stretch' }, style]}>
      <View
        style={{
          borderRadius: radius.md,
          backgroundColor: hasDepth ? shade : 'transparent',
          paddingBottom: hasDepth ? BUTTON_DEPTH : 0,
        }}>
        <Animated.View style={faceStyle}>
          <Pressable
            disabled={isDisabled}
            accessibilityRole="button"
            accessibilityLabel={accessibilityLabel ?? title}
            accessibilityState={{ disabled: isDisabled, busy: loading }}
            onPressIn={() => {
              setIsPressed(true);
              if (hasDepth && !isDisabled && !reducedMotion) {
                depth.value = withTiming(BUTTON_DEPTH, { duration: 60 });
              }
            }}
            onPressOut={() => {
              setIsPressed(false);
              if (hasDepth) {
                depth.value = reducedMotion ? 0 : withSpring(0, PRESS_SPRING);
              }
            }}
            onPress={() => {
              if (isDisabled) return;
              // Every button gives a solid, Duolingo-style "click" (medium);
              // callers can still override per-button via the `haptic` prop.
              fireHaptic(haptic ?? 'medium');
              onPress?.();
            }}
            style={buttonFaceStyle}>
            <Row gap={8}>
              {loading ? (
                <ActivityIndicator
                  accessibilityRole="progressbar"
                  accessibilityState={{ busy: true }}
                  color={fg}
                  size="small"
                />
              ) : icon ? (
                <Feather name={icon} size={fSize + 2} color={fg} />
              ) : null}
              <Text
                style={{
                  color: fg,
                  fontSize: fSize,
                  fontWeight: isLargeLink ? '600' : variant === 'link' ? '400' : '700',
                  lineHeight: isLargeLink ? font.lineHeights.body : undefined,
                }}>
                {title}
              </Text>
            </Row>
          </Pressable>
        </Animated.View>
      </View>
    </View>
  );
}

export function IconButton({
  icon,
  onPress,
  color,
  bg,
  size = 44,
  iconSize = 20,
  style,
  disabled,
  accessibilityLabel,
}: {
  icon: FeatherName;
  onPress?: () => void;
  color?: string;
  bg?: string;
  size?: number;
  iconSize?: number;
  style?: StyleProp<ViewStyle>;
  disabled?: boolean;
  accessibilityLabel: string;
}) {
  const { colors } = useTheme();
  const fg = color ?? colors.text;
  const background = bg ?? colors.backgroundElement;
  const effectiveSize = Math.max(size, 44);
  return (
    <Press
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={disabled ? { disabled: true } : undefined}
      style={[
        {
          width: effectiveSize,
          height: effectiveSize,
          minWidth: 44,
          minHeight: 44,
          borderRadius: effectiveSize / 2,
          backgroundColor: background,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: disabled ? 0.5 : 1,
        },
        shadowStyles.sm,
        style,
      ]}>
      <Feather name={icon} size={iconSize} color={fg} />
    </Press>
  );
}

// ─── Badge / Pill / Chip ─────────────────────────────────────────────────────

export function Badge({
  label,
  tone = 'pantry',
  icon,
  solid = false,
}: {
  label: string;
  tone?: AccentKey;
  icon?: FeatherName;
  solid?: boolean;
}) {
  const { accent } = useTheme();
  const a = accent[tone];
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: solid ? a.main : a.tint,
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: radius.pill,
      }}>
      {icon ? <Feather name={icon} size={12} color={solid ? a.on : a.shadow} /> : null}
      <Txt variant="caption" color={solid ? a.on : a.shadow} weight="700">
        {label}
      </Txt>
    </View>
  );
}

export function Pill({
  label,
  selected,
  onPress,
  tone = 'pantry',
  icon,
  disabled,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  tone?: AccentKey;
  icon?: FeatherName;
  disabled?: boolean;
}) {
  const { colors, accent } = useTheme();
  const a = accent[tone];
  return (
    <Press
      haptic="selection"
      onPress={onPress}
      disabled={disabled}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderRadius: radius.pill,
        backgroundColor: selected ? a.main : colors.backgroundElement,
        borderWidth: borderWidth.base,
        borderColor: selected ? a.main : colors.border,
        opacity: disabled ? 0.5 : 1,
      }}>
      {icon ? (
        <Feather name={icon} size={14} color={selected ? a.on : colors.textSecondary} />
      ) : null}
      <Txt variant="label" color={selected ? a.on : colors.text} weight="700">
        {label}
      </Txt>
    </Press>
  );
}

export type SegmentedControlOption<T extends string> = {
  value: T;
  label: string;
  accessibilityLabel?: string;
  disabled?: boolean;
};

export type SegmentedControlProps<T extends string> = {
  label: string;
  options: readonly SegmentedControlOption<T>[];
  selected: T;
  onSelect: (value: T) => void;
  /** Use tabs for view navigation; radio is the default for domain choices. */
  selectionRole?: 'radio' | 'tab';
  appearance?: 'accent' | 'surface';
  size?: 'default' | 'compact';
};

export function SegmentedControl<T extends string>({
  label,
  options,
  selected,
  onSelect,
  selectionRole = 'radio',
  appearance = 'accent',
  size = 'default',
}: SegmentedControlProps<T>) {
  const styles = controlStyles;
  return (
    <View
      accessibilityRole={selectionRole === 'tab' ? 'tablist' : 'radiogroup'}
      accessibilityLabel={label}
      style={styles.segment}>
      {options.map((option) => {
        const active = option.value === selected;
        const activeStyle =
          appearance === 'surface'
            ? styles.segmentItemActiveSurface
            : styles.segmentItemActiveAccent;
        return (
          <Press
            key={option.value}
            haptic="selection"
            scaleTo={0.98}
            disabled={option.disabled}
            accessibilityRole={selectionRole}
            accessibilityLabel={option.accessibilityLabel ?? option.label}
            accessibilityState={{ selected: active, disabled: option.disabled }}
            onPress={() => onSelect(option.value)}
            containerStyle={{ flex: 1 }}
            style={[
              styles.segmentItem,
              size === 'compact' ? styles.segmentItemCompact : styles.segmentItemDefault,
              active && activeStyle,
              active && appearance === 'surface' && styles.shadowSm,
              option.disabled && styles.segmentItemDisabled,
            ]}>
            <Txt
              variant={size === 'compact' ? 'caption' : 'label'}
              tone={active ? (appearance === 'surface' ? 'primary' : 'onAccent') : 'secondary'}
              weight="700"
              style={styles.segmentLabel}>
              {option.label}
            </Txt>
          </Press>
        );
      })}
    </View>
  );
}

// ─── TextField ───────────────────────────────────────────────────────────────

export type TextFieldProps = TextInputProps & {
  label?: string;
  size?: 'default' | 'large';
  error?: string;
  trailing?: ReactNode;
  success?: boolean;
};

export const TextField = forwardRef<TextInput, TextFieldProps>(function TextField(
  {
    label,
    size = 'default',
    error,
    trailing,
    success,
    style,
    accessibilityLabel,
    accessibilityHint,
    accessibilityState,
    editable = true,
    multiline = false,
    onFocus,
    onBlur,
    returnKeyType,
    submitBehavior,
    ...rest
  },
  ref,
) {
  const { colors } = useTheme();
  const styles = controlStyles;
  const [focused, setFocused] = useState(false);
  const resolvedReturnKeyType = returnKeyType ?? (multiline ? undefined : 'done');
  const resolvedSubmitBehavior = submitBehavior ?? (multiline ? undefined : 'blurAndSubmit');

  return (
    <View style={styles.fieldContainer}>
      {label ? (
        <Txt variant="label" color={focused ? colors.accent : colors.textSecondary}>
          {label}
        </Txt>
      ) : null}

      <View style={styles.inputWrapper}>
        <TextInput
          ref={ref}
          {...rest}
          editable={editable}
          multiline={multiline}
          placeholderTextColor={colors.textSecondary}
          selectionColor={colors.accent}
          returnKeyType={resolvedReturnKeyType}
          submitBehavior={resolvedSubmitBehavior}
          accessibilityLabel={accessibilityLabel ?? label ?? rest.placeholder}
          accessibilityHint={accessibilityHint ?? error}
          accessibilityState={{
            ...accessibilityState,
            disabled: editable === false || accessibilityState?.disabled === true,
          }}
          onFocus={(event) => {
            setFocused(true);
            onFocus?.(event);
          }}
          onBlur={(event) => {
            setFocused(false);
            onBlur?.(event);
          }}
          style={[
            styles.input,
            size === 'large' ? styles.inputLarge : null,
            focused ? styles.inputFocused : null,
            error ? styles.inputError : null,
            success ? pressSuccessStyles.field : null,
            success ? pressSuccessStyles.foreground : null,
            editable === false ? styles.inputDisabled : null,
            trailing ? styles.inputWithTrailing : null,
            style,
          ]}
        />
        {trailing ? <View style={styles.trailingWrapper}>{trailing}</View> : null}
      </View>

      {error ? (
        <Txt variant="body" tone="danger" accessibilityRole="alert">
          {error}
        </Txt>
      ) : null}
    </View>
  );
});

// ─── Section heading ─────────────────────────────────────────────────────────

const sectionHeadingStyles = StyleSheet.create((theme) => ({
  root: {
    alignItems: 'flex-end',
    gap: theme.space.md,
    marginBottom: theme.space.md,
    minHeight: 24,
  },
  content: {
    flexShrink: 1,
  },
  eyebrow: {
    letterSpacing: 0.7,
    textTransform: 'uppercase',
  },
  action: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
    minWidth: 44,
  },
}));

export function SectionHeading({
  title,
  eyebrow,
  titleVariant = 'heading',
  action,
  onAction,
  style,
}: {
  title: string;
  eyebrow?: string;
  titleVariant?: TxtVariant;
  action?: string;
  onAction?: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Row justify="space-between" style={[sectionHeadingStyles.root, style]}>
      <View style={sectionHeadingStyles.content}>
        {eyebrow ? (
          <Txt variant="caption" tone="secondary" weight="600" style={sectionHeadingStyles.eyebrow}>
            {eyebrow}
          </Txt>
        ) : null}
        <Txt variant={titleVariant} weight="700">
          {title}
        </Txt>
      </View>
      {action && onAction ? (
        <Press
          accessibilityLabel={action}
          accessibilityRole="button"
          hitSlop={8}
          haptic="selection"
          onPress={onAction}
          style={sectionHeadingStyles.action}>
          <Txt variant="caption" tone="primary" weight="700">
            {action}
          </Txt>
        </Press>
      ) : null}
    </Row>
  );
}

const controlStyles = StyleSheet.create((theme) => ({
  shadowSm: makeThemeShadow(shadow.sm, theme.shadowCard),
  segment: {
    flexDirection: 'row',
    alignItems: 'stretch',
    backgroundColor: theme.backgroundSoft,
    borderRadius: radius.md,
    padding: space.xs,
    gap: space.xs,
  },
  segmentItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
    borderRadius: radius.sm,
    paddingHorizontal: space.sm,
  },
  segmentItemDefault: {
    minHeight: 48,
    paddingVertical: space.sm,
  },
  segmentItemCompact: {
    minHeight: 44,
    paddingVertical: space.xs,
  },
  segmentItemActiveAccent: {
    backgroundColor: theme.accent,
  },
  segmentItemActiveSurface: {
    backgroundColor: theme.backgroundElement,
  },
  segmentItemDisabled: {
    opacity: 0.55,
  },
  segmentLabel: {
    flexShrink: 1,
    textAlign: 'center',
  },
  fieldContainer: {
    gap: space.xs,
  },
  inputWrapper: {
    position: 'relative',
  },
  input: {
    backgroundColor: theme.backgroundElement,
    borderWidth: borderWidth.strong,
    borderColor: theme.border,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: font.sizes.base,
    lineHeight: font.lineHeights.body,
    color: theme.text,
  },
  inputLarge: {
    fontSize: font.sizes.md,
    lineHeight: font.lineHeights.subheading,
  },
  inputFocused: {
    borderColor: theme.accent,
  },
  inputError: {
    borderColor: theme.danger,
  },
  inputDisabled: {
    backgroundColor: theme.backgroundSoft,
    color: theme.textSecondary,
  },
  inputWithTrailing: {
    paddingRight: 52,
  },
  trailingWrapper: {
    position: 'absolute',
    zIndex: 10,
    right: 2,
    top: 2,
    bottom: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
}));

export type { FeatherName };
