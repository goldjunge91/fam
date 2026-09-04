import { View } from 'react-native';
import { withAlpha } from '@/components/theme/index';
import { useTheme } from '@/components/theme/ThemeProvider';
import { Txt } from '@/constants/ui';

export function ModuleLockedOverlay() {
  const { colors } = useTheme();

  return (
    <View
      className="module-row-locked-overlay"
      style={{ backgroundColor: withAlpha(colors.backgroundElement, 0.4) }}>
      <View className="module-row-locked-pill" style={{ backgroundColor: colors.text }}>
        <View className="module-row-locked-pill-dot" />
        <Txt variant="body" weight="700" color={colors.background}>
          Demnächst verfügbar
        </Txt>
      </View>
    </View>
  );
}
