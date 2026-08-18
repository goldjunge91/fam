import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Spacing } from '@/constants/layout';
import { withAlpha } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * Gemeinsamer Schatten-/Innenabstands-Style fuer randlose Bottom-Sheets:
 * Padding bis mindestens zur Safe-Area, weicher Schlagschatten nach oben,
 * durchgehende Eckenkruemmung. Vorher unabhaengig in den Inventar-Sheets
 * dupliziert (#162) — die Flaeche selbst (Karte vs. randloses Sheet) bleibt
 * bewusst Sache des Aufrufers, die sieht in beiden Sheets unterschiedlich aus.
 */
export function useSheetShadowStyle() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  return {
    paddingBottom: Math.max(insets.bottom, Spacing.three),
    boxShadow: `0 -16px 48px ${withAlpha(theme.shadowSheet, 0.2)}`,
    borderCurve: 'continuous' as const,
  };
}
