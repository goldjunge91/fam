import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import { useTheme } from '@/components/theme/ThemeProvider';
import { Txt } from '@/constants/ui';

/** SwiftUI ist auf Android und Web nicht verfügbar; die echte Variante liegt in `.ios.tsx`. */
export function SwiftUIBottomSheetDemo() {
  const { colors } = useTheme();

  return (
    <View style={[styles.unavailable, { backgroundColor: colors.backgroundSoft }]}>
      <Txt variant="caption" tone="secondary">
        SwiftUI-BottomSheet nur auf iOS verfügbar.
      </Txt>
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  unavailable: {
    minHeight: theme.space.xxl,
    justifyContent: 'center',
    paddingHorizontal: theme.space.md,
    borderRadius: theme.radius.md,
    borderWidth: theme.borderWidth.base,
    borderColor: theme.border,
  },
}));
