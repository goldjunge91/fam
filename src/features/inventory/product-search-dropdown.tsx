import { onlineManager } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { getDatabase } from '@/lib/db/client';
import { isOffDumpAttached } from '@/lib/off-dump/off-dump';
import {
  type OpenFoodFactsProduct,
  parseQuantityAndUnit,
  searchOpenFoodFacts,
} from '@/lib/open-food-facts';

/** Unter dieser Zahl lokaler Treffer lohnt sich der zusaetzliche OFF-Request noch. */
const LOCAL_RESULT_THRESHOLD = 5;

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
 * den gepflegten, deutlich kleineren lokalen Bestand.
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

type OffDumpProductRow = {
  code: string | null;
  product_name: string;
  brand: string | null;
  quantity: string | null;
  nutriscore: string | null;
  energy_kcal: number | null;
  fat: number | null;
  saturated_fat: number | null;
  carbohydrates: number | null;
  sugars: number | null;
  proteins: number | null;
  salt: number | null;
};

function toOpenFoodFactsProductFromDump(row: OffDumpProductRow): OpenFoodFactsProduct {
  const { quantity, unit } = parseQuantityAndUnit(row.quantity ?? undefined);
  return {
    barcode: row.code ?? '',
    name: row.product_name,
    brand: row.brand ?? undefined,
    quantity,
    unit,
    caloriesPer100g: row.energy_kcal ?? undefined,
    proteinsPer100g: row.proteins ?? undefined,
    carbsPer100g: row.carbohydrates ?? undefined,
    fatPer100g: row.fat ?? undefined,
    sugarsPer100g: row.sugars ?? undefined,
    saturatedFatPer100g: row.saturated_fat ?? undefined,
    saltPer100g: row.salt ?? undefined,
    nutriScore: (row.nutriscore || undefined) as OpenFoodFactsProduct['nutriScore'],
  };
}

/**
 * Suche gegen den angehaengten OpenFoodFacts-Dump (#79 + Dump-CI-Workflow,
 * `off-dump.ts`). Laeuft still ins Leere, solange der Dump noch nicht
 * heruntergeladen/angehaengt ist (`no such table: off_dump.products`) — das
 * ist beim App-Start fuer einen Moment der Normalfall, kein Fehler, den die
 * Suche dem Nutzer zeigen muesste.
 */
async function searchOffDump(query: string): Promise<OpenFoodFactsProduct[]> {
  if (!isOffDumpAttached()) return [];

  try {
    const db = await getDatabase();
    const rows = await db.getAllAsync<OffDumpProductRow>(
      `select code, product_name, brand, quantity, nutriscore, energy_kcal, fat, saturated_fat, carbohydrates, sugars, proteins, salt
       from off_dump.products
       where lower(product_name) like ?
       order by product_name
       limit 20`,
      [`%${query.trim().toLowerCase()}%`],
    );
    return rows.map(toOpenFoodFactsProductFromDump);
  } catch {
    return [];
  }
}

/** Barcode-Dedupe ueber mehrere Quellen — Produkte ohne Barcode gelten als eindeutig. */
function dedupeByBarcode(products: OpenFoodFactsProduct[]): OpenFoodFactsProduct[] {
  const seen = new Set<string>();
  const result: OpenFoodFactsProduct[] = [];
  for (const product of products) {
    if (product.barcode && seen.has(product.barcode)) continue;
    if (product.barcode) seen.add(product.barcode);
    result.push(product);
  }
  return result;
}

/**
 * Lokale Suche insgesamt: erst der eigene, gepflegte `products`-Spiegel,
 * dann — falls das noch nicht reicht — der grosse angehaengte OFF-Dump. So
 * liefert die Suche auch ohne Netz brauchbare Treffer statt nur der
 * Handvoll selbst angelegten Produkte.
 */
async function searchLocalProducts(query: string): Promise<OpenFoodFactsProduct[]> {
  const ownResults = await searchOwnProducts(query);
  if (ownResults.length >= LOCAL_RESULT_THRESHOLD) return ownResults;

  const dumpResults = await searchOffDump(query);
  return dedupeByBarcode([...ownResults, ...dumpResults]);
}

interface ProductSearchDropdownProps {
  label?: string;
  placeholder?: string;
  value: string;
  onChangeText: (text: string) => void;
  onSelectProduct: (product: OpenFoodFactsProduct) => void;
}

export function ProductSearchDropdown({
  label = 'Name',
  placeholder = 'z. B. Hafermilch',
  value,
  onChangeText,
  onSelectProduct,
}: ProductSearchDropdownProps) {
  const theme = useTheme();
  const [suggestions, setSuggestions] = useState<OpenFoodFactsProduct[]>([]);
  const [searching, setSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [searched, setSearched] = useState(false);

  useEffect(() => {
    if (!value || value.trim().length < 2) {
      setSuggestions([]);
      setShowDropdown(false);
      setSearched(false);
      return;
    }

    const timer = setTimeout(async () => {
      setSearching(true);

      const localResults = await searchLocalProducts(value);
      const needsOffLookup =
        localResults.length < LOCAL_RESULT_THRESHOLD && onlineManager.isOnline();

      if (!needsOffLookup) {
        setSuggestions(localResults);
      } else {
        const { products: offResults } = await searchOpenFoodFacts(value);
        const localBarcodes = new Set(localResults.map((p) => p.barcode).filter(Boolean));
        const dedupedOffResults = offResults.filter((p) => !localBarcodes.has(p.barcode));
        setSuggestions([...localResults, ...dedupedOffResults]);
      }

      setSearched(true);
      setShowDropdown(true);
      setSearching(false);
    }, 300);

    return () => clearTimeout(timer);
  }, [value]);

  const showEmptyState = searched && !searching && suggestions.length === 0;

  return (
    <View style={styles.container}>
      <TextField
        label={label}
        placeholder={placeholder}
        value={value}
        onChangeText={(text) => {
          onChangeText(text);
          setShowDropdown(true);
        }}
      />

      {searching && (
        <View style={styles.loader}>
          <ActivityIndicator size="small" color={theme.accent} />
        </View>
      )}

      {showDropdown && (suggestions.length > 0 || showEmptyState) && (
        <ScrollView
          style={[
            styles.dropdown,
            { backgroundColor: theme.background, borderColor: theme.border },
          ]}
          nestedScrollEnabled
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator>
          {showEmptyState ? (
            <Pressable
              onPress={() => {
                setShowDropdown(false);
                router.push({
                  pathname: '/add-product',
                  params: { prefillName: value.trim() },
                });
              }}
              style={[styles.itemRow, { borderBottomColor: theme.border }]}>
              <View style={styles.itemText}>
                <ThemedText type="smallBold">
                  + &quot;{value.trim()}&quot; manuell anlegen
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  Kein Treffer bei Open Food Facts gefunden
                </ThemedText>
              </View>
            </Pressable>
          ) : null}
          {suggestions.map((item) => (
            <Pressable
              key={item.barcode || item.name}
              onPress={() => {
                onSelectProduct(item);
                setShowDropdown(false);
              }}
              style={[styles.itemRow, { borderBottomColor: theme.border }]}>
              {item.imageUrl ? (
                <Image source={{ uri: item.imageUrl }} style={styles.img} />
              ) : (
                <View style={[styles.imgPlaceholder, { backgroundColor: theme.backgroundElement }]}>
                  <ThemedText style={{ fontSize: 14 }}>🥫</ThemedText>
                </View>
              )}

              <View style={styles.itemText}>
                <ThemedText type="smallBold" numberOfLines={1}>
                  {item.name}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                  {item.brand ? `${item.brand} · ` : ''}
                  {item.quantity} {item.unit}
                  {item.caloriesPer100g ? ` · ${item.caloriesPer100g} kcal/100g` : ''}
                </ThemedText>
              </View>
            </Pressable>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    zIndex: 10,
  },
  loader: {
    position: 'absolute',
    right: 12,
    top: 36,
  },
  dropdown: {
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 4,
    maxHeight: 220,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.two,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: Spacing.two,
  },
  img: {
    width: 32,
    height: 32,
    borderRadius: 6,
  },
  imgPlaceholder: {
    width: 32,
    height: 32,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemText: {
    flex: 1,
  },
});
