import type { ReactNode } from 'react';

import type { PressableProps, StyleProp, ViewStyle } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import { iconButtonStyles, MIN_TOUCH_SIZE, Press } from '@/constants/ui';

export type HeaderIconButtonVariant = 'header' | 'modal-close';

type HeaderIconButtonProps = {
  label: string;
  onPress: () => void;
  children: ReactNode;
  hitSlop?: PressableProps['hitSlop'];
  bg?: string;
  style?: StyleProp<ViewStyle>;
  variant?: HeaderIconButtonVariant;
  disabled?: boolean;
};

const styles = StyleSheet.create((_theme) => ({
  // Der Container traegt die echte 44-Punkt-Trefferflaeche. `hitSlop` allein
  // waere laut `docs/design-system/contracts/07-buttons-and-interaction.md`
  // kein Nachweis: bei benachbarten Aktionen mit eigenem `hitSlop` (z. B. dem
  // 12-Punkt-Profilgriff) gewinnt die weiter reichende Flaeche und der
  // sichtbare Knopf verliert Punkte am Rand. Auf dem Geraet gemessen: ein
  // Tap 2 Punkte ausserhalb des 39-Punkt-Rahmens traf den Profilgriff.
  button: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: MIN_TOUCH_SIZE,
    minHeight: MIN_TOUCH_SIZE,
  },
}));

/**
 * Einheitlicher Glasbutton fuer kompakte Header-Aktionen. Der Treffercontainer
 * misst `MIN_TOUCH_SIZE`, damit ein Tap am Rand nicht an eine Nachbaraktion
 * mit eigenem `hitSlop` verloren geht.
 */
export function HeaderIconButton({
  label,
  onPress,
  children,
  hitSlop,
  bg,
  style,
  variant = 'header',
  disabled = false,
}: HeaderIconButtonProps) {
  const sizeStyle =
    variant === 'modal-close' ? iconButtonStyles.modalClose : iconButtonStyles.header;
  const defaultHitSlop = variant === 'modal-close' ? 6 : 3;

  return (
    <Press
      onPress={onPress}
      disabled={disabled}
      hitSlop={hitSlop ?? defaultHitSlop}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      style={[styles.button, sizeStyle, bg ? { backgroundColor: bg } : undefined, style]}>
      {children}
    </Press>
  );
}
