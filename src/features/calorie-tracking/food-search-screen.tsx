import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Image, Pressable, View } from 'react-native';
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
import { useLocalFoodUsage } from '@/features/calorie-tracking/use-local-food-usage';
import { BarcodeScannerModal } from '@/features/inventory/barcode-scanner-modal';
import { useTheme } from '@/hooks/use-theme';
import {
  dedupeProductsByBarcode,
  fetchProductByBarcodeFromDump,
  searchOffDump,
} from '@/lib/off-dump/off-dump';
import {
  fetchProductByBarcode,
  isLikelyBarcode,
  type OpenFoodFactsProduct,
  productToRouteParams,
  searchOpenFoodFacts,
} from '@/lib/open-food-facts';

const MEAL_LABELS: Record<string, string> = {
  breakfast: 'Frühstück',
  lunch: 'Mittagessen',
  dinner: 'Abendessen',
  snack: 'Snacks',
};

const PAGE_SIZE = 20;

type HistoryTab = 'recent' | 'frequent';

/** Sucht paginiert per Freitext, Barcode oder lokalem Verlauf. */
export function FoodSearchScreen() {
  const theme = useTheme();
  const { session } = useSession();
  const userId = session?.user.id;
  const params = useLocalSearchParams<{ date: string; mealType: string }>();

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<OpenFoodFactsProduct[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [searching, setSearching] = useState(false);
  const [searchFailed, setSearchFailed] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [historyTab, setHistoryTab] = useState<HistoryTab>('recent');
  const [source, setSource] = useState<ItemSource>('food');
  const [showScanner, setShowScanner] = useState(false);

  // Verhindert, dass alte Seiten eine neue Suche ueberschreiben.
  const queryRef = useRef(query);
  queryRef.current = query;

  const { data: history = [], isLoading: historyLoading } = useLocalFoodUsage(
    userId,
    params.mealType as MealType,
  );

  /** Liefert lokale Treffer zuerst und ergaenzt sie aus dem Netz. */
  async function runSearch(trimmedQuery: string, signal: AbortSignal) {
    setSearching(true);
    setSearchFailed(false);

    if (isLikelyBarcode(trimmedQuery)) {
      const localProduct = await fetchProductByBarcodeFromDump(trimmedQuery);
      if (localProduct && !signal.aborted) {
        setResults([localProduct]);
        setHasMore(false);
        setPage(1);
        setSearching(false);
        return;
      }

      const product = await fetchProductByBarcode(trimmedQuery, signal);
      if (!signal.aborted) {
        setResults(product ? [product] : []);
        setHasMore(false);
        setPage(1);
        setSearching(false);
      }
      return;
    }

    const localResult = await searchOffDump(trimmedQuery, { limit: PAGE_SIZE });
    if (!signal.aborted && localResult.products.length > 0) {
      setResults(localResult.products);
      setHasMore(localResult.hasMore);
    }

    const result = await searchOpenFoodFacts(trimmedQuery, {
      page: 1,
      pageSize: PAGE_SIZE,
      signal,
    });
    if (!signal.aborted) {
      const merged = dedupeProductsByBarcode([...localResult.products, ...result.products]);
      setResults(merged);
      setHasMore(localResult.hasMore || result.hasMore);
      setSearchFailed(result.failed && merged.length === 0);
      setPage(1);
      setSearching(false);
    }
  }

  // biome-ignore lint/correctness/useExhaustiveDependencies: runSearch nutzt nur stabile Setter und Parameter.
  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      setSearching(false);
      setSearchFailed(false);
      setHasMore(false);
      setPage(1);
      return;
    }

    // 800 ms respektiert das OFF-Limit von zehn Suchen pro Minute und IP.
    const controller = new AbortController();
    const trimmedQuery = query.trim();
    const timer = setTimeout(() => runSearch(trimmedQuery, controller.signal), 800);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  function retrySearch() {
    const trimmedQuery = query.trim();
    if (trimmedQuery.length < 2) return;
    runSearch(trimmedQuery, new AbortController().signal);
  }

  async function loadMoreResults() {
    if (!hasMore || loadingMore || searching) return;
    const currentQuery = query;
    const nextPage = page + 1;
    const offset = page * PAGE_SIZE;
    setLoadingMore(true);

    const [localResult, remoteResult] = await Promise.all([
      searchOffDump(currentQuery, { offset, limit: PAGE_SIZE }),
      searchOpenFoodFacts(currentQuery, { page: nextPage, pageSize: PAGE_SIZE }),
    ]);

    if (queryRef.current === currentQuery) {
      const newItems = dedupeProductsByBarcode([...localResult.products, ...remoteResult.products]);
      setResults((prev) => dedupeProductsByBarcode([...prev, ...newItems]));
      setHasMore(localResult.hasMore || remoteResult.hasMore);
      setPage(nextPage);
    }
    setLoadingMore(false);
  }

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

  const isSearchMode = query.trim().length >= 2;
  const historyList =
    historyTab === 'recent' ? dedupeRecentFoods(history) : rankFrequentFoods(history);

  return (
    <Screen
      title={MEAL_LABELS[params.mealType] ?? 'Lebensmittel'}
      back={{ label: 'Abbrechen' }}
      scroll={false}>
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

      <Pressable onPress={selectManualEntry} className="fss-quick-entry-btn">
        <ThemedText className="text-[18px]">🍽️</ThemedText>
        <ThemedText type="smallBold">Schneller Eintrag</ThemedText>
      </Pressable>

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
