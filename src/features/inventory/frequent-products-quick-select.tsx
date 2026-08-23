import { useQuery } from '@tanstack/react-query';
import { Pressable, ScrollView } from 'react-native';

import { ThemedText } from '@/components/theme/themed-text';
import { getDatabase } from '@/lib/db/client';
import {
  getFrequentProductUsage,
  type ProductUsageFeature,
  type ProductUsageRow,
} from '@/lib/db/product-usage';
import type { OpenFoodFactsProduct } from '@/lib/open-food-facts';

export type SuggestionMode = 'frequent' | 'recent';

function toOpenFoodFactsProduct(row: ProductUsageRow): OpenFoodFactsProduct {
  return {
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
  onSelectProduct: (product: OpenFoodFactsProduct) => void;
}

/**
 * Vorschlags-Chips fuer Vorrat und Einkaufsliste (#79), gesteuert ueber den
 * `mode`-Filter-Dropdown des Aufrufers ("Haeufig"/"Zuletzt", s.
 * add-item-screen.tsx). `getFrequentProductUsage` liefert bereits eine je
 * Name deduplizierte, passend sortierte Liste direkt aus SQL — eine
 * zusaetzliche Client-seitige Neusortierung (frueher `rankByName`) wuerde
 * bei `mode: 'recent'` die Reihenfolge nur wieder kaputt machen, deshalb
 * reicht hier ein reines Durchreichen + Slice.
 */
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
          <ThemedText type="small" numberOfLines={1}>
            {row.name}
          </ThemedText>
        </Pressable>
      ))}
    </ScrollView>
  );
}
