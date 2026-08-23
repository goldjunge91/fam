import { useQuery } from '@tanstack/react-query';
import { ActivityIndicator, Modal, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/theme/themed-text';
import { useProduct } from '@/features/inventory/use-product';
import { useTheme } from '@/hooks/use-theme';
import { fetchProductByBarcode, type OpenFoodFactsProduct } from '@/lib/open-food-facts';

export type ProductInformationItem = {
  product_id: string | null;
  name: string;
  quantity: number;
  unit: string;
  expiry_date?: string | null;
};

type NutriScoreGrade = NonNullable<OpenFoodFactsProduct['nutriScore']>;

type ProductInformationProps = {
  visible: boolean;
  item: ProductInformationItem | null;
  onClose: () => void;
};

const NUTRI_BADGE_CLASSES: Record<NutriScoreGrade, string> = {
  a: 'badge-nutri-a',
  b: 'badge-nutri-b',
  c: 'badge-nutri-c',
  d: 'badge-nutri-d',
  e: 'badge-nutri-e',
};

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
      <View className="absolute inset-0">
        <Pressable
          className="absolute inset-0 bg-[#1F1A21]/30"
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Produktinformationen schließen"
        />

        <View
          className="absolute left-3 right-3 bottom-[10px] max-h-[82%] rounded-fam-large overflow-hidden bg-background-element shadow-sheet"
          // Safe Area plus 24 px muss zur Laufzeit berechnet werden.
          style={{ paddingBottom: insets.bottom + 24 }}>
          <View className="w-[42px] h-[4px] rounded-hairline self-center mt-[11px] bg-border" />
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerClassName="p-[20px] gap-[14px]">
            <View className="flex-row items-start gap-three">
              <View className="flex-1 gap-[3px]">
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
                className="w-[34px] h-[34px] rounded-sheet items-center justify-center bg-background-selected active:opacity-75">
                <ThemedText>×</ThemedText>
              </Pressable>
            </View>

            <View className="min-h-[88px] rounded-sheet p-[12px] flex-row items-center gap-[12px] bg-background">
              <View
                className={`w-[62px] h-[62px] rounded-card items-center justify-center ${
                  score ? NUTRI_BADGE_CLASSES[score] : 'bg-background-selected'
                }`}>
                <ThemedText
                  className={`text-[24px] leading-[28px] font-bold ${score ? 'text-white' : ''}`}
                  themeColor={score ? undefined : 'text'}>
                  {score?.toUpperCase() ?? '–'}
                </ThemedText>
              </View>
              <View className="flex-1 gap-[3px]">
                <ThemedText type="smallBold">Nutri-Score {score?.toUpperCase() ?? '–'}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  Produktdaten von Open Food Facts
                </ThemedText>
              </View>
              {isFetching ? <ActivityIndicator size="small" color={theme.accent} /> : null}
            </View>

            <View className="border-hairline rounded-sheet overflow-hidden border-border">
              <View className="min-h-[50px] px-[14px] flex-row items-center justify-between gap-three border-b-hairline border-border">
                <ThemedText type="small" themeColor="textSecondary">
                  Menge und Einheit
                </ThemedText>
                <ThemedText type="smallBold" selectable>
                  {item.quantity} {item.unit}
                </ThemedText>
              </View>
              <View className="min-h-[50px] px-[14px] flex-row items-center justify-between gap-three">
                <ThemedText type="small" themeColor="textSecondary">
                  Mindesthaltbarkeitsdatum
                </ThemedText>
                <ThemedText type="smallBold" selectable>
                  {formatExpiry(item.expiry_date)}
                </ThemedText>
              </View>
            </View>

            <View className="rounded-sheet p-[14px] gap-[6px] bg-background">
              <ThemedText type="smallBold">Zutaten</ThemedText>
              <ThemedText type="small" themeColor="textSecondary" selectable>
                {openFoodFactsProduct?.ingredients ?? 'Keine Zutaten angegeben.'}
              </ThemedText>
            </View>

            <View className="rounded-sheet p-[14px] gap-[6px] bg-background">
              <ThemedText type="smallBold">Allergene</ThemedText>
              <ThemedText type="small" themeColor="textSecondary" selectable>
                {openFoodFactsProduct?.allergens?.join(', ') ?? 'Keine Allergene angegeben.'}
              </ThemedText>
            </View>

            <ThemedText type="smallBold">Nährwerte pro {referenceUnit}</ThemedText>
            <View className="flex-row flex-wrap gap-[8px]">
              {nutrients.map((nutrient) => (
                <View
                  key={nutrient.label}
                  className="w-[31.6%] min-h-[62px] rounded-card p-[10px] gap-[5px] bg-background-selected">
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
