import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatEuro } from '@/lib/format-currency';

interface TotalEstimateCardProps {
  totalEstimate: number;
  itemCount: number;
  storeCount: number;
}

/** Abschluss-Karte unter den Markt-Karten: Gesamtsumme aller Maerkte. */
export function TotalEstimateCard({
  totalEstimate,
  itemCount,
  storeCount,
}: TotalEstimateCardProps) {
  const theme = useTheme();

  return (
    <View style={[styles.card, { backgroundColor: `${theme.accent}14` }]}>
      <ThemedText type="smallBold" style={{ color: theme.accent }}>
        Gesamtschätzung
      </ThemedText>
      <ThemedText type="title">{formatEuro(totalEstimate)}</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        {itemCount} Artikel in {storeCount} {storeCount === 1 ? 'Geschäft' : 'Geschäften'}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    // Gleicher Radius wie components/card.tsx — beides "surface-elevated"-Flaechen.
    borderRadius: Radius.large,
    padding: Spacing.four,
    alignItems: 'center',
    gap: Spacing.half,
  },
});
