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

import { useTheme } from '@/components/theme/ThemeProvider';
import { BUTTON_DEPTH } from '@/components/theme/index';
import { Txt } from '@/constants/ui';

type ButtonProps = {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'link';

  size?: 'default' | 'large' | 'compact';
  accessibilityLabel?: string;
  backgroundColor?: ColorValue;
  style?: StyleProp<ViewStyle>;
  /** Zeigt einen Spinner und sperrt den Knopf — verhindert Doppel-Submits. */
  loading?: boolean;
  disabled?: boolean;
  className?: string;
};

const VARIANT_CLASSES: Record<NonNullable<ButtonProps['variant']>, string> = {
  primary: 'btn-primary',
  secondary: 'btn-secondary',
  danger: 'btn-danger',
  link: 'btn-link',
};

/** Beschrifteter Standardbutton fuer Formulare und bestaetigende Aktionen. */
export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'default',
  accessibilityLabel,
  backgroundColor,
  style,
  loading = false,
  disabled = false,
  className = '',
}: ButtonProps) {
  const { colors } = useTheme();
  const isBlocked = loading || disabled;
  const variantClass = VARIANT_CLASSES[variant] ?? 'btn-primary';
  const isFilled = variant === 'primary' || variant === 'danger';
  const depth = useSharedValue(0);
  const faceStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: depth.value }],
  }));

  const foreground =
    variant === 'secondary' ? colors.text : variant === 'link' ? colors.basil : colors.inverse;
  const labelTone =
    variant === 'secondary' ? 'primary' : variant === 'link' ? 'accent' : 'onAccent';
  const buttonBackground =
    backgroundColor ??
    (variant === 'primary'
      ? colors.basil
      : variant === 'danger'
        ? colors.tomato
        : variant === 'secondary'
          ? colors.surface
          : 'transparent');

  return (
    <View
      style={{
        paddingBottom: isFilled ? BUTTON_DEPTH : 0,
        borderRadius: 16,
        backgroundColor: isFilled
          ? variant === 'danger'
            ? colors.tomatoShadow
            : colors.basilShadow
          : 'transparent',
      }}>
      <Animated.View style={faceStyle}>
        <Pressable
          onPress={onPress}
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
          className={`${variantClass} ${size === 'compact' ? '!py-two !px-three' : ''} ${isBlocked ? 'opacity-50' : ''} ${className}`.trim()}
          style={[
            {
              backgroundColor: buttonBackground,
              ...(variant === 'secondary' ? { borderColor: colors.border, borderWidth: 1 } : {}),
            },
            style,
          ]}>
          <View className="flex-row items-center gap-two">
            {loading ? <ActivityIndicator size="small" color={foreground} /> : null}
            <Txt
              variant="body"
              tone={labelTone}
              weight={variant === 'link' ? '400' : '700'}
              className={size === 'large' ? 'text-body' : ''}>
              {label}
            </Txt>
          </View>
        </Pressable>
      </Animated.View>
    </View>
  );
}
