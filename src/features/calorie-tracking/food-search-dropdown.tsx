import { Image } from 'expo-image';
import { useState } from 'react';
import { ActivityIndicator, Keyboard, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { borderWidth, font, radius, space } from '@/components/theme/index';
import { useTheme } from '@/components/theme/ThemeProvider';
import { type ItemSource, ItemSourceFilterRow } from '@/components/ui/item-source-filter';
import { Press, TextField, Txt } from '@/constants/ui';
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
import { useProductBarcodeLookup } from '@/features/product-search/hooks/use-product-barcode-lookup';
import { usePreferredProductMarketName } from '@/features/product-search/preferred-market';
import type { CatalogProduct } from '@/features/product-search/types';

type FoodSearchDropdownProps = {
  mealType: MealType;
  value?: string;
  onChangeText?: (text: string) => void;
  onProductSelect: (product: CatalogProduct) => void;
  onHistorySelect: (entry: FoodHistoryEntry) => void;
};

type HistoryTab = 'recent' | 'frequent';

const styles = StyleSheet.create((theme) => ({
  root: {
    gap: theme.space.sm,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: theme.space.sm,
  },
  flex: {
    flex: 1,
  },
  scanButton: {
    width: theme.controlSizes.touchTarget,
    // Keep the external scanner control exactly as high as TextField's
    // default input: line-height + vertical padding + both borders.
    height: font.lineHeights.body + space.xxl + borderWidth.strong * 2,
    minHeight: font.lineHeights.body + space.xxl + borderWidth.strong * 2,
    borderRadius: theme.radius.md,
    borderWidth: theme.borderWidth.strong,
    borderColor: theme.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.backgroundElement,
  },
  dropdown: {
    borderRadius: theme.radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.border,
    overflow: 'hidden',
  },
  centered: {
    marginTop: theme.space.xxl,
  },
  centerLoader: {
    marginTop: theme.space.xxl,
  },
  failedBox: {
    alignItems: 'center',
    gap: theme.space.sm,
    marginTop: theme.space.xxl,
  },
  moreButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.space.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.border,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space.sm,
    paddingVertical: theme.space.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.border,
  },
  rowImagePlaceholder: {
    width: theme.imageSizes.thumbnail,
    height: theme.imageSizes.thumbnail,
    borderRadius: radius.xs,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.backgroundElement,
  },
  rowText: {
    flex: 1,
    gap: space.xs,
  },
  productImage: {
    width: theme.imageSizes.thumbnail,
    height: theme.imageSizes.thumbnail,
    borderRadius: radius.sm,
  },
}));

/** Produktsuche und Verlauf als Inline-Dropdown fuer das Erfassungs-Modal. */
export function FoodSearchDropdown({
  mealType,
  value,
  onChangeText,
  onProductSelect,
  onHistorySelect,
}: FoodSearchDropdownProps) {
  const { colors } = useTheme();
  const { session } = useSession();
  const activeHousehold = useOptionalActiveHousehold();
  const preferredMarket = usePreferredProductMarketName(
    activeHousehold?.activeHouseholdId ?? undefined,
  );
  const [inputValue, setInputValue] = useState('');
  const [historyTab, setHistoryTab] = useState<HistoryTab>('recent');
  const [source, setSource] = useState<ItemSource>('food');
  const [showScanner, setShowScanner] = useState(false);
  const [showDropdown, setShowDropdown] = useState(true);

  const {
    query,
    setQuery,
    isSearchMode,
    results,
    searching,
    searchFailed,
    hasMore,
    loadingMore,
    retrySearch,
    loadMoreResults,
  } = useFoodSearch(preferredMarket);
  const { data: history = [], isLoading: historyLoading } = useLocalFoodUsage(
    session?.user.id,
    mealType,
  );

  const historyList =
    historyTab === 'recent' ? dedupeRecentFoods(history) : rankFrequentFoods(history);
  const displayedValue = value ?? inputValue;

  function changeSearchText(text: string) {
    if (value === undefined) setInputValue(text);
    onChangeText?.(text);
    setQuery(text);
    setShowDropdown(true);
  }

  function focusSearch() {
    setShowDropdown(true);
    if (displayedValue !== query) setQuery(displayedValue);
  }

  function selectProduct(product: CatalogProduct) {
    if (value === undefined) setInputValue(product.name);
    onChangeText?.(product.name);
    setShowDropdown(false);
    Keyboard.dismiss();
    onProductSelect(product);
  }

  const barcodeLookup = useProductBarcodeLookup({
    onFound: (product) => {
      setShowScanner(false);
      selectProduct(product);
    },
  });

  function closeScanner() {
    setShowScanner(false);
    barcodeLookup.reset();
  }

  function selectHistoryEntry(entry: FoodHistoryEntry) {
    if (value === undefined) setInputValue(entry.name);
    onChangeText?.(entry.name);
    setShowDropdown(false);
    Keyboard.dismiss();
    onHistorySelect(entry);
  }

  return (
    <View style={styles.root}>
      <View style={styles.searchRow}>
        <View style={styles.flex}>
          <TextField
            label="Lebensmittel suchen"
            placeholder="Wonach suchst du?"
            value={displayedValue}
            onFocus={focusSearch}
            onChangeText={changeSearchText}
          />
        </View>
        <Press
          onPress={() => setShowScanner(true)}
          accessibilityRole="button"
          accessibilityLabel="Barcode scannen"
          style={styles.scanButton}>
          <Txt variant="glyph" tone="primary">
            📷
          </Txt>
        </Press>
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

      {showDropdown ? (
        <View style={styles.dropdown}>
          {isSearchMode ? (
            searching ? (
              <View style={styles.centerLoader}>
                <ActivityIndicator color={colors.accent} />
              </View>
            ) : results.length === 0 && searchFailed ? (
              <View style={styles.failedBox}>
                <Txt variant="body" tone="warning" center>
                  Open Food Facts ist gerade nicht erreichbar. Versuch's gleich nochmal.
                </Txt>
                <Press
                  onPress={retrySearch}
                  accessibilityRole="button"
                  accessibilityLabel="Suche erneut versuchen">
                  <Txt variant="body" tone="primary" weight="700">
                    Erneut versuchen
                  </Txt>
                </Press>
              </View>
            ) : results.length === 0 ? (
              <Txt variant="body" tone="secondary" center style={styles.centered}>
                Keine Treffer für „{query}".
              </Txt>
            ) : (
              <>
                {results.map((product, index) => (
                  <ProductRow
                    key={product.barcode || `${product.name}-${index}`}
                    product={product}
                    onPress={() => selectProduct(product)}
                  />
                ))}
                {hasMore ? (
                  <Press
                    onPress={loadMoreResults}
                    disabled={loadingMore}
                    accessibilityRole="button"
                    accessibilityLabel="Mehr anzeigen"
                    style={styles.moreButton}>
                    {loadingMore ? (
                      <ActivityIndicator color={colors.accent} />
                    ) : (
                      <Txt variant="body" tone="primary" weight="700">
                        Mehr anzeigen
                      </Txt>
                    )}
                  </Press>
                ) : null}
              </>
            )
          ) : historyLoading ? (
            <View style={styles.centerLoader}>
              <ActivityIndicator color={colors.accent} />
            </View>
          ) : historyList.length === 0 ? (
            <Txt variant="body" tone="secondary" center style={styles.centered}>
              Noch keine Einträge. Suche oben nach einem Lebensmittel.
            </Txt>
          ) : (
            historyList.map((entry) => (
              <HistoryRow
                key={`${entry.name}-${entry.quantity}-${entry.unit}`}
                entry={entry}
                onPress={() => selectHistoryEntry(entry)}
              />
            ))
          )}
        </View>
      ) : null}

      <BarcodeScannerModal
        visible={showScanner}
        onClose={closeScanner}
        onBarcodeDetected={barcodeLookup.lookup}
        looking={barcodeLookup.looking}
        errorMessage={barcodeLookup.errorMessage}
      />
    </View>
  );
}

function ProductRow({ product, onPress }: { product: CatalogProduct; onPress: () => void }) {
  return (
    <Press
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={product.name}
      style={styles.row}>
      {product.imageUrl ? (
        <Image source={{ uri: product.imageUrl }} style={styles.productImage} />
      ) : (
        <View style={styles.rowImagePlaceholder}>
          <Txt variant="glyph" tone="primary">
            🥫
          </Txt>
        </View>
      )}
      <View style={styles.rowText}>
        <Txt variant="body" weight="700" numberOfLines={1}>
          {product.name}
        </Txt>
        <Txt variant="body" tone="secondary" numberOfLines={1}>
          {product.brand ? `${product.brand} · ` : ''}
          {product.caloriesPer100g !== undefined
            ? `${Math.round(product.caloriesPer100g)} kcal/100g`
            : ''}
        </Txt>
      </View>
    </Press>
  );
}

function HistoryRow({ entry, onPress }: { entry: FoodHistoryEntry; onPress: () => void }) {
  return (
    <Press
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={entry.name}
      style={styles.row}>
      <View style={styles.rowImagePlaceholder}>
        <Txt variant="glyph" tone="primary">
          🥫
        </Txt>
      </View>
      <View style={styles.rowText}>
        <Txt variant="body" weight="700" numberOfLines={1}>
          {entry.name}
        </Txt>
        <Txt variant="body" tone="secondary" numberOfLines={1}>
          {entry.quantity} {entry.unit}
          {entry.kcal !== null ? ` · ${Math.round(entry.kcal)} kcal` : ''}
        </Txt>
      </View>
    </Press>
  );
}
