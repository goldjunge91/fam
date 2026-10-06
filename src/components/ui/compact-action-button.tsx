import type { StyleProp, ViewStyle } from 'react-native';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import { compactActionButtonStyles, Press, Txt } from '@/constants/ui';

type CompactActionButtonProps = {
  label: string;
  onPress: () => void;
  accessibilityLabel?: string;
  expanded?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
};

const styles = StyleSheet.create({
  chevron: {
    width: 12,
    height: 7,
  },
  chevronLeft: {
    left: 0,
    transform: [{ rotate: '38deg' }],
  },
  chevronRight: {
    right: 0,
    transform: [{ rotate: '-38deg' }],
  },
});

/**
 * Vollbreite Aktion fuer kompakte Menues und Bottom Sheets. Die sichtbare
 * Flaeche traegt `MIN_TOUCH_SIZE` direkt, deshalb braucht sie kein `hitSlop` —
 * das waere nach dem Vertrag in
 * `docs/design-system/contracts/07-buttons-and-interaction.md` nur ein
 * Ersatz fuer eine echte Trefferflaeche und koennte Nachbaraktionen treffen.
 */
export function CompactActionButton({
  label,
  onPress,
  accessibilityLabel,
  expanded = false,
  disabled = false,
  style,
}: CompactActionButtonProps) {
  return (
    <Press
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ expanded, disabled }}
      style={[
        compactActionButtonStyles.button,
        disabled && compactActionButtonStyles.disabled,
        style,
      ]}>
      <Txt variant="body">{label}</Txt>
      <View style={[styles.chevron, { transform: [{ rotate: expanded ? '180deg' : '0deg' }] }]}>
        <View style={[compactActionButtonStyles.chevronLine, styles.chevronLeft]} />
        <View style={[compactActionButtonStyles.chevronLine, styles.chevronRight]} />
      </View>
    </Press>
  );
}
