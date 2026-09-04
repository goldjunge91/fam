import { Image } from 'expo-image';
import { useState } from 'react';
import { ActivityIndicator, Keyboard, Pressable, View } from 'react-native';
import { TextField } from '@/components/forms/text-field';
import { useTheme } from '@/components/theme/ThemeProvider';
import { type ItemSource, ItemSourceFilterRow } from '@/components/ui/item-source-filter';
import { Txt } from '@/constants/ui';
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
    <View className="fsd-root">
      <View className="fss-search-row">
        <View className="flex-1">
          <TextField
            label="Lebensmittel suchen"
            placeholder="Wonach suchst du?"
            value={displayedValue}
            onFocus={focusSearch}
            onChangeText={changeSearchText}
          />
        </View>
        <Pressable
          onPress={() => setShowScanner(true)}
          accessibilityRole="button"
          accessibilityLabel="Barcode scannen"
          className="fss-scan-btn">
          <Txt variant="body" style={{ fontSize: 20 }}>
            📷
          </Txt>
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

      {showDropdown ? (
        <View className="fsd-dropdown">
          {isSearchMode ? (
            searching ? (
              <View className="fss-center-loader">
                <ActivityIndicator color={colors.accent} />
              </View>
            ) : results.length === 0 && searchFailed ? (
              <View className="fss-failed-box">
                <Txt variant="body" tone="warning" center>
                  Open Food Facts ist gerade nicht erreichbar. Versuch's gleich nochmal.
                </Txt>
                <Pressable onPress={retrySearch} accessibilityRole="button">
                  <Txt variant="body" tone="primary" weight="700">
                    Erneut versuchen
                  </Txt>
                </Pressable>
              </View>
            ) : results.length === 0 ? (
              <Txt variant="body" tone="secondary" center className="fss-centered">
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
                  <Pressable
                    onPress={loadMoreResults}
                    disabled={loadingMore}
                    accessibilityRole="button"
                    className="fsd-more-button">
                    {loadingMore ? (
                      <ActivityIndicator color={colors.basil} />
                    ) : (
                      <Txt variant="body" tone="primary" weight="700">
                        Mehr anzeigen
                      </Txt>
                    )}
                  </Pressable>
                ) : null}
              </>
            )
          ) : historyLoading ? (
            <View className="fss-center-loader">
              <ActivityIndicator color={colors.accent} />
            </View>
          ) : historyList.length === 0 ? (
            <Txt variant="body" tone="secondary" center className="fss-centered">
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
    <Pressable onPress={onPress} className="fss-row">
      {product.imageUrl ? (
        <Image
          source={{ uri: product.imageUrl }}
          style={{ width: 36, height: 36, borderRadius: 12 }}
        />
      ) : (
        <View className="fss-row-img-placeholder">
          <Txt variant="body" style={{ fontSize: 16 }}>
            🥫
          </Txt>
        </View>
      )}
      <View className="fss-row-text">
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
    </Pressable>
  );
}

function HistoryRow({ entry, onPress }: { entry: FoodHistoryEntry; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} className="fss-row">
      <View className="fss-row-img-placeholder">
        <Txt variant="body" style={{ fontSize: 16 }}>
          🥫
        </Txt>
      </View>
      <View className="fss-row-text">
        <Txt variant="body" weight="700" numberOfLines={1}>
          {entry.name}
        </Txt>
        <Txt variant="body" tone="secondary" numberOfLines={1}>
          {entry.quantity} {entry.unit}
          {entry.kcal !== null ? ` · ${Math.round(entry.kcal)} kcal` : ''}
        </Txt>
      </View>
    </Pressable>
  );
}
