import type { ReactNode } from 'react';

import {
  Pressable,
  type PressableProps,
  type StyleProp,
  StyleSheet,
  type ViewStyle,
} from 'react-native';

import { radius } from '@/components/theme/index';
import { useTheme } from '@/components/theme/ThemeProvider';

export type HeaderIconButtonVariant = 'header' | 'modal-close';

type HeaderIconButtonProps = {
  label: string;
  onPress: () => void;
  children: ReactNode;
  hitSlop?: PressableProps['hitSlop'];
  bg?: string;
  style?: StyleProp<ViewStyle>;
  variant?: HeaderIconButtonVariant;
};

/** Einheitlicher 39-Punkt-Glasbutton fuer kompakte Header-Aktionen. */
export function HeaderIconButton({
  label,
  onPress,
  children,
  hitSlop,
  bg,
  style,
  variant = 'header',
}: HeaderIconButtonProps) {
  const { colors } = useTheme();
  const sizeStyle = variant === 'modal-close' ? styles.modalClose : styles.header;
  const pressedStyle = variant === 'modal-close' ? styles.modalClosePressed : styles.headerPressed;

  return (
    <Pressable
      onPress={onPress}
      hitSlop={hitSlop}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.button,
        sizeStyle,
        { backgroundColor: bg ?? colors.backgroundElement },
        style,
        pressed && pressedStyle,
      ]}>
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    width: 39,
    height: 39,
  },
  modalClose: {
    width: 32,
    height: 32,
  },
  headerPressed: {
    opacity: 0.7,
    transform: [{ scale: 0.95 }],
  },
  modalClosePressed: {
    opacity: 0.75,
  },
});
