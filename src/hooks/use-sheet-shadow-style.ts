import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/components/theme/ThemeProvider';
import { space, withAlpha } from '@/components/theme/index';

export function useSheetShadowStyle() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  return {
    paddingBottom: Math.max(insets.bottom, space.lg),
    boxShadow: `0 -16px 48px ${withAlpha(colors.text, 0.2)}`,
    borderCurve: 'continuous' as const,
  };
}
