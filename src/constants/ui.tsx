/**
 * ui UI kit — the Pantry Pop design-system primitives, native edition.
 * Big touch targets, rounded cards, 3D buttons, soft shadows, haptics.
 * Theme-aware: colors come from useTheme() so everything flips with dark mode.
 */

import { Feather } from '@expo/vector-icons';
import type React from 'react';
import type { ReactNode } from 'react';
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
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import {
  type AccentKey,
  BUTTON_DEPTH,
  Fonts,
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
  | 'headingSmall'
  | 'subheading'
  | 'body'
  | 'bodySmall'
  | 'bodyLarge'
  | 'bodyRelaxed'
  | 'controlValue'
  | 'controlValueLarge'
  | 'controlAction'
  | 'controlActionLarge'
  | 'pageSubtitle'
  | 'pageTitle'
  | 'pageTitleLarge'
  | 'stepperAction'
  | 'stepperActionLarge'
  | 'ringValue'
  | 'navigationArrow'
  | 'metricValue'
  | 'chromeTitle'
  | 'label'
  | 'caption'
  | 'captionCompact'
  | 'detail'
  | 'micro'
  | 'link'
  | 'code'
  | 'meta';

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
    fontWeight: '700',
    tone: 'text',
  },
  title: {
    fontSize: font.sizes.xxl,
    lineHeight: font.lineHeights.title,
    fontWeight: '700',
    tone: 'text',
  },
  heading: {
    fontSize: font.sizes.lg,
    lineHeight: font.lineHeights.heading,
    fontWeight: '700',
    tone: 'text',
  },
  headingSmall: {
    fontSize: font.sizes.headingSmall,
    lineHeight: font.lineHeights.headingSmall,
    fontWeight: '700',
    tone: 'text',
  },
  subheading: {
    fontSize: font.sizes.subheading,
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
  bodySmall: {
    fontSize: font.sizes.bodySmall,
    lineHeight: font.lineHeights.bodySmall,
    fontWeight: '400',
    tone: 'text',
  },
  bodyLarge: {
    fontSize: font.sizes.bodyLarge,
    lineHeight: font.lineHeights.bodyLarge,
    fontWeight: '400',
    tone: 'text',
  },
  bodyRelaxed: {
    fontSize: font.sizes.bodyRelaxed,
    lineHeight: font.lineHeights.bodyRelaxed,
    fontWeight: '400',
    tone: 'text',
  },
  controlValue: {
    fontSize: font.sizes.controlValue,
    lineHeight: font.lineHeights.controlValue,
    fontWeight: '500',
    tone: 'text',
  },
  controlValueLarge: {
    fontSize: font.sizes.controlValueLarge,
    lineHeight: font.lineHeights.controlValueLarge,
    fontWeight: '500',
    tone: 'text',
  },
  controlAction: {
    fontSize: font.sizes.controlAction,
    lineHeight: font.lineHeights.controlAction,
    fontWeight: '700',
    tone: 'text',
  },
  controlActionLarge: {
    fontSize: font.sizes.controlActionLarge,
    lineHeight: font.lineHeights.controlActionLarge,
    fontWeight: '700',
    tone: 'text',
  },
  pageSubtitle: {
    fontSize: font.sizes.pageSubtitle,
    lineHeight: font.lineHeights.pageSubtitle,
    fontWeight: '600',
    tone: 'textSecondary',
  },
  pageTitle: {
    fontSize: font.sizes.pageTitle,
    lineHeight: font.lineHeights.pageTitle,
    fontWeight: '600',
    tone: 'text',
    letterSpacing: -0.5,
  },
  pageTitleLarge: {
    fontSize: font.sizes.pageTitleLarge,
    lineHeight: font.lineHeights.pageTitleLarge,
    fontWeight: '700',
    tone: 'text',
    letterSpacing: -0.6,
  },
  stepperAction: {
    fontSize: font.sizes.stepperAction,
    lineHeight: font.lineHeights.stepperAction,
    fontWeight: '400',
    tone: 'textSecondary',
  },
  stepperActionLarge: {
    fontSize: font.sizes.stepperActionLarge,
    lineHeight: font.lineHeights.stepperActionLarge,
    fontWeight: '400',
    tone: 'textSecondary',
  },
  ringValue: {
    fontSize: font.sizes.ringValue,
    lineHeight: font.lineHeights.ringValue,
    fontWeight: '700',
    tone: 'text',
    letterSpacing: -0.5,
  },
  navigationArrow: {
    fontSize: font.sizes.navigationArrow,
    lineHeight: font.lineHeights.navigationArrow,
    fontWeight: '500',
    tone: 'textSecondary',
  },
  metricValue: {
    fontSize: font.sizes.metricValue,
    lineHeight: font.lineHeights.metricValue,
    fontWeight: '700',
    tone: 'text',
  },
  chromeTitle: {
    fontSize: font.sizes.chromeTitle,
    lineHeight: font.lineHeights.chromeTitle,
    fontWeight: '500',
    tone: 'text',
    letterSpacing: -0.5,
  },
  label: {
    fontSize: font.sizes.label,
    lineHeight: font.lineHeights.label,
    fontWeight: '600',
    tone: 'text',
  },
  caption: {
    fontSize: font.sizes.caption,
    lineHeight: font.lineHeights.caption,
    fontWeight: '500',
    tone: 'text',
  },
  captionCompact: {
    fontSize: font.sizes.captionCompact,
    lineHeight: font.lineHeights.captionCompact,
    fontWeight: '500',
    tone: 'text',
  },
  detail: {
    fontSize: font.sizes.detail,
    lineHeight: font.lineHeights.detail,
    fontWeight: '400',
    tone: 'text',
  },
  micro: {
    fontSize: font.sizes.micro,
    lineHeight: font.lineHeights.micro,
    fontWeight: '500',
    tone: 'text',
  },
  link: {
    fontSize: font.sizes.link,
    lineHeight: font.lineHeights.link,
    fontWeight: '600',
    tone: 'accent',
  },
  code: {
    fontSize: font.sizes.code,
    lineHeight: font.lineHeights.code,
    fontWeight: '400',
    tone: 'text',
  },
  meta: {
    fontSize: font.sizes.sm,
    lineHeight: font.lineHeights.label,
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
          fontFamily: variant === 'code' ? Fonts.mono : base.fontFamily,
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

type SurfaceTone = 'page' | 'surface' | 'soft' | 'selected' | 'accent';

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
      : tone === 'accent'
        ? colors.accent
        : tone === 'surface'
          ? colors.backgroundElement
          : colors.backgroundSelected;

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
        soft && { backgroundColor: colors.backgroundSelected },
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

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'accent';
type ButtonSize = 'sm' | 'md' | 'lg';

export function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  icon,
  accentKey,
  loading,
  disabled,
  full,
  haptic,
  style,
}: {
  title: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: FeatherName;
  accentKey?: AccentKey;
  loading?: boolean;
  disabled?: boolean;
  full?: boolean;
  /** Override the press haptic. Filled CTAs default to "medium", others "light". */
  haptic?: HapticKind;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors, accent } = useTheme();
  const depth = useSharedValue(0);
  const faceStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: depth.value }],
  }));

  const acc = accentKey ? accent[accentKey] : null;
  const main =
    variant === 'primary'
      ? colors.accent
      : variant === 'danger'
        ? colors.danger
        : variant === 'accent' && acc
          ? acc.main
          : colors.backgroundElement;
  const shade =
    variant === 'primary'
      ? colors.shadowCard
      : variant === 'danger'
        ? colors.shadowSheet
        : variant === 'accent' && acc
          ? acc.shadow
          : colors.border;
  const isFilled = variant === 'primary' || variant === 'danger' || variant === 'accent';
  const fg = isFilled
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
  const fSize = size === 'sm' ? font.sizes.sm : size === 'lg' ? font.sizes.md : font.sizes.base;
  const isDisabled = disabled || loading;

  return (
    <View style={[full && { alignSelf: 'stretch' }, style]}>
      <View
        style={{
          borderRadius: radius.md,
          backgroundColor: isFilled ? shade : 'transparent',
          paddingBottom: isFilled ? BUTTON_DEPTH : 0,
        }}>
        <Animated.View style={faceStyle}>
          <Pressable
            disabled={isDisabled}
            accessibilityRole="button"
            accessibilityState={{ disabled: isDisabled, busy: loading }}
            onPressIn={() => {
              if (isFilled) depth.value = withTiming(BUTTON_DEPTH, { duration: 60 });
            }}
            onPressOut={() => {
              // pop back up off the 3D shadow with a little bounce.
              depth.value = withSpring(0, PRESS_SPRING);
            }}
            onPress={() => {
              if (isDisabled) return;
              // Every button gives a solid, Duolingo-style "click" (medium);
              // callers can still override per-button via the `haptic` prop.
              fireHaptic(haptic ?? 'medium');
              onPress?.();
            }}
            style={[
              {
                borderRadius: radius.md,
                backgroundColor: main,
                alignItems: 'center',
                justifyContent: 'center',
                opacity: isDisabled ? 0.6 : 1,
              },
              !isFilled && {
                borderWidth: variant === 'ghost' ? 0 : 1.5,
                borderColor: colors.border,
              },
              variant === 'ghost' && { backgroundColor: colors.backgroundSelected },
              pad,
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
              <Txt
                variant={
                  size === 'sm' ? 'label' : size === 'lg' ? 'controlActionLarge' : 'controlAction'
                }
                color={fg}
                weight="700">
                {title}
              </Txt>
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
      <Txt variant="captionCompact" color={solid ? a.on : a.shadow} weight="700">
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

export function Field({ label, style, ...rest }: TextInputProps & { label?: string }) {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={{ gap: 6 }}>
      {label ? <Txt variant="label">{label}</Txt> : null}
      <TextInput
        placeholderTextColor={colors.textSecondary}
        {...rest}
        style={[styles.input, style]}
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
      backgroundColor: c.backgroundSelected,
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
  });
}

export type { FeatherName };
