import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Spacing } from '@/constants/layout';
import { withAlpha } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export function useSheetShadowStyle() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  return {
    paddingBottom: Math.max(insets.bottom, Spacing.three),
    boxShadow: `0 -16px 48px ${withAlpha(theme.shadowSheet, 0.2)}`,
    borderCurve: 'continuous' as const,
  };
}
