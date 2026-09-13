import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import { Press, Txt } from '@/constants/ui';

type CompactActionButtonProps = {
  label: string;
  onPress: () => void;
  accessibilityLabel?: string;
  expanded?: boolean;
};

const styles = StyleSheet.create((theme) => ({
  button: {
    width: '100%',
    height: 34,
    minHeight: 34,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: theme.radius.sm,
    paddingHorizontal: theme.space.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: theme.backgroundElement,
    borderColor: theme.border,
  },
  chevron: {
    width: 12,
    height: 7,
  },
  chevronLine: {
    position: 'absolute',
    top: 2,
    width: 7,
    height: 1.5,
    borderRadius: 2,
    backgroundColor: theme.textSecondary,
  },
  chevronLeft: {
    left: 0,
    transform: [{ rotate: '38deg' }],
  },
  chevronRight: {
    right: 0,
    transform: [{ rotate: '-38deg' }],
  },
}));

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
      style={styles.button}>
      <Txt variant="body">{label}</Txt>
      <View style={[styles.chevron, { transform: [{ rotate: expanded ? '180deg' : '0deg' }] }]}>
        <View style={[styles.chevronLine, styles.chevronLeft]} />
        <View style={[styles.chevronLine, styles.chevronRight]} />
      </View>
    </Press>
  );
}
