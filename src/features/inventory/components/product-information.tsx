import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StyleSheet } from 'react-native-unistyles';

import { withAlpha } from '@/components/theme/index';
import { useTheme } from '@/components/theme/ThemeProvider';
import { Txt } from '@/constants/ui';
import { useProduct } from '@/features/inventory/use-product';
import { offApiSource } from '@/features/product-search/sources/off-api-source';
import type { CatalogProduct } from '@/features/product-search/types';
import { debugLog } from '@/lib/observability/debug-log';

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

const NUTRI_BADGE_COLORS: Record<NutriScoreGrade, string> = {
  a: '#038141',
  b: '#85BB2F',
  c: '#FECB02',
  d: '#EE8100',
  e: '#E63E11',
};

const staticStyles = StyleSheet.create({
  closeButton: {
    width: 34,
    height: 34,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closePressed: {
    opacity: 0.75,
  },
});

const styles = StyleSheet.create((theme) => ({
  details: {
    borderWidth: 0.5,
    borderColor: theme.border,
    borderRadius: 20,
    overflow: 'hidden',
  },
  detailRow: {
    minHeight: 50,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
  },
  detailRowWithDivider: {
    borderBottomWidth: 0.5,
    borderBottomColor: theme.border,
  },
}));

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
  const [closePressed, setClosePressed] = useState(false);

  const insets = useSafeAreaInsets();
  const itemId = item?.product_id ?? null;
  const hasItem = Boolean(item);

  useEffect(() => {
    if (!__DEV__ || !visible) return;
    debugLog('[InventorySheet] inventory.product-information.open', {
      sheetId: 'inventory.product-information',
      itemId,
      hasItem,
    });
  }, [hasItem, itemId, visible]);

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
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
        <Pressable
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: colors.scrim,
          }}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Produktinformationen schließen"
        />

        <View
          style={{
            position: 'absolute',
            left: 12,
            right: 12,
            bottom: 10,
            maxHeight: '82%',
            borderRadius: 28,
            overflow: 'hidden',
            backgroundColor: colors.backgroundElement,
            paddingBottom: insets.bottom + 24,
            boxShadow: `0 10px 22px ${withAlpha(colors.shadowSheet, 0.22)}`,
          }}>
          <View
            style={{
              width: 42,
              height: 4,
              borderRadius: 999,
              alignSelf: 'center',
              marginTop: 11,
              backgroundColor: colors.border,
            }}
          />
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ padding: 20, gap: 14 }}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
              <View style={{ flex: 1, gap: 3 }}>
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
                onPressIn={() => setClosePressed(true)}
                onPressOut={() => setClosePressed(false)}
                style={[
                  staticStyles.closeButton,
                  { backgroundColor: colors.backgroundSoft },
                  closePressed && staticStyles.closePressed,
                ]}>
                <Txt variant="body" tone="secondary">
                  ×
                </Txt>
              </Pressable>
            </View>

            <View
              style={{
                minHeight: 88,
                borderRadius: 20,
                padding: 12,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
                backgroundColor: colors.background,
              }}>
              <View
                style={{
                  width: 62,
                  height: 62,
                  borderRadius: 16,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: score ? NUTRI_BADGE_COLORS[score] : colors.backgroundSoft,
                }}>
                <Txt variant="subheading" weight="700" tone={score ? 'onAccent' : 'primary'}>
                  {score?.toUpperCase() ?? '–'}
                </Txt>
              </View>
              <View style={{ flex: 1, gap: 3 }}>
                <Txt variant="body" weight="700">
                  Nutri-Score {score?.toUpperCase() ?? '–'}
                </Txt>
                <Txt variant="body" tone="secondary" weight="500">
                  Produktdaten von Open Food Facts
                </Txt>
              </View>
              {isFetching ? <ActivityIndicator size="small" color={colors.accent} /> : null}
            </View>

            <View style={styles.details}>
              <View style={[styles.detailRow, styles.detailRowWithDivider]}>
                <Txt variant="body" tone="secondary" weight="500">
                  Menge und Einheit
                </Txt>
                <Txt variant="body" weight="700" selectable>
                  {item.quantity} {item.unit}
                </Txt>
              </View>
              <View style={styles.detailRow}>
                <Txt variant="body" tone="secondary" weight="500">
                  Mindesthaltbarkeitsdatum
                </Txt>
                <Txt variant="body" weight="700" selectable>
                  {formatExpiry(item.expiry_date)}
                </Txt>
              </View>
            </View>

            <View
              style={{
                borderRadius: 20,
                padding: 14,
                gap: 6,
                backgroundColor: colors.background,
              }}>
              <Txt variant="body" weight="700">
                Zutaten
              </Txt>
              <Txt variant="body" tone="secondary" weight="500" selectable>
                {openFoodFactsProduct?.ingredients ?? 'Keine Zutaten angegeben.'}
              </Txt>
            </View>

            <View
              style={{
                borderRadius: 20,
                padding: 14,
                gap: 6,
                backgroundColor: colors.background,
              }}>
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
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {nutrients.map((nutrient) => (
                <View
                  key={nutrient.label}
                  style={{
                    width: '31.6%',
                    minHeight: 62,
                    borderRadius: 16,
                    padding: 10,
                    gap: 5,
                    backgroundColor: colors.backgroundSoft,
                  }}>
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
