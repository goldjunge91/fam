import { useQuery } from '@tanstack/react-query';
import { Pressable, ScrollView } from 'react-native';

import { Txt } from '@/constants/ui';
import type { CatalogProduct } from '@/features/product-search/types';
import { getDatabase } from '@/lib/db/client';
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
    <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row">
      {chips.map((row) => (
        <Pressable
          key={row.name.toLowerCase()}
          onPress={() => onSelectProduct(toOpenFoodFactsProduct(row))}
          role="button"
          aria-label={row.name}
          className="frequent-products-chip">
          <Txt variant="body" numberOfLines={1}>
            {row.name}
          </Txt>
        </Pressable>
      ))}
    </ScrollView>
  );
}
