import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation();

  return (
    <View className="total-estimate-card">
      <Txt variant="body" tone="primary" weight="600">
        {t('shoppingList.totalEstimateCard.title')}
      </Txt>
      <Txt variant="title">{formatEuro(totalEstimate)}</Txt>
      <Txt variant="body" tone="secondary">
        {t('shoppingList.totalEstimateCard.summary', { items: itemCount, count: storeCount })}
      </Txt>
    </View>
  );
}
