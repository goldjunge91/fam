import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatEuro } from '@/lib/format-currency';

interface StoreSummaryCardProps {
  name: string;
  color: string;
  totalCount: number;
  checkedCount: number;
  totalEstimate: number;
  onPress: () => void;
}

/**
 * Karte fuer die "Alle Listen"-Uebersicht: farbiges Avatar-Initial, Name,
 * Fortschritt und geschaetzte Summe. `onPress` wechselt in die
 * Detailansicht des Marktes.
 */
export function StoreSummaryCard({
  name,
  color,
  totalCount,
  checkedCount,
  totalEstimate,
  onPress,
}: StoreSummaryCardProps) {
  const theme = useTheme();
  const progress = totalCount > 0 ? checkedCount / totalCount : 0;
  const initial = name.charAt(0).toUpperCase();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${name}, ${checkedCount} von ${totalCount} Artikeln, ${formatEuro(totalEstimate)} geschätzt`}
      style={[styles.card, { backgroundColor: theme.backgroundElement }]}>
      <View style={styles.row}>
        <View style={[styles.avatar, { backgroundColor: color }]}>
          <ThemedText style={styles.avatarText}>{initial}</ThemedText>
        </View>
        <View style={styles.info}>
          <ThemedText type="smallBold">{name}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {checkedCount} von {totalCount} Artikeln
          </ThemedText>
        </View>
        <View style={styles.priceBlock}>
          <ThemedText type="smallBold">{formatEuro(totalEstimate)}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            geschätzt
          </ThemedText>
        </View>
      </View>

      <View style={[styles.progressTrack, { backgroundColor: theme.border }]}>
        <View
          style={[styles.progressFill, { width: `${progress * 100}%`, backgroundColor: color }]}
        />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Spacing.four,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: Spacing.two,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
  info: {
    flex: 1,
    gap: 2,
  },
  priceBlock: {
    alignItems: 'flex-end',
  },
  progressTrack: {
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
});
