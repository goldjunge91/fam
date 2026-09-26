import { router, useLocalSearchParams } from 'expo-router';
import { StyleSheet } from 'react-native-unistyles';
import { Screen } from '@/components/layout/screen';
import { radius } from '@/components/theme/index';
import { Press, Txt } from '@/constants/ui';
import type { MealType } from '@/features/calorie-tracking/api';
import type { FoodHistoryEntry } from '@/features/calorie-tracking/food-history';
import { FoodSearchDropdown } from '@/features/calorie-tracking/food-search-dropdown';
import { productToRouteParams } from '@/features/calorie-tracking/product-route-params';
import type { CatalogProduct } from '@/features/product-search/types';

const MEAL_LABELS: Record<string, string> = {
  breakfast: 'Frühstück',
  lunch: 'Mittagessen',
  dinner: 'Abendessen',
  snack: 'Snacks',
};

const styles = StyleSheet.create((theme) => ({
  quickEntryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.space.sm,
    paddingVertical: theme.space.lg,
    borderRadius: radius.md,
    marginTop: theme.space.lg,
    marginBottom: theme.space.xxl,
    backgroundColor: theme.backgroundElement,
  },
}));

/** Kompatibilitaetsroute fuer alte Deep Links; das Tagebuch nutzt direkt das Erfassungs-Modal. */
export function FoodSearchScreen() {
  const params = useLocalSearchParams<{ date: string; mealType: MealType }>();

  function goToDetail(extraParams: Record<string, string>) {
    router.push({
      pathname: '/add-food-entry',
      params: { date: params.date, mealType: params.mealType, ...extraParams },
    });
  }

  function selectProduct(product: CatalogProduct) {
    goToDetail({ productData: JSON.stringify(productToRouteParams(product)) });
  }

  function selectHistoryEntry(entry: FoodHistoryEntry) {
    goToDetail({
      name: entry.name,
      quantity: String(entry.quantity),
      unit: entry.unit,
      kcal: entry.kcal !== null ? String(entry.kcal) : '',
      proteinG: entry.proteinG !== null ? String(entry.proteinG) : '',
      carbsG: entry.carbsG !== null ? String(entry.carbsG) : '',
      fatG: entry.fatG !== null ? String(entry.fatG) : '',
    });
  }

  return (
    <Screen
      title={MEAL_LABELS[params.mealType] ?? 'Lebensmittel'}
      back={{ label: 'Abbrechen' }}
      scroll={false}>
      <FoodSearchDropdown
        mealType={params.mealType}
        onProductSelect={selectProduct}
        onHistorySelect={selectHistoryEntry}
      />
      <Press
        onPress={() => goToDetail({})}
        accessibilityRole="button"
        style={styles.quickEntryButton}>
        <Txt variant="glyph" tone="primary">
          🍽️
        </Txt>
        <Txt variant="body" weight="700">
          Schneller Eintrag
        </Txt>
      </Press>
    </Screen>
  );
}
