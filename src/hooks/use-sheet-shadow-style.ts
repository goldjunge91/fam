import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { space } from '@/components/theme/index';
import { uiShadowStyles } from '@/constants/ui-shadow';

export function useSheetShadowStyle() {
  const insets = useSafeAreaInsets();

  return [
    uiShadowStyles.bottomSheetTop,
    {
      paddingBottom: Math.max(insets.bottom, space.lg),
      borderCurve: 'continuous' as const,
    },
  ];
}
