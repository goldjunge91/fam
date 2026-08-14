import { useQuery } from '@tanstack/react-query';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FontSize, ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useProduct } from '@/features/inventory/use-product';
import { useTheme } from '@/hooks/use-theme';
import { fetchProductByBarcode } from '@/lib/open-food-facts';

export type ProductInformationItem = {
  product_id: string | null;
  name: string;
  quantity: number;
  unit: string;
  expiry_date?: string | null;
};

type ProductInformationProps = {
  visible: boolean;
  item: ProductInformationItem | null;
  onClose: () => void;
};

const NUTRI_COLORS = {
  a: '#5D9E55',
  b: '#78A866',
  c: '#D0A44B',
  d: '#D58545',
  e: '#C65F50',
} as const;

function formatNumber(value: number | null | undefined, digits = 1): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '–';
  return value.toLocaleString('de-DE', {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  });
}

function formatExpiry(value: string | null | undefined): string {
  if (!value) return 'Nicht angegeben';
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('de-DE', { day: 'numeric', month: 'long', year: 'numeric' });
}

export function ProductInformation({ visible, item, onClose }: ProductInformationProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { data: localProduct } = useProduct(item?.product_id);
  const { data: openFoodFactsProduct, isFetching } = useQuery({
    queryKey: ['open-food-facts-product', localProduct?.barcode],
    queryFn: ({ signal }) => fetchProductByBarcode(localProduct?.barcode ?? '', signal),
    enabled: visible && !!localProduct?.barcode,
    staleTime: 24 * 60 * 60 * 1000,
  });

  if (!item) return null;

  const brand = openFoodFactsProduct?.brand ?? localProduct?.brand ?? 'Marke nicht angegeben';
  const score = openFoodFactsProduct?.nutriScore;
  const nutrients = [
    {
      label: 'Kalorien',
      value: `${formatNumber(openFoodFactsProduct?.caloriesPer100g ?? localProduct?.kcal_per_100, 0)} kcal`,
    },
    {
      label: 'Protein',
      value: `${formatNumber(openFoodFactsProduct?.proteinsPer100g ?? localProduct?.protein_g_per_100)} g`,
    },
    {
      label: 'Kohlenhydrate',
      value: `${formatNumber(openFoodFactsProduct?.carbsPer100g ?? localProduct?.carbs_g_per_100)} g`,
    },
    {
      label: 'Fett',
      value: `${formatNumber(openFoodFactsProduct?.fatPer100g ?? localProduct?.fat_g_per_100)} g`,
    },
    {
      label: 'Zucker',
      value: `${formatNumber(openFoodFactsProduct?.sugarsPer100g ?? localProduct?.sugar_g_per_100)} g`,
    },
    {
      label: 'Salz',
      value: `${formatNumber(openFoodFactsProduct?.saltPer100g ?? localProduct?.salt_g_per_100)} g`,
    },
  ];
  const referenceUnit = item.unit === 'ml' || item.unit === 'l' ? '100 ml' : '100 g';

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={StyleSheet.absoluteFill}>
        <Pressable
          style={styles.backdrop}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Produktinformationen schließen"
        />

        <View
          style={[
            styles.sheet,
            {
              backgroundColor: theme.backgroundElement,
              paddingBottom: Math.max(insets.bottom, Spacing.three),
            },
          ]}>
          <View style={[styles.handle, { backgroundColor: theme.border }]} />
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
            <View style={styles.header}>
              <View style={styles.headerCopy}>
                <ThemedText type="subtitle" selectable>
                  {item.name}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary" selectable>
                  {brand}
                </ThemedText>
              </View>
              <Pressable
                onPress={onClose}
                accessibilityRole="button"
                accessibilityLabel="Schließen"
                style={[styles.closeButton, { backgroundColor: theme.backgroundSelected }]}>
                <ThemedText>×</ThemedText>
              </Pressable>
            </View>

            <View style={[styles.nutriCard, { backgroundColor: theme.background }]}>
              <View
                style={[
                  styles.score,
                  { backgroundColor: score ? NUTRI_COLORS[score] : theme.backgroundSelected },
                ]}>
                <ThemedText style={[styles.scoreText, { color: score ? '#fff' : theme.text }]}>
                  {score?.toUpperCase() ?? '–'}
                </ThemedText>
              </View>
              <View style={styles.flex}>
                <ThemedText type="smallBold">Nutri-Score {score?.toUpperCase() ?? '–'}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  Produktdaten von Open Food Facts
                </ThemedText>
              </View>
              {isFetching ? <ActivityIndicator size="small" color={theme.accent} /> : null}
            </View>

            <View style={[styles.detailsCard, { borderColor: theme.border }]}>
              <View style={[styles.detailRow, { borderBottomColor: theme.border }]}>
                <ThemedText type="small" themeColor="textSecondary">
                  Menge und Einheit
                </ThemedText>
                <ThemedText type="smallBold" selectable>
                  {item.quantity} {item.unit}
                </ThemedText>
              </View>
              <View style={styles.detailRow}>
                <ThemedText type="small" themeColor="textSecondary">
                  Mindesthaltbarkeitsdatum
                </ThemedText>
                <ThemedText type="smallBold" selectable>
                  {formatExpiry(item.expiry_date)}
                </ThemedText>
              </View>
            </View>

            <View style={[styles.copyCard, { backgroundColor: theme.background }]}>
              <ThemedText type="smallBold">Zutaten</ThemedText>
              <ThemedText type="small" themeColor="textSecondary" selectable>
                {openFoodFactsProduct?.ingredients ?? 'Keine Zutaten angegeben.'}
              </ThemedText>
            </View>

            <View style={[styles.copyCard, { backgroundColor: theme.background }]}>
              <ThemedText type="smallBold">Allergene</ThemedText>
              <ThemedText type="small" themeColor="textSecondary" selectable>
                {openFoodFactsProduct?.allergens?.join(', ') ?? 'Keine Allergene angegeben.'}
              </ThemedText>
            </View>

            <ThemedText type="smallBold">Nährwerte pro {referenceUnit}</ThemedText>
            <View style={styles.nutrientGrid}>
              {nutrients.map((nutrient) => (
                <View
                  key={nutrient.label}
                  style={[styles.nutrientCard, { backgroundColor: theme.backgroundSelected }]}>
                  <ThemedText type="smallBold" selectable>
                    {nutrient.value}
                  </ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {nutrient.label}
                  </ThemedText>
                </View>
              ))}
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(31, 26, 33, 0.32)',
  },
  sheet: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 10,
    maxHeight: '82%',
    borderRadius: 28,
    borderCurve: 'continuous',
    boxShadow: '0 -16px 48px rgba(42, 32, 44, 0.2)',
    overflow: 'hidden',
  },
  handle: {
    width: 42,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 11,
  },
  content: {
    padding: 20,
    gap: 14,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.three,
  },
  headerCopy: {
    flex: 1,
    gap: 3,
  },
  closeButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nutriCard: {
    minHeight: 88,
    borderRadius: 20,
    borderCurve: 'continuous',
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  score: {
    width: 62,
    height: 62,
    borderRadius: 16,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scoreText: {
    ...FontSize[24],
    lineHeight: 28,
    fontWeight: '700',
  },
  flex: {
    flex: 1,
    gap: 3,
  },
  detailsCard: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 18,
    borderCurve: 'continuous',
    overflow: 'hidden',
  },
  detailRow: {
    minHeight: 50,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  copyCard: {
    borderRadius: 18,
    borderCurve: 'continuous',
    padding: 14,
    gap: 6,
  },
  nutrientGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  nutrientCard: {
    width: '31.6%',
    minHeight: 62,
    borderRadius: 16,
    borderCurve: 'continuous',
    padding: 10,
    gap: 5,
  },
});
