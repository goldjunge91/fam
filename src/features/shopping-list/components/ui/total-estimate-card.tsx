import { useTranslation } from 'react-i18next';
import { StyleSheet } from 'react-native-unistyles';

import { Surface, Txt } from '@/constants/ui';
import { formatEuro } from '@/lib/format/format-currency';

interface TotalEstimateCardProps {
  totalEstimate: number;
  itemCount: number;
  storeCount: number;
}

const styles = StyleSheet.create((theme) => ({
  card: {
    alignItems: 'center',
    gap: theme.space.xs,
    padding: theme.space.xxl,
    borderRadius: theme.radius.famLarge,
    borderWidth: 0,
  },
}));

/** Abschluss-Karte unter den Markt-Karten: Gesamtsumme aller Maerkte. */
export function TotalEstimateCard({
  totalEstimate,
  itemCount,
  storeCount,
}: TotalEstimateCardProps) {
  const { t } = useTranslation();

  return (
    <Surface tone="accent" style={styles.card}>
      <Txt variant="body" tone="onAccent" weight="600">
        {t('shoppingList.totalEstimateCard.title')}
      </Txt>
      <Txt variant="title" tone="onAccent">
        {formatEuro(totalEstimate)}
      </Txt>
      <Txt variant="body" tone="onAccent">
        {t('shoppingList.totalEstimateCard.summary', { items: itemCount, count: storeCount })}
      </Txt>
    </Surface>
  );
}
