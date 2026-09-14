import { useTranslation } from 'react-i18next';
import { StyleSheet } from 'react-native-unistyles';

import { withAlpha } from '@/components/theme/index';
import { Card, Txt } from '@/constants/ui';
import { formatEuro } from '@/lib/format-currency';

interface TotalEstimateCardProps {
  totalEstimate: number;
  itemCount: number;
  storeCount: number;
}

const styles = StyleSheet.create((theme) => ({
  card: {
    alignItems: 'center',
    gap: theme.space.xs / 2,
    padding: theme.space.xl + theme.space.xs,
    borderRadius: theme.radius.famLarge,
    borderWidth: 0,
    backgroundColor: withAlpha(theme.accent, 0.1),
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
    <Card padded={false} elevation="none" style={styles.card}>
      <Txt variant="body" tone="primary" weight="600">
        {t('shoppingList.totalEstimateCard.title')}
      </Txt>
      <Txt variant="title">{formatEuro(totalEstimate)}</Txt>
      <Txt variant="body" tone="secondary">
        {t('shoppingList.totalEstimateCard.summary', { items: itemCount, count: storeCount })}
      </Txt>
    </Card>
  );
}
