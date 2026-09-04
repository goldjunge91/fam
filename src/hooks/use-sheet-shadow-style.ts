import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { space, withAlpha } from '@/components/theme/index';
import { useTheme } from '@/components/theme/ThemeProvider';

export function useSheetShadowStyle() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  return {
    paddingBottom: Math.max(insets.bottom, space.lg),
    boxShadow: `0 -16px 48px ${withAlpha(colors.text, 0.2)}`,
    borderCurve: 'continuous' as const,
  };
}
