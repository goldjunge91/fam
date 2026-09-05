import {
  ActivityIndicator,
  type ColorValue,
  Pressable,
  type StyleProp,
  Text,
  View,
  type ViewStyle,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { type AccentKey, BUTTON_DEPTH, font, radius, space } from '@/components/theme/index';
import { useTheme } from '@/components/theme/ThemeProvider';
import { medium as hapticMedium } from '@/lib/haptics';

type ButtonProps = {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'link' | 'ghost' | 'accent';

  size?: 'default' | 'large' | 'compact';
  accentKey?: AccentKey;
  accessibilityLabel?: string;
  backgroundColor?: ColorValue;
  style?: StyleProp<ViewStyle>;
  /** Zeigt einen Spinner und sperrt den Knopf — verhindert Doppel-Submits. */
  loading?: boolean;
  disabled?: boolean;
  /** Entfernt die sichtbare 3D-Tiefenfläche für kompakte Header-Aktionen. */
  flat?: boolean;
  className?: string;
};

/** Beschrifteter Standardbutton fuer Formulare und bestaetigende Aktionen. */
export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'default',
  accentKey,
  accessibilityLabel,
  backgroundColor,
  style,
  loading = false,
  disabled = false,
  flat = false,
  className = '',
}: ButtonProps) {
  const { colors, accent } = useTheme();
  const isBlocked = loading || disabled;
  const isFilled = variant === 'primary' || variant === 'danger' || variant === 'accent';
  const depth = useSharedValue(0);
  const faceStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: depth.value }],
  }));

  const accentTone = accentKey ? accent[accentKey] : undefined;
  const foreground =
    variant === 'secondary' || variant === 'ghost'
      ? colors.text
      : variant === 'link'
        ? colors.accent
        : variant === 'accent'
          ? (accentTone?.on ?? colors.onAccent)
          : colors.onAccent;
  const fontSize =
    variant === 'link' || size === 'compact'
      ? font.sizes.sm
      : size === 'large'
        ? font.sizes.md
        : font.sizes.base;
  const buttonBackground =
    backgroundColor ??
    (variant === 'primary'
      ? colors.accent
      : variant === 'danger'
        ? colors.danger
        : variant === 'secondary'
          ? colors.backgroundSoft
          : variant === 'ghost'
            ? 'transparent'
            : variant === 'accent'
              ? (accentTone?.main ?? colors.accent)
              : 'transparent');
  const buttonDepth =
    variant === 'danger'
      ? colors.buttonDangerDepth
      : variant === 'accent'
        ? colors.buttonAccentDepth
        : colors.buttonPrimaryDepth;
  const hasDepth = isFilled && !flat;

  return (
    <View
      style={{
        paddingBottom: hasDepth ? BUTTON_DEPTH : 0,
        borderRadius: radius.md,
        backgroundColor: hasDepth ? buttonDepth : 'transparent',
      }}>
      <Animated.View style={faceStyle}>
        <Pressable
          onPress={() => {
            if (isBlocked) return;
            hapticMedium();
            onPress();
          }}
          disabled={isBlocked}
          accessibilityRole="button"
          accessibilityLabel={accessibilityLabel ?? label}
          accessibilityState={{ disabled: isBlocked, busy: loading }}
          onPressIn={() => {
            if (hasDepth) depth.value = withTiming(BUTTON_DEPTH, { duration: 60 });
          }}
          onPressOut={() => {
            if (hasDepth) {
              depth.value = withSpring(0, { damping: 14, stiffness: 320, mass: 0.5 });
            }
          }}
          className={className}
          style={[
            {
              backgroundColor: buttonBackground,
              borderRadius: variant === 'link' ? radius.sm : radius.md,
              alignItems: 'center',
              justifyContent: 'center',
              alignSelf: variant === 'link' ? 'flex-end' : undefined,
              minHeight: variant === 'link' ? undefined : 44,
              paddingHorizontal:
                variant === 'link'
                  ? space.md
                  : size === 'compact'
                    ? space.md
                    : size === 'large'
                      ? space.xl
                      : space.lg,
              paddingVertical:
                variant === 'link'
                  ? space.sm
                  : size === 'compact'
                    ? space.sm
                    : size === 'large'
                      ? space.lg
                      : space.md,
              opacity: isBlocked ? 0.5 : 1,
              overflow: 'hidden',
            },
            style,
          ]}>
          <View className="flex-row items-center gap-two">
            {loading ? <ActivityIndicator size="small" color={foreground} /> : null}
            <Text
              style={{
                color: foreground,
                fontSize,
                fontWeight: variant === 'link' ? '400' : '700',
              }}>
              {label}
            </Text>
          </View>
        </Pressable>
      </Animated.View>
    </View>
  );
}
