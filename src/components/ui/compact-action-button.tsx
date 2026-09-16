import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import { compactActionButtonStyles, Press, Txt } from '@/constants/ui';

type CompactActionButtonProps = {
  label: string;
  onPress: () => void;
  accessibilityLabel?: string;
  expanded?: boolean;
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

/** Vollbreite 34-Punkt-Aktion für kompakte Menüs und Bottom Sheets. */
export function CompactActionButton({
  label,
  onPress,
  accessibilityLabel,
  expanded = false,
}: CompactActionButtonProps) {
  return (
    <Press
      onPress={onPress}
      hitSlop={5}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ expanded }}
      style={compactActionButtonStyles.button}>
      <Txt variant="body">{label}</Txt>
      <View style={[styles.chevron, { transform: [{ rotate: expanded ? '180deg' : '0deg' }] }]}>
        <View style={[compactActionButtonStyles.chevronLine, styles.chevronLeft]} />
        <View style={[compactActionButtonStyles.chevronLine, styles.chevronRight]} />
      </View>
    </Press>
  );
}
