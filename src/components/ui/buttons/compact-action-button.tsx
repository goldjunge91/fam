import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ControlSize, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type CompactActionButtonProps = {
  label: string;
  onPress: () => void;
  accessibilityLabel?: string;
  expanded?: boolean;
};

/** Vollbreite 34-Punkt-Aktion für kompakte Menüs und Bottom Sheets. */
export function CompactActionButton({
  label,
  onPress,
  accessibilityLabel,
  expanded = false,
}: CompactActionButtonProps) {
  const theme = useTheme();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ expanded }}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: theme.backgroundElement, borderColor: theme.border },
        pressed && styles.pressed,
      ]}>
      <ThemedText type="default">{label}</ThemedText>
      <View style={[styles.chevron, expanded && styles.chevronExpanded]}>
        <View
          style={[styles.chevronLine, styles.chevronLeft, { backgroundColor: theme.textSecondary }]}
        />
        <View
          style={[styles.chevronLine, styles.chevronRight, { backgroundColor: theme.textSecondary }]}
        />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: '100%',
    height: ControlSize.compactHeight,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 11,
    borderCurve: 'continuous',
    paddingHorizontal: Spacing.three,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  chevron: {
    width: 12,
    height: 7,
  },
  chevronExpanded: {
    transform: [{ rotate: '180deg' }],
  },
  chevronLine: {
    position: 'absolute',
    top: 2,
    width: 7,
    height: 1.5,
    borderRadius: 1,
  },
  chevronLeft: {
    left: 0,
    transform: [{ rotate: '38deg' }],
  },
  chevronRight: {
    right: 0,
    transform: [{ rotate: '-38deg' }],
  },
  pressed: {
    opacity: 0.72,
  },
});
