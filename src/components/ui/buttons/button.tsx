import {
  ActivityIndicator,
  type ColorValue,
  Pressable,
  type StyleProp,
  View,
  type ViewStyle,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { type AccentKey, BUTTON_DEPTH, radius, space } from '@/components/theme/index';
import { useTheme } from '@/components/theme/ThemeProvider';
import { Txt } from '@/constants/ui';
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
  const labelTone =
    variant === 'secondary' || variant === 'ghost'
      ? 'primary'
      : variant === 'link'
        ? 'accent'
        : 'onAccent';
  const buttonBackground =
    backgroundColor ??
    (variant === 'primary'
      ? colors.accent
      : variant === 'danger'
        ? colors.danger
        : variant === 'secondary'
          ? colors.backgroundElement
          : variant === 'ghost'
            ? colors.backgroundSelected
            : variant === 'accent'
              ? (accentTone?.main ?? colors.accent)
              : 'transparent');

  return (
    <View
      style={{
        paddingBottom: isFilled ? BUTTON_DEPTH : 0,
        borderRadius: radius.md,
        backgroundColor: isFilled
          ? variant === 'danger'
            ? colors.shadowSheet
            : variant === 'accent'
              ? (accentTone?.shadow ?? colors.shadowCard)
              : colors.shadowCard
          : 'transparent',
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
            if (isFilled) depth.value = withTiming(BUTTON_DEPTH, { duration: 60 });
          }}
          onPressOut={() => {
            depth.value = withSpring(0, { damping: 14, stiffness: 320, mass: 0.5 });
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
              ...(variant === 'secondary' ? { borderColor: colors.border, borderWidth: 1 } : {}),
            },
            style,
          ]}>
          <View className="flex-row items-center gap-two">
            {loading ? <ActivityIndicator size="small" color={foreground} /> : null}
            <Txt
              variant={
                variant === 'link'
                  ? 'link'
                  : size === 'large'
                    ? 'controlActionLarge'
                    : size === 'compact'
                      ? 'bodySmall'
                      : 'controlAction'
              }
              tone={labelTone}
              color={foreground}
              weight={variant === 'link' ? '400' : '700'}>
              {label}
            </Txt>
          </View>
        </Pressable>
      </Animated.View>
    </View>
  );
}
