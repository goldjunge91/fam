import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, View } from 'react-native';
import { TextField } from '@/components/forms/text-field';
import { Screen } from '@/components/layout/screen';
import { ThemedText } from '@/components/theme/themed-text';
import { type ItemSource, ItemSourceFilterRow } from '@/components/ui/item-source-filter';
import { useSession } from '@/features/auth/session-provider';
import type { MealType } from '@/features/calorie-tracking/api';
import {
  dedupeRecentFoods,
  type FoodHistoryEntry,
  rankFrequentFoods,
} from '@/features/calorie-tracking/food-history';
import { useFoodSearch } from '@/features/calorie-tracking/hooks/use-food-search';
import { useLocalFoodUsage } from '@/features/calorie-tracking/use-local-food-usage';
import { useOptionalActiveHousehold } from '@/features/household/active-household-provider';
import { BarcodeScannerModal } from '@/features/inventory/barcode-scanner-modal';
import { usePreferredProductMarketName } from '@/features/product-search/preferred-market';
import { useTheme } from '@/hooks/use-theme';
import { type OpenFoodFactsProduct, productToRouteParams } from '@/lib/open-food-facts';

const MEAL_LABELS: Record<string, string> = {
  breakfast: 'Frühstück',
  lunch: 'Mittagessen',
  dinner: 'Abendessen',
  snack: 'Snacks',
};

type HistoryTab = 'recent' | 'frequent';

export function FoodSearchScreen() {
  const theme = useTheme();
  const { session } = useSession();
  const userId = session?.user.id;
  const activeHousehold = useOptionalActiveHousehold();
  const preferredMarket = usePreferredProductMarketName(
    activeHousehold?.activeHouseholdId ?? undefined,
  );
  const params = useLocalSearchParams<{ date: string; mealType: string }>();

  const {
    query,
    setQuery,
    isSearchMode,
    results,
    searching,
    searchFailed,
    loadingMore,
    retrySearch,
    loadMoreResults,
  } = useFoodSearch(preferredMarket);
  const [historyTab, setHistoryTab] = useState<HistoryTab>('recent');
  const [source, setSource] = useState<ItemSource>('food');
  const [showScanner, setShowScanner] = useState(false);

  const { data: history = [], isLoading: historyLoading } = useLocalFoodUsage(
    userId,
    params.mealType as MealType,
  );

  function goToDetail(extraParams: Record<string, string>) {
    router.push({
      pathname: '/add-food-entry',
      params: { date: params.date, mealType: params.mealType, ...extraParams },
    });
  }

  function selectProduct(product: OpenFoodFactsProduct) {
    goToDetail(productToRouteParams(product));
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

  function selectManualEntry() {
    goToDetail({});
  }

  const historyList =
    historyTab === 'recent' ? dedupeRecentFoods(history) : rankFrequentFoods(history);

  return (
    <Screen
      title={MEAL_LABELS[params.mealType] ?? 'Lebensmittel'}
      back={{ label: 'Abbrechen' }}
      scroll={false}>
      {/* Suchkopf: Textsuche, Barcode-Scanner-Button und Verlaufsfilter */}
      <View className="fss-header">
        <View className="fss-search-row">
          <View className="flex-1">
            <TextField
              placeholder="Wonach suchst du?"
              value={query}
              onChangeText={setQuery}
              autoFocus
            />
          </View>
          <Pressable
            onPress={() => setShowScanner(true)}
            accessibilityRole="button"
            accessibilityLabel="Barcode scannen"
            className="fss-scan-btn">
            <ThemedText className="text-[20px]">📷</ThemedText>
          </Pressable>
        </View>

        {/* Quell- und Verlaufs-Filterleiste (Zuletzt vs. Häufig) */}
        {!isSearchMode ? (
          <ItemSourceFilterRow
            source={source}
            onSourceChange={setSource}
            sourceAccessibilityLabel="Quelle: Lebensmittel oder Gerichte"
            suggestionFilter={historyTab}
            onSuggestionFilterChange={setHistoryTab}
            suggestionAccessibilityLabel="Verlaufsfilter"
          />
        ) : null}
      </View>

      {/* Ergebnisliste: Entweder Live-Suchergebnisse (OFF/Lokal) oder Verlauf */}
      {isSearchMode ? (
        searching ? (
          <ActivityIndicator color={theme.accent} className="fss-center-loader" />
        ) : results.length === 0 && searchFailed ? (
          <View className="fss-failed-box">
            <ThemedText type="small" themeColor="warning" className="text-center">
              Open Food Facts ist gerade nicht erreichbar. Versuch's gleich nochmal.
            </ThemedText>
            <Pressable onPress={retrySearch} accessibilityRole="button">
              <ThemedText type="smallBold" themeColor="accent">
                Erneut versuchen
              </ThemedText>
            </Pressable>
          </View>
        ) : results.length === 0 ? (
          <ThemedText type="small" themeColor="textSecondary" className="fss-centered">
            Keine Treffer für „{query}".
          </ThemedText>
        ) : (
          <FlatList
            className="flex-1"
            data={results}
            keyExtractor={(item, index) => item.barcode || `${item.name}-${index}`}
            renderItem={({ item }) => (
              <ProductRow product={item} onPress={() => selectProduct(item)} />
            )}
            onEndReached={loadMoreResults}
            onEndReachedThreshold={0.5}
            keyboardShouldPersistTaps="handled"
            ListFooterComponent={
              loadingMore ? (
                <ActivityIndicator color={theme.accent} className="fss-footer-loader" />
              ) : null
            }
          />
        )
      ) : historyLoading ? (
        <ActivityIndicator color={theme.accent} className="fss-center-loader" />
      ) : historyList.length === 0 ? (
        <ThemedText type="small" themeColor="textSecondary" className="fss-centered">
          Noch keine Einträge — fang mit der Suche oder „Schneller Eintrag" an.
        </ThemedText>
      ) : (
        <FlatList
          className="flex-1"
          data={historyList}
          keyExtractor={(item) => item.name}
          renderItem={({ item }) => (
            <HistoryRow entry={item} onPress={() => selectHistoryEntry(item)} />
          )}
          keyboardShouldPersistTaps="handled"
        />
      )}

      {/* Button für Schnelleintrag (manuelle Eingabe ohne Produktsuche) */}
      <Pressable onPress={selectManualEntry} className="fss-quick-entry-btn">
        <ThemedText className="text-[18px]">🍽️</ThemedText>
        <ThemedText type="smallBold">Schneller Eintrag</ThemedText>
      </Pressable>

      {/* Modal für Kamera-Barcode-Scanner */}
      <BarcodeScannerModal
        visible={showScanner}
        onClose={() => setShowScanner(false)}
        onProductFound={(product) => selectProduct(product)}
      />
    </Screen>
  );
}

function ProductRow({ product, onPress }: { product: OpenFoodFactsProduct; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} className="fss-row">
      {product.imageUrl ? (
        <Image source={{ uri: product.imageUrl }} className="fss-row-img" />
      ) : (
        <View className="fss-row-img-placeholder">
          <ThemedText className="text-[16px]">🥫</ThemedText>
        </View>
      )}
      <View className="fss-row-text">
        <ThemedText type="smallBold" numberOfLines={1}>
          {product.name}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
          {product.brand ? `${product.brand} · ` : ''}
          {product.caloriesPer100g !== undefined
            ? `${Math.round(product.caloriesPer100g)} kcal/100g`
            : ''}
        </ThemedText>
      </View>
    </Pressable>
  );
}

function HistoryRow({ entry, onPress }: { entry: FoodHistoryEntry; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} className="fss-row">
      <View className="fss-row-img-placeholder">
        <ThemedText className="text-[16px]">🥫</ThemedText>
      </View>
      <View className="fss-row-text">
        <ThemedText type="smallBold" numberOfLines={1}>
          {entry.name}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
          {entry.quantity} {entry.unit}
          {entry.kcal !== null ? ` · ${Math.round(entry.kcal)} kcal` : ''}
        </ThemedText>
      </View>
    </Pressable>
  );
}
