/**
 * ui UI kit — the Pantry Pop design-system primitives, native edition.
 * Big touch targets, rounded cards, 3D buttons, soft shadows, haptics.
 * Theme-aware: colors come from useTheme() so everything flips with dark mode.
 */

import { Feather } from '@expo/vector-icons';
import type React from 'react';
import type { ReactNode } from 'react';
import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  type PressableProps,
  type StyleProp,
  StyleSheet,
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
import {
  type AccentKey,
  BUTTON_DEPTH,
  font,
  type Palette,
  radius,
  shadow,
  space,
} from '@/components/theme/index';
import { useTheme, useThemedStyles } from '@/components/theme/ThemeProvider';
import {
  heavy as hapticHeavy,
  light as hapticLight,
  medium as hapticMedium,
  selection as hapticSelection,
  success as hapticSuccess,
} from '@/lib/haptics';

// Springs tuned for a satisfying, Duolingo-ish "pop" on press/release.
const PRESS_SPRING = { damping: 14, stiffness: 320, mass: 0.5 } as const;
const POP_SPRING = { damping: 9, stiffness: 380, mass: 0.5 } as const;

function makeShadowStyles(c: Palette) {
  return {
    sm: { ...shadow.sm, shadowColor: c.shadowCard },
    md: { ...shadow.md, shadowColor: c.shadowCard },
    lg: { ...shadow.lg, shadowColor: c.shadowCard },
  };
}

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

// ─── Text ────────────────────────────────────────────────────────────────────

export type TxtVariant =
  | 'display'
  | 'title'
  | 'heading'
  | 'subheading'
  | 'body'
  | 'label'
  | 'caption';

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
  className?: string;
};

export function Txt({
  variant = 'body',
  tone,
  color,
  weight,
  center,
  muted,
  className,
  style,
  children,
  ...rest
}: TxtProps) {
  const { colors } = useTheme();
  const base = TXT[variant];
  const textColor = tone ? colors[TEXT_TONE[tone]] : colors[muted ? 'textSecondary' : base.tone];
  return (
    <Text
      {...rest}
      className={className}
      style={[
        {
          fontSize: base.fontSize,
          lineHeight: base.lineHeight,
          fontWeight: base.fontWeight,
          color: textColor,
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

/** A semantic themed container. Layout utilities remain available via className. */
export function Surface({
  tone = 'page',
  className,
  style,
  children,
  ...rest
}: ViewProps & {
  tone?: SurfaceTone;
  className?: string;
}) {
  const { colors } = useTheme();
  const backgroundColor =
    tone === 'page'
      ? colors.background
      : tone === 'surface'
        ? colors.backgroundElement
        : tone === 'soft'
          ? colors.backgroundSoft
          : colors.accent;

  return (
    <View {...rest} className={className} style={[{ backgroundColor }, style]}>
      {children}
    </View>
  );
}

export function Spacer({ h = space.md }: { h?: number }) {
  return <View style={{ height: h }} />;
}

export function Divider({ style }: { style?: StyleProp<ViewStyle> }) {
  const { colors } = useTheme();
  return <View style={[{ height: 1, backgroundColor: colors.border }, style]} />;
}

// ─── Card ────────────────────────────────────────────────────────────────────

export function Card({
  style,
  padded = true,
  soft = false,
  elevation = 'sm',
  children,
  ...rest
}: ViewProps & {
  padded?: boolean;
  soft?: boolean;
  elevation?: 'none' | 'sm' | 'md' | 'lg';
}) {
  const { colors } = useTheme();
  const themedShadow = useThemedStyles(makeShadowStyles);
  return (
    <View
      {...rest}
      style={[
        {
          backgroundColor: colors.backgroundElement,
          borderRadius: radius.lg,
          borderWidth: 1,
          borderColor: colors.border,
        },
        soft && { backgroundColor: colors.backgroundSoft },
        padded && { padding: space.lg },
        elevation !== 'none' && themedShadow[elevation],
        style,
      ]}>
      {children}
    </View>
  );
}

// ─── Pressable with scale + haptic ───────────────────────────────────────────

export function Press({
  onPress,
  haptic = 'light',
  scaleTo = 0.96,
  style,
  containerStyle,
  children,
  disabled,
  ...rest
}: PressableProps & {
  haptic?: HapticKind;
  scaleTo?: number;
  /** Layout style for the animated wrapper (e.g. flex:1 so the item stretches). */
  containerStyle?: StyleProp<ViewStyle>;
}) {
  const s = useSharedValue(1);
  const aStyle = useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }));
  return (
    <Animated.View style={[aStyle, containerStyle]}>
      <Pressable
        {...rest}
        disabled={disabled}
        onPressIn={() => {
          s.value = withTiming(scaleTo, { duration: 70 });
        }}
        onPressOut={() => {
          // spring back with a touch of overshoot — the "pop".
          s.value = withSpring(1, POP_SPRING);
        }}
        onPress={(e) => {
          fireHaptic(haptic);
          onPress?.(e);
        }}
        style={style}>
        {children}
      </Pressable>
    </Animated.View>
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
      ? font.sizes.sm
      : size === 'sm'
        ? font.sizes.sm
        : size === 'lg'
          ? font.sizes.md
          : font.sizes.base;
  const isDisabled = disabled || loading;
  const hasDepth = isFilled && !flat;

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
              if (hasDepth && !isDisabled && !reducedMotion) {
                depth.value = withTiming(BUTTON_DEPTH, { duration: 60 });
              }
            }}
            onPressOut={() => {
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
            style={({ pressed }) => [
              {
                borderRadius: variant === 'link' ? radius.sm : radius.md,
                backgroundColor: main,
                alignItems: 'center',
                justifyContent: 'center',
                alignSelf: variant === 'link' ? 'flex-end' : undefined,
                minHeight: 44,
                minWidth: 44,
                paddingHorizontal: variant === 'link' ? space.md : pad.paddingHorizontal,
                paddingVertical: variant === 'link' ? space.sm : pad.paddingVertical,
                opacity: isDisabled ? 0.6 : reducedMotion && pressed ? 0.78 : 1,
                overflow: 'hidden',
              },
            ]}>
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
                  fontWeight: variant === 'link' ? '400' : '700',
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
  size = 42,
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
  accessibilityLabel?: string;
}) {
  const { colors } = useTheme();
  const themedShadow = useThemedStyles(makeShadowStyles);
  const fg = color ?? colors.text;
  const background = bg ?? colors.backgroundElement;
  return (
    <Press
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={[
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: background,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: disabled ? 0.5 : 1,
        },
        themedShadow.sm,
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
        borderWidth: 1.5,
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

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { label: string; value: T }[];
  value: T;
  onChange: (v: T) => void;
}) {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.segment}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Press
            key={o.value}
            haptic="selection"
            scaleTo={0.98}
            onPress={() => onChange(o.value)}
            containerStyle={{ flex: 1 }}
            style={[styles.segmentItem, active && styles.segmentItemActive]}>
            <Txt
              variant="label"
              numberOfLines={1}
              color={active ? colors.text : colors.textSecondary}
              weight="700">
              {o.label}
            </Txt>
          </Press>
        );
      })}
    </View>
  );
}

// ─── Field ───────────────────────────────────────────────────────────────────

export function Field({
  label,
  style,
  onFocus,
  onBlur,
  returnKeyType = 'done',
  submitBehavior = 'blurAndSubmit',
  ...rest
}: TextInputProps & { label?: string }) {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const [focused, setFocused] = useState(false);

  return (
    <View style={{ gap: 6 }}>
      {label ? (
        <Txt variant="label" color={focused ? colors.accent : colors.text}>
          {label}
        </Txt>
      ) : null}
      <TextInput
        placeholderTextColor={colors.textSecondary}
        selectionColor={colors.accent}
        returnKeyType={returnKeyType}
        submitBehavior={submitBehavior}
        onFocus={(event) => {
          setFocused(true);
          onFocus?.(event);
        }}
        onBlur={(event) => {
          setFocused(false);
          onBlur?.(event);
        }}
        {...rest}
        style={[styles.input, focused && styles.inputFocused, style]}
      />
    </View>
  );
}

// ─── Empty state ─────────────────────────────────────────────────────────────

export function EmptyState({
  emoji,
  title,
  subtitle,
  action,
}: {
  emoji: string;
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <View
      style={{
        alignItems: 'center',
        paddingVertical: space.xxxl,
        paddingHorizontal: space.xl,
        gap: 8,
      }}>
      <Text style={{ fontSize: 52 }}>{emoji}</Text>
      <Txt variant="heading" center>
        {title}
      </Txt>
      {subtitle ? (
        <Txt variant="body" muted center style={{ maxWidth: 300 }}>
          {subtitle}
        </Txt>
      ) : null}
      {action ? <View style={{ marginTop: space.md }}>{action}</View> : null}
    </View>
  );
}

// ─── Section heading ─────────────────────────────────────────────────────────

export function SectionHeading({
  title,
  action,
  onAction,
  style,
}: {
  title: string;
  action?: string;
  onAction?: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useTheme();
  return (
    <Row justify="space-between" style={[{ marginBottom: space.sm }, style]}>
      <Txt variant="heading">{title}</Txt>
      {action ? (
        <Press onPress={onAction} haptic="selection">
          <Txt variant="label" color={colors.accent} weight="700">
            {action}
          </Txt>
        </Press>
      ) : null}
    </Row>
  );
}

function makeStyles(c: Palette) {
  return StyleSheet.create({
    segment: {
      flexDirection: 'row',
      backgroundColor: c.backgroundSoft,
      borderRadius: radius.md,
      padding: 4,
      gap: 4,
    },
    segmentItem: {
      flex: 1,
      paddingVertical: 9,
      alignItems: 'center',
      borderRadius: radius.sm,
    },
    segmentItemActive: {
      backgroundColor: c.backgroundElement,
      ...shadow.sm,
      shadowColor: c.shadowCard,
    },
    input: {
      backgroundColor: c.backgroundElement,
      borderWidth: 1.5,
      borderColor: c.border,
      borderRadius: radius.md,
      paddingHorizontal: 14,
      paddingVertical: 12,
      fontSize: font.sizes.md,
      color: c.text,
    },
    inputFocused: {
      borderColor: c.accent,
      borderWidth: 2,
    },
  });
}

export type { FeatherName };
