import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { space } from '@/components/theme/index';
export function useSheetShadowStyle() {
  const insets = useSafeAreaInsets();

  return [
    {
      paddingBottom: Math.max(insets.bottom, space.lg),
      borderCurve: 'continuous' as const,
    },
  ];
}
