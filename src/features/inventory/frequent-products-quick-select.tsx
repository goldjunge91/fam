import { useQuery } from '@tanstack/react-query';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { getDatabase } from '@/lib/db/client';
import {
  getFrequentProductUsage,
  type ProductUsageFeature,
  type ProductUsageRow,
} from '@/lib/db/product-usage';
import type { OpenFoodFactsProduct } from '@/lib/open-food-facts';
import { rankByName } from '@/lib/rank-by-name';

/**
 * Haeufig verwendete Produkte je Name, absteigend nach Haeufigkeit sortiert —
 * bei Gleichstand bleibt die juengste Fundstelle vorn, weil
 * `getFrequentProductUsage` bereits neueste zuerst liefert (stabile Sortierung).
 * Nutzt dasselbe `rankByName` wie `rankFrequentFoods` in
 * `calorie-tracking/food-history.ts`, hier fuer Vorrat/Einkaufsliste ohne
 * Mahlzeitart-Bezug.
 */
function rankByFrequency(rowsNewestFirst: ProductUsageRow[]): ProductUsageRow[] {
  return rankByName(rowsNewestFirst, { caseInsensitive: true });
}

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
  };
}

const MAX_CHIPS = 8;

interface FrequentProductsQuickSelectProps {
  feature: ProductUsageFeature;
  userId: string | undefined;
  onSelectProduct: (product: OpenFoodFactsProduct) => void;
}

/**
 * Quick-Select ("haeufig verwendete Lebensmittel", #79) fuer Vorrat und
 * Einkaufsliste — liest ausschliesslich lokales SQLite, funktioniert also
 * ohne Netz. `onSelectProduct` ruft dieselbe Auswahl-Pipeline wie
 * `ProductSearchDropdown`, keine zweite Implementierung.
 */
export function FrequentProductsQuickSelect({
  feature,
  userId,
  onSelectProduct,
}: FrequentProductsQuickSelectProps) {
  const theme = useTheme();

  const { data: rows = [] } = useQuery({
    queryKey: ['product_usage', 'frequent', feature, userId],
    queryFn: async () => {
      const db = await getDatabase();
      return getFrequentProductUsage(db, { userId: userId as string, feature });
    },
    enabled: !!userId,
  });

  const ranked = rankByFrequency(rows).slice(0, MAX_CHIPS);
  if (ranked.length === 0) return null;

  return (
    <View style={styles.container}>
      <ThemedText type="small" themeColor="textSecondary" style={styles.label}>
        Häufig verwendet
      </ThemedText>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.row}>
        {ranked.map((row) => (
          <Pressable
            key={row.name.toLowerCase()}
            onPress={() => onSelectProduct(toOpenFoodFactsProduct(row))}
            style={[
              styles.chip,
              { backgroundColor: theme.backgroundElement, borderColor: theme.border },
            ]}>
            <ThemedText type="small" numberOfLines={1}>
              {row.name}
            </ThemedText>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.one,
  },
  label: {
    marginLeft: 2,
  },
  row: {
    flexDirection: 'row',
  },
  chip: {
    borderRadius: Radius.card,
    borderWidth: 1,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
    marginRight: Spacing.one,
    maxWidth: 160,
  },
});
