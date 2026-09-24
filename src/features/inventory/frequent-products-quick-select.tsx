import { useQuery } from '@tanstack/react-query';
import { ScrollView } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import { Press, Txt } from '@/constants/ui';
import type { CatalogProduct } from '@/features/product-search/types';
import { getDatabase } from '@/lib/db/local-client';
import {
  getFrequentProductUsage,
  type ProductUsageFeature,
  type ProductUsageRow,
} from '@/lib/db/product-usage';

export type SuggestionMode = 'frequent' | 'recent';

function toOpenFoodFactsProduct(row: ProductUsageRow): CatalogProduct {
  return {
    productId: row.product_id ?? undefined,
    barcode: row.barcode ?? '',
    name: row.name,
    brand: row.brand ?? undefined,
    quantity: row.quantity ?? undefined,
    unit: row.unit ?? undefined,
    caloriesPer100g: row.kcal ?? undefined,
    proteinsPer100g: row.protein_g ?? undefined,
    carbsPer100g: row.carbs_g ?? undefined,
    fatPer100g: row.fat_g ?? undefined,
    // product_usage ist reine Nutzungshistorie (#79), fuehrt keine OFF-Tags mit.
    categoryTags: [],
  };
}

const MAX_CHIPS = 8;

const styles = StyleSheet.create((theme) => ({
  scroll: {
    flexDirection: 'row',
  },
  chip: {
    minHeight: theme.space.xxl + theme.space.md + theme.space.xs,
    maxWidth: 160,
    marginRight: theme.space.xs,
    paddingHorizontal: theme.space.sm,
    paddingVertical: theme.space.xs,
    borderRadius: theme.radius.md,
    borderWidth: theme.borderWidth.base,
    borderColor: theme.border,
    backgroundColor: theme.backgroundElement,
  },
}));

interface FrequentProductsQuickSelectProps {
  feature: ProductUsageFeature;
  userId: string | undefined;
  mode: SuggestionMode;
  onSelectProduct: (product: CatalogProduct) => void;
}

export function FrequentProductsQuickSelect({
  feature,
  userId,
  mode,
  onSelectProduct,
}: FrequentProductsQuickSelectProps) {
  const { data: rows = [] } = useQuery({
    queryKey: ['product_usage', mode, feature, userId],
    queryFn: async () => {
      const db = await getDatabase();
      return getFrequentProductUsage(db, { userId: userId as string, feature, mode });
    },
    enabled: !!userId,
    // Die Datenbank ist die lokale Quelle der Wahrheit. Nach einem Save kann
    // diese Komponente mit einem zuvor leeren Query-Ergebnis erneut erscheinen.
    refetchOnMount: 'always',
  });

  const chips = rows.slice(0, MAX_CHIPS);
  if (chips.length === 0) return null;

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.scroll}>
      {chips.map((row) => (
        <Press
          key={row.name.toLowerCase()}
          haptic="selection"
          onPress={() => onSelectProduct(toOpenFoodFactsProduct(row))}
          role="button"
          aria-label={row.name}
          style={styles.chip}>
          <Txt variant="body" numberOfLines={1}>
            {row.name}
          </Txt>
        </Press>
      ))}
    </ScrollView>
  );
}
