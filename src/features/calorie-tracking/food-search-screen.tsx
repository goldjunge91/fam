import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Image, Pressable, StyleSheet, View } from 'react-native';

import { Screen } from '@/components/screen';
import { TextField } from '@/components/text-field';
import { FontSize, ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
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

/**
 * Lebensmittelsuche vor der eigentlichen Erfassung — Freitextsuche (Open Food
 * Facts), Barcode-Scan, oder ein Griff auf zuletzt/häufig geloggte
 * Lebensmittel. Ergebnis geht als Router-Params an `/add-food-entry` weiter,
 * dort passiert die eigentliche Mengenauswahl und das Speichern.
 *
 * Suchergebnisse laden seitenweise nach (#Performance-Feedback: ein Begriff
 * wie "Haferflocken" hat hunderte Treffer bei Open Food Facts — alles auf
 * einmal laden waere langsam, ein hartes Limit wuerde brauchbare Treffer
 * verstecken). `FlatList` + `onEndReached` statt der vorherigen einfachen
 * Liste, damit Scrollen tatsaechlich weitere Seiten nachlaedt.
 */
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
  const [showScanner, setShowScanner] = useState(false);

  // Schuetzt vor veralteten "naechste Seite"-Antworten, wenn die Suche sich
  // waehrend des Nachladens schon geaendert hat.
  const queryRef = useRef(query);
  queryRef.current = query;

  const { data: history = [], isLoading: historyLoading } = useLocalFoodUsage(
    userId,
    params.mealType as MealType,
  );

  /**
   * Abgetippter Barcode statt Produktname: exakter Lookup statt unscharfer
   * Textsuche — deckt den Fall ab, fuer den es vorher ein separates
   * manuelles Eingabefeld im Scanner-Modal gab.
   *
   * `failed` (siehe `OpenFoodFactsSearchResult`) haelt "keine Treffer" von
   * "Open Food Facts kurz nicht erreichbar" auseinander — deren Such-
   * Endpunkte antworten aktuell auffaellig oft mit einem 503, auch bei
   * identischen Anfragen kurz hintereinander. Ohne die Unterscheidung sieht
   * ein Nutzer bei "hafer" oder "toma" faelschlich "keine Treffer".
   */
  async function runSearch(trimmedQuery: string, signal: AbortSignal) {
    setSearching(true);
    setSearchFailed(false);

    if (isLikelyBarcode(trimmedQuery)) {
      const product = await fetchProductByBarcode(trimmedQuery, signal);
      if (!signal.aborted) {
        setResults(product ? [product] : []);
        setHasMore(false);
        setPage(1);
        setSearching(false);
      }
      return;
    }

    const result = await searchOpenFoodFacts(trimmedQuery, {
      page: 1,
      pageSize: PAGE_SIZE,
      signal,
    });
    if (!signal.aborted) {
      setResults(result.products);
      setHasMore(result.hasMore);
      setSearchFailed(result.failed);
      setPage(1);
      setSearching(false);
    }
  }

  // `runSearch` bewusst nicht in den Deps: es liest ausschliesslich Setter
  // (stabil) und seine eigenen Parameter, kein sich aenderndes Closure-State.
  // biome-ignore lint/correctness/useExhaustiveDependencies: siehe oben.
  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      setSearching(false);
      setSearchFailed(false);
      setHasMore(false);
      setPage(1);
      return;
    }

    // Bricht eine noch laufende Anfrage ab, sobald eine neue Eingabe
    // ueberholt hat — ohne das wartet die UI teils auf eine Antwort, die
    // gleich verworfen wird, statt sofort die neue Suche zu zeigen.
    //
    // 800ms statt der ueblichen 300ms: Open Food Facts limitiert Suchen auf
    // 10/min/IP und untersagt Search-as-you-type ausdruecklich ("you would
    // be blocked very quickly") — ein kurzes Debounce waere hier ein
    // Verstoss gegen die dokumentierten Nutzungsregeln, kein Feinschliff.
    // `searchOpenFoodFacts` haelt zusaetzlich ein eigenes Anfragelimit ein.
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
    setLoadingMore(true);
    const result = await searchOpenFoodFacts(currentQuery, { page: nextPage, pageSize: PAGE_SIZE });
    if (queryRef.current === currentQuery) {
      setResults((prev) => [...prev, ...result.products]);
      setHasMore(result.hasMore);
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
      <View style={styles.header}>
        <View style={styles.searchRow}>
          <View style={styles.flex}>
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
            style={[styles.scanBtn, { backgroundColor: theme.backgroundElement }]}>
            <ThemedText style={{ ...FontSize[20] }}>📷</ThemedText>
          </Pressable>
        </View>

        {!isSearchMode ? (
          <View style={styles.segmentedRow}>
            <Pressable
              onPress={() => setHistoryTab('recent')}
              style={[
                styles.segmentBtn,
                {
                  backgroundColor: historyTab === 'recent' ? theme.accent : theme.backgroundElement,
                },
              ]}>
              <ThemedText style={{ color: historyTab === 'recent' ? '#fff' : theme.text }}>
                Zuletzt
              </ThemedText>
            </Pressable>
            <Pressable
              onPress={() => setHistoryTab('frequent')}
              style={[
                styles.segmentBtn,
                {
                  backgroundColor:
                    historyTab === 'frequent' ? theme.accent : theme.backgroundElement,
                },
              ]}>
              <ThemedText style={{ color: historyTab === 'frequent' ? '#fff' : theme.text }}>
                Häufig
              </ThemedText>
            </Pressable>
          </View>
        ) : null}
      </View>

      {isSearchMode ? (
        searching ? (
          <ActivityIndicator color={theme.accent} style={styles.centerLoader} />
        ) : results.length === 0 && searchFailed ? (
          <View style={styles.failedBox}>
            <ThemedText type="small" themeColor="warning" style={{ textAlign: 'center' }}>
              Open Food Facts ist gerade nicht erreichbar. Versuch's gleich nochmal.
            </ThemedText>
            <Pressable onPress={retrySearch} accessibilityRole="button">
              <ThemedText type="smallBold" themeColor="accent">
                Erneut versuchen
              </ThemedText>
            </Pressable>
          </View>
        ) : results.length === 0 ? (
          <ThemedText type="small" themeColor="textSecondary" style={styles.centered}>
            Keine Treffer für „{query}".
          </ThemedText>
        ) : (
          <FlatList
            style={styles.flex}
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
                <ActivityIndicator color={theme.accent} style={styles.footerLoader} />
              ) : null
            }
          />
        )
      ) : historyLoading ? (
        <ActivityIndicator color={theme.accent} style={styles.centerLoader} />
      ) : historyList.length === 0 ? (
        <ThemedText type="small" themeColor="textSecondary" style={styles.centered}>
          Noch keine Einträge — fang mit der Suche oder „Schneller Eintrag" an.
        </ThemedText>
      ) : (
        <FlatList
          style={styles.flex}
          data={historyList}
          keyExtractor={(item) => item.name}
          renderItem={({ item }) => (
            <HistoryRow entry={item} onPress={() => selectHistoryEntry(item)} />
          )}
          keyboardShouldPersistTaps="handled"
        />
      )}

      <Pressable
        onPress={selectManualEntry}
        style={[styles.quickEntryBtn, { backgroundColor: theme.backgroundElement }]}>
        <ThemedText style={{ ...FontSize[18] }}>🍽️</ThemedText>
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
  const theme = useTheme();
  return (
    <Pressable onPress={onPress} style={[styles.row, { borderBottomColor: theme.border }]}>
      {product.imageUrl ? (
        <Image source={{ uri: product.imageUrl }} style={styles.rowImg} />
      ) : (
        <View style={[styles.rowImgPlaceholder, { backgroundColor: theme.backgroundElement }]}>
          <ThemedText style={{ ...FontSize[16] }}>🥫</ThemedText>
        </View>
      )}
      <View style={styles.rowText}>
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
  const theme = useTheme();
  return (
    <Pressable onPress={onPress} style={[styles.row, { borderBottomColor: theme.border }]}>
      <View style={[styles.rowImgPlaceholder, { backgroundColor: theme.backgroundElement }]}>
        <ThemedText style={{ ...FontSize[16] }}>🥫</ThemedText>
      </View>
      <View style={styles.rowText}>
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

const styles = StyleSheet.create({
  header: {
    gap: Spacing.two,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  flex: {
    flex: 1,
  },
  scanBtn: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centered: {
    textAlign: 'center',
    marginTop: Spacing.four,
  },
  centerLoader: {
    marginTop: Spacing.four,
  },
  failedBox: {
    alignItems: 'center',
    gap: Spacing.two,
    marginTop: Spacing.four,
  },
  footerLoader: {
    marginVertical: Spacing.three,
  },
  segmentedRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.two,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowImg: {
    width: 36,
    height: 36,
    borderRadius: 8,
  },
  rowImgPlaceholder: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: {
    flex: 1,
    gap: 2,
  },
  quickEntryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.three,
    borderRadius: 14,
    marginTop: Spacing.three,
    marginBottom: Spacing.four,
  },
});
