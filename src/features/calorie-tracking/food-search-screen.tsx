import { router, useLocalSearchParams } from 'expo-router';
import { Pressable } from 'react-native';
import { Screen } from '@/components/layout/screen';
import { ThemedText } from '@/components/theme/themed-text';
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
      <Pressable onPress={() => goToDetail({})} className="fss-quick-entry-btn">
        <ThemedText className="text-[18px]">🍽️</ThemedText>
        <ThemedText type="smallBold">Schneller Eintrag</ThemedText>
      </Pressable>
    </Screen>
  );
}
