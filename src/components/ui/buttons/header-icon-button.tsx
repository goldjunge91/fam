import type { ReactNode } from 'react';

import type { PressableProps, StyleProp, ViewStyle } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import { Press } from '@/constants/ui';

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

const styles = StyleSheet.create((theme) => ({
  button: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    width: 39,
    height: 39,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.backgroundElement,
  },
  modalClose: {
    minWidth: theme.space.xxl + theme.space.md + theme.space.xs,
    minHeight: theme.space.xxl + theme.space.md + theme.space.xs,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.radius.sm,
    backgroundColor: theme.backgroundSoft,
  },
}));

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
  const sizeStyle = variant === 'modal-close' ? styles.modalClose : styles.header;
  const defaultHitSlop = variant === 'modal-close' ? 6 : 3;

  return (
    <Press
      onPress={onPress}
      hitSlop={hitSlop ?? defaultHitSlop}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={[styles.button, sizeStyle, bg ? { backgroundColor: bg } : undefined, style]}>
      {children}
    </Press>
  );
}
