import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import { type Palette, radius, space, withAlpha } from '@/components/theme/index';
import { useTheme, useThemedStyles } from '@/components/theme/ThemeProvider';
import { Txt } from '@/constants/ui';

function makeStyles(colors: Palette) {
  return StyleSheet.create({
    overlay: {
      position: 'absolute',
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: withAlpha(colors.backgroundElement, 0.4),
    },
    pill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.xs,
      paddingHorizontal: space.md,
      paddingVertical: 7,
      borderRadius: radius.pill,
      backgroundColor: colors.text,
    },
    dot: {
      width: 5,
      height: 5,
      borderRadius: radius.pill,
      backgroundColor: colors.warning,
    },
  });
}

export function ModuleLockedOverlay() {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);

  return (
    <View style={styles.overlay}>
      <View style={styles.pill}>
        <View style={styles.dot} />
        <Txt variant="body" weight="700" color={colors.background}>
          Demnächst verfügbar
        </Txt>
      </View>
    </View>
  );
}
