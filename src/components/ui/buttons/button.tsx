import { ActivityIndicator, type ColorValue, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type ButtonProps = {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'link';
  size?: 'default' | 'large';
  accessibilityLabel?: string;
  backgroundColor?: ColorValue;
  /** Zeigt einen Spinner und sperrt den Knopf — verhindert Doppel-Submits. */
  loading?: boolean;
  disabled?: boolean;
};

/** Beschrifteter Standardbutton fuer Formulare und bestaetigende Aktionen. */
export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'default',
  accessibilityLabel,
  backgroundColor,
  loading = false,
  disabled = false,
}: ButtonProps) {
  const theme = useTheme();
  const isBlocked = loading || disabled;

  const background = backgroundColor
    ? backgroundColor
    : variant === 'primary'
      ? theme.accent
      : variant === 'danger'
        ? theme.danger
        : variant === 'secondary'
          ? theme.backgroundElement
          : undefined;

  const foreground =
    variant === 'secondary' ? theme.text : variant === 'link' ? theme.accent : '#ffffff';

  return (
    <Pressable
      onPress={onPress}
      disabled={isBlocked}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: isBlocked, busy: loading }}
      style={({ pressed }) => [
        styles.button,
        variant === 'link' ? styles.linkButton : styles.filledButton,
        background ? { backgroundColor: background } : null,
        isBlocked && styles.blocked,
        pressed && !isBlocked && styles.pressed,
      ]}>
      <View style={styles.content}>
        {loading ? <ActivityIndicator size="small" color={foreground} /> : null}
        <ThemedText
          type={variant === 'link' ? 'small' : 'smallBold'}
          style={[{ color: foreground }, size === 'large' && styles.largeLabel]}>
          {label}
        </ThemedText>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  filledButton: {
    borderRadius: Spacing.three,
    borderCurve: 'continuous',
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.four,
  },
  linkButton: {
    alignSelf: 'flex-end',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  blocked: {
    opacity: 0.5,
  },
  pressed: {
    opacity: 0.8,
  },
  largeLabel: {
    fontSize: 16,
  },
});
