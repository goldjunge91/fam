import { useQuery } from '@tanstack/react-query';
import { ActivityIndicator, Modal, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/components/theme/ThemeProvider';
import { Txt } from '@/constants/ui';
import { useProduct } from '@/features/inventory/use-product';
import { offApiSource } from '@/features/product-search/sources/off-api-source';
import type { CatalogProduct } from '@/features/product-search/types';

export type ProductInformationItem = {
  product_id: string | null;
  name: string;
  quantity: number;
  unit: string;
  expiry_date?: string | null;
};

type NutriScoreGrade = NonNullable<CatalogProduct['nutriScore']>;

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
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { data: localProduct } = useProduct(item?.product_id);
  const { data: openFoodFactsProduct, isFetching } = useQuery({
    queryKey: ['open-food-facts-product', localProduct?.barcode],
    queryFn: ({ signal }) => offApiSource.findByBarcode(localProduct?.barcode ?? '', signal),
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
          className="absolute inset-0"
          style={{ backgroundColor: colors.scrim }}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Produktinformationen schließen"
        />

        <View
          className="absolute left-3 right-3 bottom-[10px] max-h-[82%] rounded-fam-large overflow-hidden shadow-sheet"
          // Bottom-Safe-Area ist ein echter Laufzeitwert (Geraet-abhaengig),
          // kann nicht als Tailwind-Klasse ausgedrueckt werden. 24px = pb-four.
          style={{ backgroundColor: colors.backgroundElement, paddingBottom: insets.bottom + 24 }}>
          <View className="w-[42px] h-[4px] rounded-hairline self-center mt-[11px] bg-border" />
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerClassName="p-[20px] gap-[14px]">
            <View className="flex-row items-start gap-three">
              <View className="flex-1 gap-[3px]">
                <Txt variant="title" weight="600" selectable>
                  {item.name}
                </Txt>
                <Txt variant="body" tone="secondary" weight="500" selectable>
                  {brand}
                </Txt>
              </View>
              <Pressable
                onPress={onClose}
                accessibilityRole="button"
                accessibilityLabel="Schließen"
                className="w-[34px] h-[34px] rounded-sheet items-center justify-center active:opacity-75"
                style={{ backgroundColor: colors.backgroundSelected }}>
                <Txt variant="body" tone="secondary">
                  ×
                </Txt>
              </Pressable>
            </View>

            <View
              className="min-h-[88px] rounded-sheet p-[12px] flex-row items-center gap-[12px]"
              style={{ backgroundColor: colors.background }}>
              <View
                className={`w-[62px] h-[62px] rounded-card items-center justify-center ${
                  score ? NUTRI_BADGE_CLASSES[score] : ''
                }`}
                style={!score ? { backgroundColor: colors.backgroundSelected } : undefined}>
                <Txt variant="controlActionLarge" weight="700" tone={score ? 'inverse' : 'primary'}>
                  {score?.toUpperCase() ?? '–'}
                </Txt>
              </View>
              <View className="flex-1 gap-[3px]">
                <Txt variant="body" weight="700">
                  Nutri-Score {score?.toUpperCase() ?? '–'}
                </Txt>
                <Txt variant="body" tone="secondary" weight="500">
                  Produktdaten von Open Food Facts
                </Txt>
              </View>
              {isFetching ? <ActivityIndicator size="small" color={colors.accent} /> : null}
            </View>

            <View className="border-hairline rounded-sheet overflow-hidden border-border">
              <View className="min-h-[50px] px-[14px] flex-row items-center justify-between gap-three border-b-hairline border-border">
                <Txt variant="body" tone="secondary" weight="500">
                  Menge und Einheit
                </Txt>
                <Txt variant="body" weight="700" selectable>
                  {item.quantity} {item.unit}
                </Txt>
              </View>
              <View className="min-h-[50px] px-[14px] flex-row items-center justify-between gap-three">
                <Txt variant="body" tone="secondary" weight="500">
                  Mindesthaltbarkeitsdatum
                </Txt>
                <Txt variant="body" weight="700" selectable>
                  {formatExpiry(item.expiry_date)}
                </Txt>
              </View>
            </View>

            <View
              className="rounded-sheet p-[14px] gap-[6px]"
              style={{ backgroundColor: colors.background }}>
              <Txt variant="body" weight="700">
                Zutaten
              </Txt>
              <Txt variant="body" tone="secondary" weight="500" selectable>
                {openFoodFactsProduct?.ingredients ?? 'Keine Zutaten angegeben.'}
              </Txt>
            </View>

            <View
              className="rounded-sheet p-[14px] gap-[6px]"
              style={{ backgroundColor: colors.background }}>
              <Txt variant="body" weight="700">
                Allergene
              </Txt>
              <Txt variant="body" tone="secondary" weight="500" selectable>
                {openFoodFactsProduct?.allergens?.join(', ') ?? 'Keine Allergene angegeben.'}
              </Txt>
            </View>

            <Txt variant="body" weight="700">
              Nährwerte pro {referenceUnit}
            </Txt>
            <View className="flex-row flex-wrap gap-[8px]">
              {nutrients.map((nutrient) => (
                <View
                  key={nutrient.label}
                  className="w-[31.6%] min-h-[62px] rounded-card p-[10px] gap-[5px]"
                  style={{ backgroundColor: colors.backgroundSelected }}>
                  <Txt variant="body" weight="700" selectable>
                    {nutrient.value}
                  </Txt>
                  <Txt variant="body" tone="secondary" weight="500">
                    {nutrient.label}
                  </Txt>
                </View>
              ))}
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
