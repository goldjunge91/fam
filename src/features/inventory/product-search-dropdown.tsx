import { onlineManager } from '@tanstack/react-query';
import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Keyboard,
  Pressable,
  ScrollView,
  type StyleProp,
  type TextStyle,
  useWindowDimensions,
  View,
} from 'react-native';

import { TextField } from '@/components/forms/text-field';
import { ThemedText } from '@/components/theme/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { getDatabase } from '@/lib/db/client';
import { dedupeProductsByBarcode, searchOffDump } from '@/lib/off-dump/off-dump';
import {
  type OpenFoodFactsProduct,
  parseCategoryTagsJson,
  searchOpenFoodFacts,
} from '@/lib/open-food-facts';

const LOCAL_RESULT_THRESHOLD = 5;
const OFF_PAGE_SIZE = 100;
const LOAD_MORE_THRESHOLD_PX = 70;
const PANEL_BOTTOM_MARGIN = 24;
const PANEL_MIN_HEIGHT = 140;
const PANEL_FALLBACK_HEIGHT = 220;

type LocalProductRow = {
  barcode: string | null;
  name: string;
  brand: string | null;
  kcal_per_100: number | null;
  protein_g_per_100: number | null;
  carbs_g_per_100: number | null;
  fat_g_per_100: number | null;
  /** JSON-serialisiertes `text[]`. */
  off_category_tags?: string | null;
  off_last_modified_at?: string | null;
};

function toOpenFoodFactsProduct(row: LocalProductRow): OpenFoodFactsProduct {
  return {
    barcode: row.barcode ?? '',
    name: row.name,
    brand: row.brand ?? undefined,
    caloriesPer100g: row.kcal_per_100 ?? undefined,
    proteinsPer100g: row.protein_g_per_100 ?? undefined,
    carbsPer100g: row.carbs_g_per_100 ?? undefined,
    fatPer100g: row.fat_g_per_100 ?? undefined,
    categoryTags: parseCategoryTagsJson(row.off_category_tags),
    offLastModifiedAt: row.off_last_modified_at ?? undefined,
  };
}

/** Sucht im kleinen, selbst gepflegten Produktspiegel. */
async function searchOwnProducts(query: string): Promise<OpenFoodFactsProduct[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<LocalProductRow>(
    `select barcode, name, brand, kcal_per_100, protein_g_per_100, carbs_g_per_100, fat_g_per_100,
            off_category_tags, off_last_modified_at
     from products
     where deleted_at is null and lower(name) like ?
     order by name
     limit 20`,
    [`%${query.trim().toLowerCase()}%`],
  );
  return rows.map(toOpenFoodFactsProduct);
}

/** Ergaenzt wenige eigene Treffer um Ergebnisse aus dem lokalen OFF-Dump. */
async function searchLocalProducts(
  query: string,
): Promise<{ results: OpenFoodFactsProduct[]; dumpHasMore: boolean }> {
  const ownResults = await searchOwnProducts(query);
  if (ownResults.length >= LOCAL_RESULT_THRESHOLD) {
    return { results: ownResults, dumpHasMore: false };
  }

  const { products: dumpResults, hasMore } = await searchOffDump(query, {
    limit: OFF_PAGE_SIZE,
  });
  return {
    results: dedupeProductsByBarcode([...ownResults, ...dumpResults]),
    dumpHasMore: hasMore,
  };
}

interface ProductSearchDropdownProps {
  label?: string;
  placeholder?: string;
  value: string;
  onChangeText: (text: string) => void;
  onSelectProduct: (product: OpenFoodFactsProduct) => void;
  inputStyle?: StyleProp<TextStyle>;
  trailing?: ReactNode;
  size?: 'default' | 'large';
}

export type ProductSearchDropdownHandle = {
  dismiss: () => void;
  /** Vor externem Setzen einer Auswahl aufrufen, damit die Suche geschlossen bleibt. */
  markSelected: (name: string) => void;
};

export const ProductSearchDropdown = forwardRef<
  ProductSearchDropdownHandle,
  ProductSearchDropdownProps
>(function ProductSearchDropdown(
  {
    label = 'Name',
    placeholder = 'z. B. Hafermilch',
    value,
    onChangeText,
    onSelectProduct,
    inputStyle,
    trailing,
    size = 'default',
  },
  ref,
) {
  const theme = useTheme();
  const [suggestions, setSuggestions] = useState<OpenFoodFactsProduct[]>([]);
  const [searching, setSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [searched, setSearched] = useState(false);
  const [offPage, setOffPage] = useState(1);
  const [offHasMore, setOffHasMore] = useState(false);
  const [dumpOffset, setDumpOffset] = useState(0);
  const [dumpHasMore, setDumpHasMore] = useState(false);
  const [loadingMoreOff, setLoadingMoreOff] = useState(false);
  const [panelMaxHeight, setPanelMaxHeight] = useState<number | null>(null);
  const wrapperRef = useRef<View>(null);
  const { height: windowHeight } = useWindowDimensions();
  // `screenY` beruecksichtigt unter iOS auch QuickType oberhalb der Tastatur.
  const [keyboardTopY, setKeyboardTopY] = useState<number | null>(null);
  // Verhindert, dass veraltete Nachlade-Antworten eine neue Suche ueberschreiben.
  const queryRef = useRef(value);
  queryRef.current = value;
  // Auswahlen und vorausgefuellte Werte duerfen nicht als neue Suche gelten.
  const justSelectedValueRef = useRef<string | null>(value);

  /** Schliesst die Trefferliste unabhaengig von der Tastatur. */
  function dismiss() {
    setShowDropdown(false);
  }

  useImperativeHandle(ref, () => ({
    dismiss,
    markSelected: (name: string) => {
      justSelectedValueRef.current = name;
    },
  }));

  useEffect(() => {
    const showSub = Keyboard.addListener('keyboardDidShow', (event) => {
      setKeyboardTopY(event.endCoordinates.screenY);
    });
    const hideSub = Keyboard.addListener('keyboardDidHide', () => setKeyboardTopY(null));
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  // Passt das Panel an den Platz oberhalb von Tastatur oder Bildschirmrand an.
  useEffect(() => {
    if (!showDropdown) return;
    wrapperRef.current?.measureInWindow((_x, y, _width, height) => {
      const bottomLimit = keyboardTopY ?? windowHeight;
      const available = bottomLimit - (y + height) - PANEL_BOTTOM_MARGIN;
      setPanelMaxHeight(Math.max(available, PANEL_MIN_HEIGHT));
    });
  }, [showDropdown, windowHeight, keyboardTopY]);

  useEffect(() => {
    if (justSelectedValueRef.current !== null) {
      const wasSelection = justSelectedValueRef.current === value;
      justSelectedValueRef.current = null;
      if (wasSelection) return;
    }

    if (!value || value.trim().length < 2) {
      setSuggestions([]);
      setShowDropdown(false);
      setSearched(false);
      setOffHasMore(false);
      setOffPage(1);
      setDumpHasMore(false);
      setDumpOffset(0);
      return;
    }

    const timer = setTimeout(async () => {
      setSearching(true);
      setOffHasMore(false);
      setOffPage(1);
      setDumpHasMore(false);
      setDumpOffset(0);

      const { results: localResults, dumpHasMore } = await searchLocalProducts(value);
      setDumpHasMore(dumpHasMore);
      const needsOffLookup =
        localResults.length < LOCAL_RESULT_THRESHOLD && onlineManager.isOnline();

      if (!needsOffLookup) {
        setSuggestions(localResults);
      } else {
        const { products: offResults, hasMore } = await searchOpenFoodFacts(value, {
          page: 1,
          pageSize: OFF_PAGE_SIZE,
        });
        const localBarcodes = new Set(localResults.map((p) => p.barcode).filter(Boolean));
        const dedupedOffResults = offResults.filter((p) => !localBarcodes.has(p.barcode));
        setSuggestions([...localResults, ...dedupedOffResults]);
        setOffHasMore(hasMore);
      }

      setSearched(true);
      setShowDropdown(true);
      setSearching(false);
    }, 300);

    return () => clearTimeout(timer);
  }, [value]);

  /** Laedt zuerst weitere lokale Dump-Seiten, danach Seiten der Netzsuche. */
  async function loadMoreOffResults() {
    if (loadingMoreOff || searching) return;
    const currentQuery = queryRef.current;

    if (dumpHasMore) {
      const nextOffset = dumpOffset + OFF_PAGE_SIZE;
      setLoadingMoreOff(true);
      const { products: dumpResults, hasMore } = await searchOffDump(currentQuery, {
        offset: nextOffset,
        limit: OFF_PAGE_SIZE,
      });
      if (queryRef.current === currentQuery) {
        setSuggestions((prev) => dedupeProductsByBarcode([...prev, ...dumpResults]));
        setDumpHasMore(hasMore);
        setDumpOffset(nextOffset);
      }
      setLoadingMoreOff(false);
      return;
    }

    if (!offHasMore) return;
    const nextPage = offPage + 1;
    setLoadingMoreOff(true);

    const { products: offResults, hasMore } = await searchOpenFoodFacts(currentQuery, {
      page: nextPage,
      pageSize: OFF_PAGE_SIZE,
    });

    if (queryRef.current === currentQuery) {
      setSuggestions((prev) => dedupeProductsByBarcode([...prev, ...offResults]));
      setOffHasMore(hasMore);
      setOffPage(nextPage);
    }
    setLoadingMoreOff(false);
  }

  const showEmptyState = searched && !searching && suggestions.length === 0;

  return (
    <View
      ref={wrapperRef}
      className="relative z-10"
      onTouchStart={(event) => event.stopPropagation()}>
      <TextField
        label={label}
        placeholder={placeholder}
        value={value}
        style={inputStyle}
        trailing={trailing}
        size={size}
        returnKeyType="search"
        onSubmitEditing={() => Keyboard.dismiss()}
        onChangeText={(text) => {
          onChangeText(text);
          setShowDropdown(true);
        }}
      />

      {searching && (
        <View className="psd-spinner">
          <ActivityIndicator size="small" color={theme.accent} />
        </View>
      )}

      {showDropdown && (suggestions.length > 0 || showEmptyState) && (
        <View className="relative">
          <Pressable
            onPress={dismiss}
            accessibilityRole="button"
            accessibilityLabel="Trefferliste schließen"
            className="psd-panel-close">
            <ThemedText themeColor="textSecondary" className="text-[13px] font-bold">
              ✕
            </ThemedText>
          </Pressable>
          <ScrollView
            className="psd-panel"
            // `elevation` bleibt Android-spezifisch; `maxHeight` kommt aus der Live-Messung.
            style={{ elevation: 4, maxHeight: panelMaxHeight ?? PANEL_FALLBACK_HEIGHT }}
            contentContainerClassName="pb-two"
            // Leerflaeche bleibt tappbar, auch wenn nur wenige Treffer vorliegen.
            contentContainerStyle={{ flexGrow: 1 }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator
            onScroll={({ nativeEvent }) => {
              const { contentOffset, contentSize, layoutMeasurement } = nativeEvent;
              const distanceToBottom =
                contentSize.height - contentOffset.y - layoutMeasurement.height;
              if (distanceToBottom < LOAD_MORE_THRESHOLD_PX) loadMoreOffResults();
            }}
            scrollEventThrottle={100}>
            {showEmptyState ? (
              <Pressable
                onPress={() => {
                  setShowDropdown(false);
                  Keyboard.dismiss();
                  router.push({
                    pathname: '/add-product',
                    params: { prefillName: value.trim() },
                  });
                }}
                className="psd-row">
                <View className="flex-1">
                  <ThemedText
                    type={size === 'large' ? 'body' : 'smallBold'}
                    className={size === 'large' ? 'font-bold' : undefined}>
                    + &quot;{value.trim()}&quot; manuell anlegen
                  </ThemedText>
                  <ThemedText
                    type={size === 'large' ? 'body' : 'small'}
                    themeColor="textSecondary"
                    className={size === 'large' ? 'font-medium' : undefined}>
                    Kein Treffer bei Open Food Facts gefunden
                  </ThemedText>
                </View>
              </Pressable>
            ) : null}
            {suggestions.map((item) => (
              <Pressable
                key={item.barcode || item.name}
                onPress={() => {
                  justSelectedValueRef.current = item.name;
                  onSelectProduct(item);
                  setShowDropdown(false);
                  Keyboard.dismiss();
                }}
                className="psd-row">
                {item.imageUrl ? (
                  <Image source={{ uri: item.imageUrl }} className="psd-thumb" />
                ) : (
                  <View className="psd-thumb-fallback">
                    <ThemedText type={size === 'large' ? 'body' : 'bodySmall'}>🥫</ThemedText>
                  </View>
                )}

                <View className="flex-1">
                  <ThemedText
                    type={size === 'large' ? 'body' : 'smallBold'}
                    numberOfLines={1}
                    className={size === 'large' ? 'font-bold' : undefined}>
                    {item.name}
                  </ThemedText>
                  <ThemedText
                    type={size === 'large' ? 'body' : 'small'}
                    themeColor="textSecondary"
                    numberOfLines={1}
                    className={size === 'large' ? 'font-medium' : undefined}>
                    {item.brand ? `${item.brand} · ` : ''}
                    {item.quantity} {item.unit}
                    {item.caloriesPer100g ? ` · ${item.caloriesPer100g} kcal/100g` : ''}
                  </ThemedText>
                </View>
              </Pressable>
            ))}
            {loadingMoreOff && (
              <View className="py-two items-center">
                <ActivityIndicator size="small" color={theme.accent} />
              </View>
            )}
            {/* Die Leerflaeche schliesst nur die Tastatur, nicht die Liste. */}
            <Pressable className="flex-1" accessible={false} onPress={() => Keyboard.dismiss()} />
          </ScrollView>
        </View>
      )}
    </View>
  );
});
