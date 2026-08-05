import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type MacroBarProps = {
  label: string;
  /** Aufgenommene Menge in Gramm. */
  value: number;
  /** Zielmenge in Gramm. 0 bedeutet "kein Ziel gesetzt". */
  target: number;
};

/**
 * Fortschrittsbalken je Makronaehrstoff (#92).
 *
 * Ist- und Zielwert stehen immer als Text daneben. Der Balken allein waere fuer
 * Farbfehlsichtige und Screenreader wertlos.
 */
export function MacroBar({ label, value, target }: MacroBarProps) {
  const theme = useTheme();

  const ratio = target > 0 ? Math.min(value / target, 1) : 0;
  const exceeded = target > 0 && value > target;

  return (
    <View
      style={styles.row}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={
        target > 0
          ? `${label}: ${Math.round(value)} von ${Math.round(target)} Gramm`
          : `${label}: ${Math.round(value)} Gramm, kein Ziel gesetzt`
      }>
      <View style={styles.labelRow}>
        <ThemedText type="small">{label}</ThemedText>
        <ThemedText type="small" themeColor={exceeded ? 'warning' : 'textSecondary'}>
          {Math.round(value)} / {target > 0 ? Math.round(target) : '–'} g
        </ThemedText>
      </View>

      <View style={[styles.track, { backgroundColor: theme.backgroundSelected }]}>
        <View
          style={[
            styles.fill,
            {
              width: `${ratio * 100}%`,
              backgroundColor: exceeded ? theme.warning : theme.accent,
            },
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    gap: Spacing.one,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  track: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 4,
  },
});
