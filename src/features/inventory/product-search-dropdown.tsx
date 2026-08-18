import { onlineManager } from '@tanstack/react-query';
import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  type StyleProp,
  type TextStyle,
  View,
} from 'react-native';

import { TextField } from '@/components/forms/text-field';
import { ThemedText } from '@/components/theme/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { getDatabase } from '@/lib/db/client';
import { dedupeProductsByBarcode, searchOffDump } from '@/lib/off-dump/off-dump';
import { type OpenFoodFactsProduct, searchOpenFoodFacts } from '@/lib/open-food-facts';

/** Unter dieser Zahl lokaler Treffer lohnt sich der zusaetzliche OFF-Request noch. */
const LOCAL_RESULT_THRESHOLD = 5;

/** Seitengroesse fuer OFF-Nachladen beim Scrollen, siehe `loadMoreOffResults`. */
const OFF_PAGE_SIZE = 100;

/** Wie nah am unteren Rand (px) das Nachladen beim Scrollen ausloest. */
const LOAD_MORE_THRESHOLD_PX = 70;

type LocalProductRow = {
  barcode: string | null;
  name: string;
  brand: string | null;
  kcal_per_100: number | null;
  protein_g_per_100: number | null;
  carbs_g_per_100: number | null;
  fat_g_per_100: number | null;
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
  };
}

/**
 * Lokale Suche gegen den `products`-Spiegel (#75) — SQLite hat keine
 * FTS/tsvector-Entsprechung wie der Server, ein einfaches `LIKE` reicht fuer
 * den gepflegten, deutlich kleineren lokalen Bestand. Bleibt bewusst ohne
 * Pagination: der selbst angelegte Bestand ist klein, 20 Treffer reichen hier
 * praktisch immer — anders als beim OFF-Dump unten.
 */
async function searchOwnProducts(query: string): Promise<OpenFoodFactsProduct[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<LocalProductRow>(
    `select barcode, name, brand, kcal_per_100, protein_g_per_100, carbs_g_per_100, fat_g_per_100
     from products
     where deleted_at is null and lower(name) like ?
     order by name
     limit 20`,
    [`%${query.trim().toLowerCase()}%`],
  );
  return rows.map(toOpenFoodFactsProduct);
}

/**
 * Lokale Suche insgesamt: erst der eigene, gepflegte `products`-Spiegel,
 * dann — falls das noch nicht reicht — die erste Seite des grossen
 * angehaengten OFF-Dumps. So liefert die Suche auch ohne Netz brauchbare
 * Treffer statt nur der Handvoll selbst angelegten Produkte. `dumpHasMore`
 * sagt dem Aufrufer, ob beim Scrollen weitere Dump-Seiten sich lohnen.
 */
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
  // Paginierungs-Status fuer das Nachladen weiterer OFF-Seiten beim Scrollen
  // (#Performance-Feedback: "OpenFoodFacts findet 700+, angezeigt werden nur
  // ~30" — ohne das kappt die erste Seite die Suche hart).
  const [offPage, setOffPage] = useState(1);
  const [offHasMore, setOffHasMore] = useState(false);
  // Nachlade-Status fuer den lokalen OFF-Dump, unabhaengig vom Netz-OFF-Status
  // oben — beide Quellen koennen hunderte Treffer haben und werden nacheinander
  // ausgeschoepft (erst Dump, dann Netz), siehe `loadMoreOffResults`.
  const [dumpOffset, setDumpOffset] = useState(0);
  const [dumpHasMore, setDumpHasMore] = useState(false);
  const [loadingMoreOff, setLoadingMoreOff] = useState(false);
  const blurTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // `value` beim Ausloesen der aktuellen Suche — schuetzt vor veralteten
  // Nachlade-Antworten, wenn der Nutzer inzwischen weitergetippt hat.
  const queryRef = useRef(value);
  queryRef.current = value;
  // `value` aendert sich auch, wenn `onSelectProduct` den Query-Text auf den
  // gewaehlten Produktnamen setzt (siehe recipe-create-screen.tsx). Ohne diese
  // Markierung faengt der Such-Effekt unten diese Aenderung ab und oeffnet das
  // Dropdown eine Suche spaeter erneut — Auswahl wirkte dann wie 2x noetig.
  const justSelectedValueRef = useRef<string | null>(null);

  function cancelScheduledDismiss() {
    if (blurTimerRef.current === null) return;
    clearTimeout(blurTimerRef.current);
    blurTimerRef.current = null;
  }

  function dismiss() {
    cancelScheduledDismiss();
    setShowDropdown(false);
  }

  useImperativeHandle(ref, () => ({ dismiss }));

  useEffect(() => () => {
    cancelScheduledDismiss();
  });

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

  /**
   * Laedt beim Scrollen ans Ende des Dropdowns nach — erst weitere Seiten des
   * lokalen OFF-Dumps (guenstig, kein Rate-Limit), erst wenn der ausgeschoepft
   * ist, weitere Seiten der Netz-Suche. Ohne das war bei Begriffen mit
   * hunderten Treffern (z. B. "Milch") nach der ersten Seite (20) Schluss,
   * obwohl sowohl Dump als auch OFF deutlich mehr liefern.
   */
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
    <View className="relative z-10" onTouchStart={(event) => event.stopPropagation()}>
      <TextField
        label={label}
        placeholder={placeholder}
        value={value}
        style={inputStyle}
        trailing={trailing}
        size={size}
        onFocus={cancelScheduledDismiss}
        onBlur={() => {
          cancelScheduledDismiss();
          blurTimerRef.current = setTimeout(() => setShowDropdown(false), 120);
        }}
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
        <ScrollView
          className="psd-panel"
          // elevation ist ein Android-only-Wert ohne Tailwind-Aequivalent
          // (boxShadow deckt nur den iOS/Web-Schatten ab).
          style={{ elevation: 4 }}
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
        </ScrollView>
      )}
    </View>
  );
});
