import {
  ActivityIndicator,
  type ColorValue,
  Pressable,
  type StyleProp,
  View,
  type ViewStyle,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';

type ButtonProps = {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'link';
  size?: 'default' | 'large';
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
  const theme = useTheme();
  const isBlocked = loading || disabled;
  const variantClass = VARIANT_CLASSES[variant] ?? 'btn-primary';

  const foreground =
    variant === 'secondary' ? theme.text : variant === 'link' ? theme.accent : '#ffffff';

  const labelThemeColor =
    variant === 'secondary' ? 'text' : variant === 'link' ? 'accent' : 'onAccent';

  return (
    <Pressable
      onPress={onPress}
      disabled={isBlocked}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: isBlocked, busy: loading }}
      className={`${variantClass} ${isBlocked ? 'opacity-50' : ''} ${className}`.trim()}
      style={backgroundColor ? [{ backgroundColor }, style] : style}>
      <View className="flex-row items-center gap-two">
        {loading ? <ActivityIndicator size="small" color={foreground} /> : null}
        <ThemedText
          type={variant === 'link' ? 'small' : 'smallBold'}
          themeColor={variant === 'danger' ? undefined : labelThemeColor}
          className={`${variant === 'danger' ? 'text-white' : ''} ${size === 'large' ? 'text-body' : ''}`.trim()}>
          {label}
        </ThemedText>
      </View>
    </Pressable>
  );
}


