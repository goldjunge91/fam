import { View } from 'react-native';
import { ThemedText } from '@/components/theme/themed-text';
import { withAlpha } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export function ModuleLockedOverlay() {
  const theme = useTheme();

  return (
    <View
      className="module-row-locked-overlay"
      style={{ backgroundColor: withAlpha(theme.backgroundElement, 0.4) }}>
      <View className="module-row-locked-pill" style={{ backgroundColor: theme.text }}>
        <View className="module-row-locked-pill-dot" />
        <ThemedText type="smallBold" style={{ color: theme.background }}>
          Demnächst verfügbar
        </ThemedText>
      </View>
    </View>
  );
}
