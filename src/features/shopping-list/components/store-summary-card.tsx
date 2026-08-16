import { Pressable, StyleSheet, View } from 'react-native';

import { ProgressBar } from '@/components/progress-bar';
import { FontSize, ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
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
 * Karte fuer die "Alle Listen"-Uebersicht: farbiger linker Streifen, Name,
 * Fortschritt und geschaetzte Summe (#150, Figma "02.01 · Einkauf —
 * Märkte"). `onPress` wechselt in die Detailansicht des Marktes.
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

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${name}, ${checkedCount} von ${totalCount} Artikeln, ${formatEuro(totalEstimate)} geschätzt`}
      style={[styles.card, { backgroundColor: theme.backgroundElement }]}>
      <View style={[styles.stripe, { backgroundColor: color }]} />

      <View style={styles.info}>
        <ThemedText type="smallBold">{name}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {checkedCount} von {totalCount} Artikeln erledigt
        </ThemedText>
        <View style={styles.progressWrap}>
          <ProgressBar value={progress} color={color} />
        </View>
      </View>

      <View style={styles.priceBlock}>
        <ThemedText type="smallBold">{formatEuro(totalEstimate)}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          geschätzt
        </ThemedText>
      </View>

      <ThemedText themeColor="textSecondary" style={styles.chevron}>
        ›
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    // Gleicher Radius wie components/card.tsx — beides "surface-elevated"-Flaechen.
    borderRadius: Radius.large,
    paddingVertical: Spacing.three,
    paddingLeft: Spacing.two,
    paddingRight: Spacing.three,
    overflow: 'hidden',
  },
  stripe: {
    width: 5,
    alignSelf: 'stretch',
    borderRadius: Radius.hairline,
  },
  info: {
    flex: 1,
    gap: 4,
  },
  progressWrap: {
    marginTop: 5,
  },
  priceBlock: {
    alignItems: 'flex-end',
    gap: 2,
  },
  chevron: {
    ...FontSize[20],
  },
});
