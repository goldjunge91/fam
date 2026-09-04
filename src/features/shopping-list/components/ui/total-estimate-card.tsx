import { View } from 'react-native';

import { Txt } from '@/constants/ui';
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
      <Txt variant="body" tone="primary" weight="600">
        Gesamtschätzung
      </Txt>
      <Txt variant="title">{formatEuro(totalEstimate)}</Txt>
      <Txt variant="body" tone="secondary">
        {itemCount} Artikel in {storeCount} {storeCount === 1 ? 'Geschäft' : 'Geschäften'}
      </Txt>
    </View>
  );
}
