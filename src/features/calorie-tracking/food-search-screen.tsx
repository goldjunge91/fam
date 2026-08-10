import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, View } from 'react-native';

import { Screen } from '@/components/screen';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useSession } from '@/features/auth/session-provider';
import { useFoodHistory } from '@/features/calorie-tracking/api';
import {
  dedupeRecentFoods,
  type FoodHistoryEntry,
  rankFrequentFoods,
} from '@/features/calorie-tracking/food-history';
import { BarcodeScannerModal } from '@/features/inventory/barcode-scanner-modal';
import { useTheme } from '@/hooks/use-theme';
import {
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

type HistoryTab = 'recent' | 'frequent';

/**
 * Lebensmittelsuche vor der eigentlichen Erfassung — Freitextsuche (Open Food
 * Facts), Barcode-Scan, oder ein Griff auf zuletzt/häufig geloggte
 * Lebensmittel. Ergebnis geht als Router-Params an `/add-food-entry` weiter,
 * dort passiert die eigentliche Mengenauswahl und das Speichern.
 */
export function FoodSearchScreen() {
  const theme = useTheme();
  const { session } = useSession();
  const userId = session?.user.id;
  const params = useLocalSearchParams<{ date: string; mealType: string }>();

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<OpenFoodFactsProduct[]>([]);
  const [searching, setSearching] = useState(false);
  const [historyTab, setHistoryTab] = useState<HistoryTab>('recent');
  const [showScanner, setShowScanner] = useState(false);

  const { data: historyRaw = [], isLoading: historyLoading } = useFoodHistory(userId);

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      setSearching(false);
      return;
    }

    const timer = setTimeout(async () => {
      setSearching(true);
      const found = await searchOpenFoodFacts(query);
      setResults(found);
      setSearching(false);
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

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

  const history: FoodHistoryEntry[] = historyRaw.map((e) => ({
    name: e.name,
    kcal: e.kcal,
    proteinG: e.protein_g,
    carbsG: e.carbs_g,
    fatG: e.fat_g,
    quantity: e.quantity,
    unit: e.unit,
  }));

  const isSearchMode = query.trim().length >= 2;
  const historyList =
    historyTab === 'recent' ? dedupeRecentFoods(history) : rankFrequentFoods(history);

  return (
    <Screen title={MEAL_LABELS[params.mealType] ?? 'Lebensmittel'} back={{ label: 'Abbrechen' }}>
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
          <ThemedText style={{ fontSize: 20 }}>📷</ThemedText>
        </Pressable>
      </View>

      {isSearchMode ? (
        <View style={styles.list}>
          {searching ? (
            <ActivityIndicator color={theme.accent} style={{ marginTop: Spacing.four }} />
          ) : results.length === 0 ? (
            <ThemedText type="small" themeColor="textSecondary" style={styles.centered}>
              Keine Treffer für „{query}".
            </ThemedText>
          ) : (
            results.map((product) => (
              <ProductRow
                key={product.barcode || product.name}
                product={product}
                onPress={() => selectProduct(product)}
              />
            ))
          )}
        </View>
      ) : (
        <View style={styles.list}>
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

          {historyLoading ? (
            <ActivityIndicator color={theme.accent} style={{ marginTop: Spacing.four }} />
          ) : historyList.length === 0 ? (
            <ThemedText type="small" themeColor="textSecondary" style={styles.centered}>
              Noch keine Einträge — fang mit der Suche oder „Schneller Eintrag" an.
            </ThemedText>
          ) : (
            historyList
              .slice(0, 20)
              .map((entry) => (
                <HistoryRow
                  key={entry.name}
                  entry={entry}
                  onPress={() => selectHistoryEntry(entry)}
                />
              ))
          )}
        </View>
      )}

      <Pressable
        onPress={selectManualEntry}
        style={[styles.quickEntryBtn, { backgroundColor: theme.backgroundElement }]}>
        <ThemedText style={{ fontSize: 18 }}>🍽️</ThemedText>
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
          <ThemedText style={{ fontSize: 16 }}>🥫</ThemedText>
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
        <ThemedText style={{ fontSize: 16 }}>🥫</ThemedText>
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
  list: {
    gap: Spacing.one,
  },
  centered: {
    textAlign: 'center',
    marginTop: Spacing.four,
  },
  segmentedRow: {
    flexDirection: 'row',
    gap: Spacing.two,
    marginBottom: Spacing.two,
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
