import { View } from 'react-native';

import { ThemedText } from '@/components/theme/themed-text';
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
  return (
    <View className="total-estimate-card">
      <ThemedText type="smallSelected">Gesamtschätzung</ThemedText>
      <ThemedText type="title">{formatEuro(totalEstimate)}</ThemedText>
      <ThemedText type="smallMuted">
        {itemCount} Artikel in {storeCount} {storeCount === 1 ? 'Geschäft' : 'Geschäften'}
      </ThemedText>
    </View>
  );
}
